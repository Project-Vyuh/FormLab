import { randomUUID } from 'node:crypto';
import { problem } from './config.mjs';
import { providerFailure } from './provider-errors.mjs';
import { assetIds } from './store.mjs';
import {deliverResult} from './documents.mjs';
import {assertJsonContract} from './output-contract.mjs';

export function worker(store, config, provider, media, log) {
  const id = randomUUID(), active = new Map();
  const providerId = config.provider || 'gemini', leaseMs = config.leaseMs || 15000;
  let stopping = false;
  const owns = job => Boolean(store.get("SELECT id FROM jobs WHERE id=? AND status='processing' AND worker=? AND claim_token=? AND lease>?", job.id, id, job.claim_token, Date.now()));
  const assertClaim = job => { if (!owns(job)) throw problem(409, 'CLAIM_LOST', 'Worker claim no longer active'); };
  function update(job, sql, ...args) {
    return store.run(`${sql} WHERE id=? AND status='processing' AND worker=? AND claim_token=? AND lease>?`, ...args, job.id, id, job.claim_token, Date.now()).changes;
  }
  const fields = job => ({jobId:job.id, attemptId:job.claim_token, requestId:job.request_id, kind:job.kind});
  const finish = (job,status,result,error,errorCode=null) => store.transaction(()=>{
    const serialized=result?JSON.stringify(result):null;
    const changed=update(job, 'UPDATE jobs SET status=?,result=?,error=?,error_code=?,input=NULL,lease=NULL,worker=NULL,claim_token=NULL,updated=?',status,serialized,error||null,errorCode,Date.now());
    if (changed&&status==='succeeded'){
      for (const assetId of assetIds(serialized)) store.run("INSERT OR IGNORE INTO job_assets VALUES(?,?,?,'output')",job.owner,job.id,assetId);
      deliverResult(store,job,result);
    }
    return changed;
  });
  function healthy() {
    store.run('INSERT INTO provider_health(provider,failures,open_until) VALUES(?,0,0) ON CONFLICT(provider) DO UPDATE SET failures=0,open_until=0 WHERE provider_health.open_until<=?', providerId,Date.now());
  }
  function unhealthy(failure) {
    if (!failure.pause) return;
    store.transaction(() => {
      const count = (store.get('SELECT failures FROM provider_health WHERE provider=?', providerId)?.failures || 0)+1;
      const openUntil = !failure.retryable || count>=3 ? Date.now()+failure.pause : 0;
      store.run('INSERT INTO provider_health VALUES(?,?,?) ON CONFLICT(provider) DO UPDATE SET failures=excluded.failures,open_until=excluded.open_until', providerId,count,openUntil);
      if (openUntil) log('provider_paused', {provider:providerId,reason:failure.code,openUntil});
    });
  }
  function validateOutput(result,input) {
    if (!result || result.promptFeedback?.blockReason) throw problem(502,'INVALID_OUTPUT','Provider blocked output');
    const candidates=result.candidates||[],parts=candidates.flatMap(c=>c.content?.parts||[]);
    if(candidates.length>1||parts.length>32)throw problem(502,'INVALID_OUTPUT','Provider output shape exceeds limits');
    if (candidates.some(c=>c.finishReason&&!['STOP','MAX_TOKENS'].includes(c.finishReason))) throw problem(502,'INVALID_OUTPUT','Provider did not complete output');
    const text=result.text||parts.filter(p=>typeof p.text==='string').map(p=>p.text).join('');
    if(typeof text!=='string'||text.length>100000)throw problem(502,'INVALID_OUTPUT','Provider text exceeds limits');
    const expectsImage=input.config?.responseModalities?.includes('IMAGE');
    if (expectsImage&&!parts.some(p=>p.inlineData?.mimeType?.startsWith('image/'))) throw problem(502,'INVALID_OUTPUT','Provider returned no image');
    if (!expectsImage&&!text.trim()) throw problem(502,'INVALID_OUTPUT','Provider returned no text');
    if (input.config?.responseMimeType==='application/json') {
      try { assertJsonContract(JSON.parse(text),input.config.responseSchema); } catch { throw problem(502,'INVALID_OUTPUT','Provider returned invalid JSON or schema'); }
    }
    let total=0;
    for (const part of parts) if (part.inlineData) {
      const {data,mimeType}=part.inlineData;
      if (typeof data!=='string'||data.length>4*Math.ceil((config.assetLimit||20*1024*1024)/3)||!mimeType?.startsWith('image/')||!data.length||data.length%4!==0||!/^[A-Za-z0-9+/]*={0,2}$/.test(data)) throw problem(502,'INVALID_OUTPUT','Malformed image output');
      total+=Buffer.byteLength(data,'base64');
      if (total>(config.assetLimit||20*1024*1024)) throw problem(502,'INVALID_OUTPUT','Provider output exceeds limit');
    }
  }
  async function execute(job,controller) {
    const timeout=setTimeout(()=>controller.abort(Error('Job deadline exceeded')),config.executionMs||120000);
    const created=[];let attemptStatus='interrupted',errorCode=null;
    try {
      const input=JSON.parse(job.input);assertClaim(job);
      if (job.kind==='content') {
        const result=await provider.content(input,job.owner,controller.signal);
        store.run("UPDATE usage_ledger SET status='completed',actual_usage=?,finished=? WHERE attempt_id=?",result.usage?JSON.stringify(result.usage):null,Date.now(),job.claim_token);
        assertClaim(job);controller.signal.throwIfAborted();validateOutput(result,input);
        for (const candidate of result.candidates||[]) for (const part of candidate.content?.parts||[]) if (part.inlineData) {
          assertClaim(job);
          const {data,mimeType}=part.inlineData;
          const asset=await media.saveBytes(Buffer.from(data,'base64'),job.owner,mimeType,controller.signal);
          created.push(asset.id);assertClaim(job);controller.signal.throwIfAborted();
          delete part.inlineData;part.fileData={mimeType,fileUri:asset.url};
        }
        if (!finish(job,'succeeded',{response:result})) throw problem(409,'CLAIM_LOST','Claim lost at completion');
      } else {
        if (Date.now()-job.created>15*60*1000) throw Error('Video deadline exceeded');
        let operation=job.operation?JSON.parse(job.operation):await provider.startVideo(input,job.owner,controller.signal);
        assertClaim(job);controller.signal.throwIfAborted();
        if (!update(job,'UPDATE jobs SET operation=?,updated=?',JSON.stringify(operation),Date.now())) throw problem(409,'CLAIM_LOST','Claim lost at checkpoint');
        store.run("UPDATE usage_ledger SET status='completed',finished=? WHERE attempt_id=?",Date.now(),job.claim_token);
        if (!operation.done) operation=await provider.pollVideo(operation,controller.signal);
        assertClaim(job);controller.signal.throwIfAborted();
        if (operation.error) throw Error('Video provider rejected generation');
        if (operation.done) {
          const asset=await provider.saveVideo(operation,job.owner,controller.signal);
          created.push(asset.id);assertClaim(job);controller.signal.throwIfAborted();
          if (!finish(job,'succeeded',{outputUrl:asset.url})) throw problem(409,'CLAIM_LOST','Claim lost at completion');
        } else if (!update(job,"UPDATE jobs SET status='queued',operation=?,lease=NULL,worker=NULL,claim_token=NULL,failure_count=0,poll_count=poll_count+1,next_run=?,updated=?",JSON.stringify(operation),Date.now()+(config.pollMs||8000)+Math.floor(Math.random()*(config.pollMs?1:4000)),Date.now())) throw problem(409,'CLAIM_LOST','Claim lost at poll');
      }
      healthy();attemptStatus='succeeded';log('job_progress',{...fields(job),durationMs:Date.now()-job.updated});
    } catch (error) {
      for (const assetId of created) await media.remove(assetId,job.owner).catch(()=>log('asset_cleanup_failure',fields(job)));
      const failure=providerFailure(error);errorCode=failure.code;attemptStatus='failed';
      store.run("UPDATE usage_ledger SET status=?,finished=? WHERE attempt_id=? AND status='reserved'",[401,403,429,503].includes(Number(error.status||error.code))?'rejected':'unknown',Date.now(),job.claim_token);
      // A stale callback cannot publish results or change provider health.
      if (owns(job)) {
        unhealthy(failure);const failures=job.failure_count+1;
        if (!controller.signal.aborted&&failure.retryable&&failures<3) {
          update(job,"UPDATE jobs SET status='queued',failure_count=?,lease=NULL,worker=NULL,claim_token=NULL,next_run=?,error=?,error_code=?,updated=?",failures,Date.now()+(config.retryMs||1000)*2**failures+Math.floor(Math.random()*(config.retryMs?1:1000)),failure.message,failure.code,Date.now());
        } else {
          update(job,'UPDATE jobs SET failure_count=?',failures);
          finish(job,'failed',null,controller.signal.aborted?'Generation interrupted or timed out; inspect before submitting again':failure.message,controller.signal.aborted?'GENERATION_INTERRUPTED':failure.code);
        }
      }
      log('job_failure',{...fields(job),errorCode,providerStatus:Number(error.status||error.code)||null});
    } finally {
      clearTimeout(timeout);
      try { store.run('UPDATE generation_attempts SET finished=?,status=?,error_code=? WHERE id=?',Date.now(),attemptStatus,errorCode,job.claim_token); }
      finally { active.delete(job.claim_token); }
    }
  }
  function tick() {
    if (stopping) return;
    try {
      const now=Date.now();
      store.transaction(()=>{
        for (const [token,execution] of active) {
          if (!owns(execution.job)) execution.controller.abort(Error('Claim lost'));
          else store.run("UPDATE jobs SET lease=? WHERE id=? AND worker=? AND claim_token=? AND status='processing' AND lease>?",now+leaseMs,execution.job.id,id,token,now);
        }
        store.run("UPDATE usage_ledger SET status='unknown',finished=? WHERE status='reserved' AND attempt_id IN (SELECT claim_token FROM jobs WHERE status='processing' AND lease<=?)",now,now);
        store.run("UPDATE generation_attempts SET status='interrupted',error_code='LEASE_EXPIRED',finished=? WHERE status='processing' AND id IN (SELECT claim_token FROM jobs WHERE status='processing' AND lease<=?)",now,now);
        store.run("UPDATE jobs SET status=CASE WHEN kind='video' AND operation IS NOT NULL THEN 'queued' ELSE 'failed' END,error='Worker interrupted; paid submission was not automatically repeated',error_code='LEASE_EXPIRED',lease=NULL,worker=NULL,claim_token=NULL,updated=? WHERE status='processing' AND lease<=?",now,now);
        store.run("UPDATE jobs SET status='failed',input=NULL,error='Job exceeds current server memory budget',error_code='MEMORY_BUDGET',updated=? WHERE status='queued' AND memory_bytes>?",now,config.memoryBudget||512*1024*1024);
      });
      if (store.get('SELECT open_until FROM provider_health WHERE provider=?',providerId)?.open_until>now||process.memoryUsage().rss>(config.maxRss||768*1024*1024)) return;
      while (active.size<config.concurrency) {
        const job=store.transaction(()=>{
          const usage=store.get("SELECT count(*) AS count,coalesce(sum(memory_bytes),0) AS bytes FROM jobs WHERE status='processing'");
          for(const execution of active.values()) if(!owns(execution.job)){usage.count++;usage.bytes+=execution.job.memory_bytes;}
          if (usage.count>=config.concurrency) return null;
          const activeIds=new Set([...active.values()].map(x=>x.job.id));
          const next=store.all("SELECT * FROM jobs WHERE status='queued' AND next_run<=? ORDER BY created LIMIT 100",now).find(j=>!activeIds.has(j.id)&&usage.bytes+j.memory_bytes<=(config.memoryBudget||512*1024*1024));
          if (!next) return null;
          const token=randomUUID();
          const input=JSON.parse(next.input),units=next.kind==='video'?(next.operation?0:10):1;
          const spent=store.get("SELECT coalesce(sum(reserved_units),0) n FROM usage_ledger WHERE owner=? AND created>? AND status!='rejected'",next.owner,now-86400000).n;
          if(spent+units>(config.dailyBudgetUnits||100)){
            store.run("UPDATE jobs SET status='failed',input=NULL,error='Daily local generation budget reached',error_code='SPEND_BUDGET',updated=? WHERE id=?",now,next.id);return null;
          }
          store.run("UPDATE jobs SET status='processing',attempt=attempt+1,lease=?,worker=?,claim_token=?,updated=? WHERE id=? AND status='queued'",now+leaseMs,id,token,now,next.id);
          store.run("INSERT INTO generation_attempts(id,job_id,worker,started,status) VALUES(?,?,?,?,'processing')",token,next.id,id,now);
          store.run("INSERT INTO usage_ledger(attempt_id,owner,job_id,provider,model,reserved_units,status,created) VALUES(?,?,?,?,?,?,'reserved',?)",token,next.owner,next.id,providerId,input.model||'unknown',units,now);
          return {...next,attempt:next.attempt+1,claim_token:token,updated:now};
        });
        if (!job) break;
        const controller=new AbortController();active.set(job.claim_token,{job,controller});
        log('job_started',{...fields(job),memoryReservationBytes:job.memory_bytes});
        void execute(job,controller).catch(()=>log('worker_storage_failure',fields(job)));
      }
    } catch (error) { log('worker_tick_failure',{errorCode:typeof error.code==='string'&&error.code.startsWith('SQLITE_')?error.code:'WORKER_STORAGE'}); }
  }
  const interval=setInterval(tick,config.tickMs||250);tick();
  return {
    cancel(jobId) { for (const execution of active.values()) if (execution.job.id===jobId) execution.controller.abort(Error('Cancelled')); },
    async stop() {
      stopping=true;clearInterval(interval);
      for (const execution of active.values()) execution.controller.abort(Error('Shutdown'));
      const until=Date.now()+5000;
      while (active.size&&Date.now()<until) await new Promise(resolve=>setTimeout(resolve,20));
      store.run('UPDATE jobs SET lease=0,worker=NULL,claim_token=NULL WHERE worker=?',id);
    },
  };
}
