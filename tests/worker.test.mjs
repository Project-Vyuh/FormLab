import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openStore} from '../server/store.mjs';
import {worker} from '../server/worker.mjs';
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn){for(let i=0;i<100;i++){if(fn())return;await delay(25);}throw Error('Worker condition timeout');}
async function setup(overrides={}){
  const directory=await mkdtemp(join(tmpdir(),'formlab-worker-'));
  const config={directory,concurrency:1,dailyLimit:10,pendingLimit:10,...overrides};
  const store=openStore(config);store.run("INSERT INTO users VALUES('owner','owner@test.dev','Owner','unused')");
  return {store,config,enqueue:(key='request-0001')=>store.admit('owner',key,'hash','content',{model:'test'})};
}
test('worker limits concurrency and retries only explicit rejection with bounded attempts',async()=>{
  const {store,config,enqueue}=await setup();let calls=0,running=0,peak=0;
  const first=enqueue(),second=enqueue('request-0002');
  const provider={async content(){calls++;running++;peak=Math.max(peak,running);await delay(40);running--;if(calls===1)throw Object.assign(Error('throttled'),{status:429});return {text:'ok',candidates:[]};}};
  const w=worker(store,config,provider,{},()=>{});
  try{
    await until(()=>store.get('SELECT status FROM jobs WHERE id=?',first.id).status==='queued');
    await until(()=>store.get('SELECT status FROM jobs WHERE id=?',second.id).status==='succeeded');
    store.run('UPDATE jobs SET next_run=0 WHERE id=?',first.id);
    await until(()=>store.get('SELECT status FROM jobs WHERE id=?',first.id).status==='succeeded');
    assert.equal(peak,1);assert.equal(calls,3);assert.equal(store.get('SELECT attempt FROM jobs WHERE id=?',first.id).attempt,2);
  }finally{await w.stop();store.db.close();}
});
test('ambiguous provider errors are terminal and not automatically charged again',async()=>{
  const {store,config,enqueue}=await setup();const job=enqueue();let calls=0;
  const w=worker(store,config,{async content(){calls++;throw Error('network disconnected after submit');}},{},()=>{});
  try{await until(()=>store.get('SELECT status FROM jobs WHERE id=?',job.id).status==='failed');await delay(300);assert.equal(calls,1);assert.equal(store.get('SELECT input FROM jobs WHERE id=?',job.id).input,null);}finally{await w.stop();store.db.close();}
});
test('transactional admission enforces daily and pending quotas without creating rejected jobs',async()=>{
  const {store,enqueue}=await setup({dailyLimit:2,pendingLimit:1});
  try{const first=enqueue();assert.throws(()=>enqueue('request-0002'),/pending/);store.run("UPDATE jobs SET status='failed' WHERE id=?",first.id);enqueue('request-0002');assert.throws(()=>enqueue('request-0003'),/Daily/);assert.equal(store.get('SELECT count(*) AS n FROM jobs').n,2);}finally{store.db.close();}
});
test('stale claim cannot publish output or overwrite a replacement claim',async()=>{
  const {store,config,enqueue}=await setup({tickMs:10});const job=enqueue();let release;
  const pending=new Promise(resolve=>release=resolve);
  const w=worker(store,config,{content:()=>pending},{},()=>{});
  try{
    await until(()=>store.get('SELECT claim_token FROM jobs WHERE id=?',job.id).claim_token);
    store.run("UPDATE jobs SET worker='replacement',claim_token='new-token',lease=? WHERE id=?",Date.now()+10000,job.id);
    release({text:'stale output',candidates:[]});await delay(80);
    const row=store.get('SELECT * FROM jobs WHERE id=?',job.id);
    assert.equal(row.status,'processing');assert.equal(row.claim_token,'new-token');assert.equal(row.result,null);
    assert.equal(store.get('SELECT status FROM generation_attempts WHERE job_id=?',job.id).status,'failed');
  }finally{await w.stop();store.db.close();}
});
test('video polls do not spend the transient-failure retry allowance',async()=>{
  const {store,config}=await setup({tickMs:10,pollMs:5,retryMs:5});let polls=0,starts=0;
  const job=store.admit('owner','video-retry-key','hash','video',{model:'test'});
  const w=worker(store,config,{
    async startVideo(){starts++;return {name:'operation',done:false};},
    async pollVideo(){polls++;if(polls===4)throw Object.assign(Error('temporary'),{status:429});return {name:'operation',done:polls>=5};},
    async saveVideo(){return {id:'asset',url:'/assets/test'};},
  },{},()=>{});
  try{
    await until(()=>store.get('SELECT status FROM jobs WHERE id=?',job.id).status==='succeeded');
    const row=store.get('SELECT * FROM jobs WHERE id=?',job.id);
    assert.equal(starts,1);assert.equal(polls,5);assert.equal(row.poll_count,3);assert.equal(row.failure_count,1);assert.equal(row.attempt,5);
  }finally{await w.stop();store.db.close();}
});
test('expired live video callback is fenced and cannot reenter its own active slot',async()=>{
  const {store,config}=await setup({concurrency:2,tickMs:10,pollMs:5});let release, polls=0,saves=0;
  const pending=new Promise(resolve=>release=resolve);
  const job=store.admit('owner','video-lease-key','hash','video',{model:'test'});
  const w=worker(store,config,{
    async startVideo(){return {name:'operation',done:false};},
    async pollVideo(){polls++;return polls===1?pending:{name:'operation',done:true};},
    async saveVideo(){saves++;return {id:'asset',url:'/assets/test'};},
  },{},()=>{});
  try{
    await until(()=>polls===1);store.run('UPDATE jobs SET lease=0 WHERE id=?',job.id);
    await until(()=>store.get('SELECT status FROM jobs WHERE id=?',job.id).status==='queued');await delay(70);
    assert.equal(polls,1);assert.equal(saves,0);
    release({name:'operation',done:true});
    await until(()=>store.get('SELECT status FROM jobs WHERE id=?',job.id).status==='succeeded');
    assert.equal(polls,2);assert.equal(saves,1);
  }finally{release?.({done:true});await w.stop();store.db.close();}
});
test('empty image, safety rejection and malformed JSON cannot be reported as delivered',async()=>{
  for(const [input,result] of [
    [{config:{responseModalities:['IMAGE']}},{text:'no image',candidates:[]}],
    [{},{text:'blocked',promptFeedback:{blockReason:'SAFETY'},candidates:[]}],
    [{config:{responseMimeType:'application/json'}},{text:'{bad',candidates:[]}],
    [{config:{responseMimeType:'application/json',responseSchema:{type:'OBJECT',required:['palette'],properties:{palette:{type:'ARRAY',items:{type:'STRING'}}}}}},{text:'{}',candidates:[]}],
  ]){
    const {store,config}=await setup({tickMs:10});const job=store.admit('owner','invalid-output','hash','content',input);
    const w=worker(store,config,{async content(){return result;}},{},()=>{});
    try{await until(()=>store.get('SELECT status FROM jobs WHERE id=?',job.id).status==='failed');assert.equal(store.get('SELECT error_code FROM jobs WHERE id=?',job.id).error_code,'INVALID_OUTPUT');}
    finally{await w.stop();store.db.close();}
  }
});
test('zero-quota failure pauses provider without wasting retries or starting queued work',async()=>{
  const {store,config,enqueue}=await setup({tickMs:10});const first=enqueue(),second=enqueue('second-key');let calls=0;
  const w=worker(store,config,{async content(){calls++;throw Object.assign(Error('free_tier quota limit: 0'),{status:429});}},{},()=>{});
  try{
    await until(()=>store.get('SELECT status FROM jobs WHERE id=?',first.id).status==='failed');await delay(100);
    assert.equal(calls,1);assert.equal(store.get('SELECT status FROM jobs WHERE id=?',second.id).status,'queued');
    assert.equal(store.get('SELECT error_code FROM jobs WHERE id=?',first.id).error_code,'PROVIDER_QUOTA');
    assert.throws(()=>enqueue('third-key'),e=>e.code==='PROVIDER_PAUSED');
    assert.equal(store.admit('owner',first.key,'hash','content',{model:'test'}).id,first.id);
  }finally{await w.stop();store.db.close();}
});
test('memory reservations limit aggregate work even when worker count allows more',async()=>{
  const {store,config,enqueue}=await setup({concurrency:2,memoryBudget:200*1024*1024,tickMs:10});let running=0,peak=0;
  const first=enqueue(),second=enqueue('memory-second');
  const w=worker(store,config,{async content(){running++;peak=Math.max(peak,running);await delay(50);running--;return {text:'ok',candidates:[]};}},{},()=>{});
  try{await until(()=>store.get('SELECT status FROM jobs WHERE id=?',first.id).status==='succeeded'&&store.get('SELECT status FROM jobs WHERE id=?',second.id).status==='succeeded');assert.equal(peak,1);}
  finally{await w.stop();store.db.close();}
});
test('two worker managers share the database concurrency cap',async()=>{
  const {store,config,enqueue}=await setup({concurrency:1,tickMs:10});let running=0,peak=0;
  const a=enqueue(),b=enqueue('shared-second');const provider={async content(){running++;peak=Math.max(peak,running);await delay(50);running--;return {text:'ok',candidates:[]};}};
  const w1=worker(store,config,provider,{},()=>{}),w2=worker(store,config,provider,{},()=>{});
  try{await until(()=>store.get("SELECT count(*) n FROM jobs WHERE status='succeeded'").n===2);assert.equal(peak,1);}
  finally{await w1.stop();await w2.stop();store.db.close();}
});
test('schema upgrades are idempotent and backfill existing asset relationships',async()=>{
  const {store,config}=await setup();const now=Date.now(),asset='12345678-1234-1234-1234-123456789abc';
  store.run('INSERT INTO assets(id,owner,mime,size,created) VALUES(?,?,?,?,?)',asset,'owner','image/png',12,now);
  store.run('INSERT INTO documents VALUES(?,?,?,?,?)','owner','projects','old',JSON.stringify({image:'/assets/'+asset}),1);
  store.db.exec('DROP TABLE asset_references; DROP TABLE job_assets; PRAGMA user_version=2');store.db.close();
  const migrated=openStore(config);
  try{assert.equal(migrated.get('PRAGMA user_version').user_version,5);assert.equal(migrated.get('SELECT asset_id FROM asset_references').asset_id,asset);}
  finally{migrated.db.close();}
  const reopened=openStore(config);try{assert.equal(reopened.get('SELECT count(*) n FROM asset_references').n,1);}finally{reopened.db.close();}
});
test('RSS admission guard pauses queued work without failing accepted jobs',async()=>{
  const {store,config,enqueue}=await setup({maxRss:1,tickMs:10});const job=enqueue();let calls=0;
  const w=worker(store,config,{async content(){calls++;return {text:'ok',candidates:[]};}},{},()=>{});
  try{await delay(80);assert.equal(calls,0);assert.equal(store.get('SELECT status FROM jobs WHERE id=?',job.id).status,'queued');}
  finally{await w.stop();store.db.close();}
});
test('durable usage reservations stop work before the configured daily unit budget is exceeded',async()=>{
  const {store,config,enqueue}=await setup({dailyBudgetUnits:1,tickMs:10});const a=enqueue(),b=enqueue('budget-second');let calls=0;
  const w=worker(store,config,{async content(){calls++;return {text:'ok',candidates:[],usage:{totalTokenCount:7}};}},{},()=>{});
  try{await until(()=>store.get('SELECT status FROM jobs WHERE id=?',b.id).status==='failed');assert.equal(calls,1);assert.equal(store.get('SELECT error_code FROM jobs WHERE id=?',b.id).error_code,'SPEND_BUDGET');const ledger=store.get('SELECT * FROM usage_ledger WHERE job_id=?',a.id);assert.equal(ledger.status,'completed');assert.equal(JSON.parse(ledger.actual_usage).totalTokenCount,7);}
  finally{await w.stop();store.db.close();}
});
