import http from 'node:http';
import { Readable } from 'node:stream';
import { randomUUID } from 'node:crypto';
import { access, statfs } from 'node:fs/promises';
import { constants } from 'node:fs';
import { configuration, object, problem } from './config.mjs';
import { openStore, publicJob, assetIds } from './store.mjs';
import { authentication, userView } from './auth.mjs';
import { mediaStorage } from './media.mjs';
import { validateGeneration, inputHash, generationProvider } from './generation.mjs';
import { worker } from './worker.mjs';
import {runtimeLock} from './runtime-lock.mjs';
import {putDocument,validateAttachment,protectDeliveredHistory} from './documents.mjs';

const config=await configuration();
const unlock=runtimeLock(config.directory);
const store=openStore(config),auth=authentication(store,config),media=mediaStorage(store,config);
const log=(event,fields={})=>console.log(JSON.stringify({time:new Date().toISOString(),event,...fields}));
log('storage_recovery',await media.recover());
const workers=worker(store,config,generationProvider(config,media),media,log);
let maintenance=null;
const maintenanceTimer=setInterval(()=>{if(config.retentionEnabled&&!maintenance){maintenance=media.maintain({apply:true}).then(result=>log('retention',result)).catch(()=>log('retention_failure',{errorCode:'STORAGE_MAINTENANCE'})).finally(()=>maintenance=null);}},60000);
let shuttingDown=false,uploads=0;
const send=(res,status,payload)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8'});res.end(status===204?undefined:JSON.stringify(payload));};
const routeLabel=path=>{
  if(['/api/health','/api/ready','/api/metrics','/api/capabilities','/api/usage','/api/alerts','/api/jobs','/api/assets','/api/auth/login','/api/auth/register','/api/auth/logout','/api/auth/session','/api/ai/generate-content','/api/ai/generate-video'].includes(path))return path;
  if(/^\/api\/assets\/by-key\//.test(path))return '/api/assets/by-key/:key';
  if(/^\/api\/projects\/[^/]+\/history\/[^/]+$/.test(path))return '/api/projects/:id/history/:historyId';
  if(/^\/api\/jobs\/by-key\//.test(path))return '/api/jobs/by-key/:key';
  if(/^\/api\/jobs\/[^/]+\/cancel$/.test(path))return '/api/jobs/:id/cancel';
  if(/^\/api\/jobs\/[^/]+$/.test(path))return '/api/jobs/:id';
  if(/^\/(api\/)?assets\//.test(path))return '/assets/:id';
  if(/^\/api\/documents\//.test(path))return '/api/documents/:collection/:id?';
  return 'unmatched';
};
async function json(req,limit=256*1024){
  if(req.headers['content-type']?.split(';')[0]!=='application/json')throw problem(415,'JSON_REQUIRED','Content-Type application/json is required');
  const chunks=[];let size=0;
  for await(const chunk of req.iterator({destroyOnReturn:false})){size+=chunk.length;if(size>limit){req.resume();throw problem(413,'BODY_TOO_LARGE','Request exceeds limit');}chunks.push(chunk);}
  try{return object(JSON.parse(Buffer.concat(chunks).toString('utf8')));}catch(error){if(error.status)throw error;throw problem(400,'INVALID_JSON','Malformed JSON body');}
}
const server=http.createServer(async(req,res)=>{
  const requestId=randomUUID(),start=Date.now();
  let route='unmatched',jobId;
  res.setHeader('x-request-id',requestId);res.setHeader('x-content-type-options','nosniff');res.setHeader('cache-control','no-store');
  res.on('finish',()=>log('http_request',{requestId,route,jobId,method:req.method,status:res.statusCode,durationMs:Date.now()-start}));
  try{
    if(![`localhost:${config.port}`,`127.0.0.1:${config.port}`].includes(req.headers.host))throw problem(403,'HOST_DENIED','Unapproved host');
    const origin=req.headers.origin;
    if(origin&&!config.origins.has(origin))throw problem(403,'ORIGIN_DENIED','Unapproved origin');
    if(origin){res.setHeader('access-control-allow-origin',origin);res.setHeader('access-control-allow-credentials','true');res.setHeader('vary','Origin');}
    if(req.method==='OPTIONS'){res.setHeader('access-control-allow-headers','content-type,x-formlab-client,x-idempotency-key');res.setHeader('access-control-allow-methods','GET,HEAD,POST,PUT,DELETE,OPTIONS');return send(res,204,{});}
    if(!['GET','HEAD'].includes(req.method)&&req.headers['x-formlab-client']!=='web')throw problem(403,'CLIENT_HEADER_REQUIRED','FormLab client header required');
    const url=new URL(req.url,'http://localhost'),path=url.pathname;
    route=routeLabel(path);
    if(path==='/api/health')return send(res,200,{ok:true,provider:config.provider});
    if(path==='/api/capabilities'&&req.method==='GET')return send(res,200,{provider:config.provider,imageSizes:['1K','2K'],videoEnabled:config.videoEnabled,maxAssetBytes:config.assetLimit,projectDelivery:true,retentionEnabled:config.retentionEnabled});
    if(path==='/api/ready'){
      store.get('SELECT 1');await access(config.directory,constants.W_OK);
      const disk=await statfs(config.directory),storageReady=disk.bavail*disk.bsize>=2*config.assetLimit;
      const paused=(store.get('SELECT open_until FROM provider_health WHERE provider=?',config.provider)?.open_until||0)>Date.now();
      const ready=!shuttingDown&&storageReady&&!paused&&(config.provider==='fake'||Boolean(config.key));
      return send(res,ready?200:503,{ready,database:'sqlite',storageReady,providerPaused:paused,providerConfigured:config.provider==='fake'||Boolean(config.key)});
    }
    if(shuttingDown)throw problem(503,'SHUTTING_DOWN','Server is restarting');
    if(path==='/api/auth/register'&&req.method==='POST'){
      store.limit(`register:${req.socket.remoteAddress}`,5,3600000);
      const user=await auth.register(await json(req,4096));res.setHeader('set-cookie',auth.session(user,req));return send(res,201,{user:userView(user)});
    }
    if(path==='/api/auth/login'&&req.method==='POST'){
      store.limit(`login:${req.socket.remoteAddress}`,10,60000);
      const user=await auth.login(await json(req,4096));res.setHeader('set-cookie',auth.session(user,req));return send(res,200,{user:userView(user)});
    }
    const user=auth.current(req);
    if(path==='/api/auth/session'&&req.method==='GET')return send(res,200,{user:user?userView(user):null});
    if(!user)throw problem(401,'AUTH_REQUIRED','Sign in to FormLab');
    if(path==='/api/auth/logout'&&req.method==='POST'){res.setHeader('set-cookie',auth.logout(req));return send(res,200,{ok:true});}
    store.limit(`requests:${user.id}`,600);
    if(path==='/api/usage'&&req.method==='GET')return send(res,200,{unitDefinition:'Local admission units; not currency or provider invoices',dailyBudgetUnits:config.dailyBudgetUnits,attempts:store.all('SELECT attempt_id,job_id,provider,model,reserved_units,actual_usage,status,created,finished FROM usage_ledger WHERE owner=? ORDER BY created DESC LIMIT 25',user.id)});
    if(path==='/api/alerts'&&req.method==='GET'){
      const alerts=[];
      if((store.get('SELECT open_until FROM provider_health WHERE provider=?',config.provider)?.open_until||0)>Date.now())alerts.push({code:'PROVIDER_PAUSED',severity:'error'});
      if(store.get("SELECT count(*) n FROM jobs WHERE owner=? AND status='queued' AND created<?",user.id,Date.now()-60000).n)alerts.push({code:'QUEUE_DELAYED',severity:'warning'});
      if(store.get("SELECT count(*) n FROM assets WHERE owner=? AND state='missing'",user.id).n)alerts.push({code:'ASSET_MISSING',severity:'error'});
      if(process.memoryUsage().rss>config.maxRss)alerts.push({code:'MEMORY_PRESSURE',severity:'error'});
      return send(res,200,{alerts});
    }
    const uploadKeyMatch=/^\/api\/assets\/by-key\/([a-f0-9]{64})$/.exec(path);
    if(uploadKeyMatch&&req.method==='GET'){
      const existing=store.get('SELECT asset_id FROM upload_keys WHERE owner=? AND key=?',user.id,uploadKeyMatch[1]);
      if(!existing)throw problem(404,'ASSET_NOT_FOUND','Asset not found');
      const asset=media.row(existing.asset_id,user.id);return send(res,200,{id:asset.id,url:`/assets/${asset.id}`});
    }
    if(path==='/api/metrics'&&req.method==='GET'){
      const durations=store.all("SELECT updated-created AS ms FROM jobs WHERE owner=? AND status='succeeded' ORDER BY updated DESC LIMIT 1000",user.id).map(r=>r.ms).sort((a,b)=>a-b);
      return send(res,200,{jobs:store.all('SELECT status,count(*) AS count FROM jobs WHERE owner=? GROUP BY status',user.id),queue:store.get("SELECT count(*) AS pending,min(created) AS oldestCreatedAt FROM jobs WHERE owner=? AND status IN ('queued','processing')",user.id),durationMs:{sampleSize:durations.length,p95:durations.length?durations[Math.ceil(durations.length*.95)-1]:null},storage:store.get('SELECT count(*) AS files,coalesce(sum(size),0) AS bytes FROM assets WHERE owner=?',user.id),process:{rssBytes:process.memoryUsage().rss},limits:{dailyJobs:config.dailyLimit,pendingJobs:config.pendingLimit}});
    }
    if(['/api/ai/generate-content','/api/ai/generate-video'].includes(path)&&req.method==='POST'){
      store.limit(`generation:${user.id}`,30);
      const kind=path.endsWith('video')?'video':'content',key=req.headers['x-idempotency-key'];
      if(typeof key!=='string'||!/^[A-Za-z0-9_-]{8,128}$/.test(key))throw problem(400,'INVALID_KEY','A valid idempotency key is required');
      const raw=await json(req),attachment=validateAttachment(store,user.id,raw.attachment);delete raw.attachment;
      const input=validateGeneration(raw,kind,config,media,user.id);
      if(attachment&&((kind==='content'&&!input.config.responseModalities?.includes('IMAGE'))||(kind==='video'&&attachment.history.type!=='video-generation')||(kind==='content'&&attachment.history.type==='video-generation')))throw problem(400,'INVALID_ATTACHMENT','Delivery type must match the generation capability');
      const job=store.admit(user.id,key,inputHash(attachment?{input,attachment}:input),kind,input,requestId,attachment);jobId=job.id;
      return send(res,202,{jobId:job.id,status:job.status});
    }
    if(path==='/api/jobs'&&req.method==='GET'){
      const offset=Number(url.searchParams.get('offset')||0);
      if(!Number.isSafeInteger(offset)||offset<0)throw problem(400,'INVALID_INPUT','Invalid pagination offset');
      const jobs=store.all('SELECT id,status,kind,attempt,failure_count,poll_count,created,updated,result,error,error_code FROM jobs WHERE owner=? ORDER BY created DESC,id DESC LIMIT 25 OFFSET ?',user.id,offset).map(publicJob);
      return send(res,200,{jobs,nextOffset:jobs.length===25?offset+25:null});
    }
    const keyMatch=/^\/api\/jobs\/by-key\/([A-Za-z0-9_-]{8,128})$/.exec(path);
    if(keyMatch&&req.method==='GET'){
      const job=store.get('SELECT * FROM jobs WHERE owner=? AND key=?',user.id,keyMatch[1]);
      if(!job)throw problem(404,'JOB_NOT_FOUND','Job not found');jobId=job.id;return send(res,200,publicJob(job));
    }
    const jobMatch=/^\/api\/jobs\/([a-f0-9-]{36})(\/cancel)?$/.exec(path);
    if(jobMatch){
      const job=store.get('SELECT * FROM jobs WHERE id=? AND owner=?',jobMatch[1],user.id);
      if(!job)throw problem(404,'JOB_NOT_FOUND','Job not found');
      jobId=job.id;
      if(req.method==='POST'&&jobMatch[2]){store.run("UPDATE jobs SET status='cancelled',input=NULL,lease=NULL,worker=NULL,claim_token=NULL,updated=? WHERE id=? AND status IN ('queued','processing')",Date.now(),job.id);workers.cancel(job.id);return send(res,200,publicJob(store.get('SELECT * FROM jobs WHERE id=?',job.id)));}
      if(req.method==='GET')return send(res,200,publicJob(job));
    }
    if(path==='/api/assets'&&req.method==='POST'){
      if(uploads>=2)throw problem(429,'UPLOAD_BUSY','Too many active uploads');
      const key=req.headers['x-idempotency-key'];
      if(key!==undefined&&!/^[a-f0-9]{64}$/.test(key))throw problem(400,'INVALID_KEY','Upload key must be a SHA-256 digest');
      uploads++;try{
        const saved=await media.save(Readable.from(req.iterator({destroyOnReturn:false})),user.id,req.headers['content-type']?.split(';')[0]);
        if(key){
          const metadata=media.row(saved.id,user.id);
          if(metadata.checksum!==key){await media.remove(saved.id,user.id);throw problem(400,'CHECKSUM_MISMATCH','Upload checksum does not match');}
          const old=store.get('SELECT asset_id FROM upload_keys WHERE owner=? AND key=?',user.id,key);
          if(old){const existing=media.row(old.asset_id,user.id);await media.remove(saved.id,user.id);return send(res,200,{id:existing.id,url:`/assets/${existing.id}`});}
          store.run('INSERT INTO upload_keys VALUES(?,?,?)',user.id,key,saved.id);
        }
        return send(res,201,saved);
      }catch(error){req.resume();throw error;}finally{uploads--;}
    }
    const assetMatch=/^\/(api\/)?assets\/([a-f0-9-]{36})$/.exec(path);
    if(assetMatch){
      if(req.method==='GET'||req.method==='HEAD')return await media.serve(req,res,assetMatch[2],user.id);
      if(req.method==='DELETE'){
        const assetId=assetMatch[2];media.row(assetId,user.id);
        if(store.get('SELECT asset_id FROM asset_references WHERE owner=? AND asset_id=? LIMIT 1',user.id,assetId)||store.get('SELECT asset_id FROM job_assets WHERE owner=? AND asset_id=? LIMIT 1',user.id,assetId))throw problem(409,'ASSET_IN_USE','Asset is referenced by a project or generation');
        await media.remove(assetId,user.id);return send(res,200,{deleted:true});
      }
    }
    const docMatch=/^\/api\/documents\/([a-zA-Z0-9_-]{1,64})(?:\/([a-zA-Z0-9_-]{1,128}))?$/.exec(path);
    const historyDelete=/^\/api\/projects\/([a-zA-Z0-9_-]{1,128})\/history\/([a-zA-Z0-9_-]{1,128})$/.exec(path);
    if(historyDelete&&req.method==='DELETE'){
      const [,projectId,historyId]=historyDelete;
      const revision=store.transaction(()=>{
        const row=store.get("SELECT value,revision FROM documents WHERE owner=? AND collection='project-state' AND id=?",user.id,projectId);
        if(!row)throw problem(404,'PROJECT_NOT_FOUND','Project not found');
        if(store.get('SELECT history_id FROM history_tombstones WHERE owner=? AND project_id=? AND history_id=?',user.id,projectId,historyId))return row.revision;
        store.run('INSERT OR IGNORE INTO history_tombstones VALUES(?,?,?,?)',user.id,projectId,historyId,Date.now());
        return putDocument(store,user.id,'project-state',projectId,JSON.parse(row.value),row.revision);
      });
      return send(res,200,{deleted:true,revision});
    }
    if(docMatch){
      const [,collection,id]=docMatch;
      if(req.method==='GET'){
        if(!id){const offset=Number(url.searchParams.get('offset')||0);if(!Number.isInteger(offset)||offset<0)throw problem(400,'INVALID_INPUT','Invalid pagination offset');const rows=store.all('SELECT value,revision FROM documents WHERE owner=? AND collection=? ORDER BY id LIMIT 25 OFFSET ?',user.id,collection,offset);return send(res,200,{documents:rows.map(r=>({value:JSON.parse(r.value),revision:r.revision})),nextOffset:rows.length===25?offset+25:null});}
        const row=store.get('SELECT value,revision FROM documents WHERE owner=? AND collection=? AND id=?',user.id,collection,id);
        return row?send(res,200,{value:collection==='project-state'?protectDeliveredHistory(store,user.id,id,JSON.parse(row.value)):JSON.parse(row.value),revision:row.revision}):send(res,404,{error:'Document not found',code:'DOCUMENT_NOT_FOUND'});
      }
      if(id&&req.method==='PUT'){
        const input=await json(req,2*1024*1024);
        if(!Object.hasOwn(input,'value')||!Number.isInteger(input.revision)||input.revision<0)throw problem(400,'INVALID_INPUT','Value and expected revision are required');
        const value=JSON.stringify(input.value);if(/data:(image|video)\//.test(value)||/blob:/.test(value))throw problem(400,'INLINE_MEDIA','Persist asset URLs instead of inline or temporary media');
        const mutationId=input.mutationId;
        if(mutationId!==undefined&&!/^[A-Za-z0-9_-]{8,128}$/.test(mutationId))throw problem(400,'INVALID_KEY','Invalid mutation identity');
        const revision=store.transaction(()=>{
          const hash=inputHash({collection,id,value:input.value,revision:input.revision});
          const receipt=mutationId&&store.get('SELECT hash,revision FROM document_mutations WHERE owner=? AND id=?',user.id,mutationId);
          if(receipt){if(receipt.hash!==hash)throw problem(409,'IDEMPOTENCY_CONFLICT','Mutation key was reused with different data');return receipt.revision;}
          const next=putDocument(store,user.id,collection,id,input.value,input.revision);
          if(mutationId)store.run('INSERT INTO document_mutations VALUES(?,?,?,?,?)',user.id,mutationId,hash,next,Date.now());
          return next;
        });
        return send(res,200,{revision});
      }
      if(id&&req.method==='DELETE'){store.run('DELETE FROM documents WHERE owner=? AND collection=? AND id=?',user.id,collection,id);return send(res,200,{deleted:true});}
    }
    throw problem(404,'NOT_FOUND','Endpoint not found');
  }catch(error){
    if(res.headersSent){res.destroy();return;}
    const status=error.status||(error.code==='ENOENT'?404:500);
    // Rejected bodies may still be arriving. Never return that socket to the keep-alive pool.
    if(status===413||!req.complete){req.resume();res.shouldKeepAlive=false;res.setHeader('connection','close');}
    if(status>=500)log('request_failure',{requestId,errorCode:error.code||error.name});
    send(res,status,{error:status>=500?'Service temporarily unavailable':error.message,code:error.code||'INTERNAL_ERROR',requestId});
  }
});
server.requestTimeout=30000;server.headersTimeout=10000;
server.listen(config.port,'127.0.0.1',()=>log('listening',{port:config.port,provider:config.provider}));
async function stop(){if(shuttingDown)return;shuttingDown=true;clearInterval(maintenanceTimer);server.close();await workers.stop();if(maintenance)await maintenance;server.closeAllConnections();store.db.close();unlock();process.exit(0);}
process.on('SIGINT',stop);process.on('SIGTERM',stop);
