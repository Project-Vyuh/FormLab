import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import http from 'node:http';
const directory=await mkdtemp(join(tmpdir(),'formlab-test-'));
const port=18800+Math.floor(Math.random()*1000),base=`http://127.0.0.1:${port}`;
let processHandle,logs='',alice,bob;
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function start(){
  processHandle=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,FORMLAB_API_PORT:String(port),FORMLAB_DATA_DIR:directory,FORMLAB_AI_PROVIDER:'fake',FORMLAB_ALLOW_REGISTRATION:'true',FORMLAB_VIDEO_ENABLED:'true',FORMLAB_FAKE_DELAY_MS:'300',FORMLAB_DAILY_JOB_LIMIT:'100',FORMLAB_MAX_ASSET_BYTES:'1048576',GEMINI_API_KEY:''},stdio:['ignore','pipe','pipe']});
  processHandle.stdout.on('data',data=>logs+=data);processHandle.stderr.on('data',data=>logs+=data);
  for(let i=0;i<100;i++){if(processHandle.exitCode!==null)throw Error(logs);try{const r=await fetch(`${base}/api/health`);if(r.ok)return;}catch{}await pause(30);}throw Error(`Server start timeout: ${logs}`);
}
async function stop(signal='SIGTERM'){const child=processHandle;if(!child||child.exitCode!==null)return;await new Promise(resolve=>{child.once('exit',resolve);child.kill(signal);});}
async function api(path,{cookie,method='GET',value,body,headers={}}={}){
  const r=await fetch(base+path,{method,headers:{'x-formlab-client':'web',...(cookie?{cookie}:{}),...(value!==undefined?{'content-type':'application/json'}:{}),...headers},body:value!==undefined?JSON.stringify(value):body});
  const payload=await r.json().catch(()=>null);return {status:r.status,payload,headers:r.headers};
}
async function register(email){const r=await api('/api/auth/register',{method:'POST',value:{email,password:'correct horse battery staple',displayName:email}});assert.equal(r.status,201,JSON.stringify(r.payload));return r.headers.get('set-cookie').split(';')[0];}
async function submit(cookie,input={model:'gemini-2.5-flash',contents:'hello'},key=randomUUID(),endpoint='content'){
  return api(`/api/ai/generate-${endpoint}`,{cookie,method:'POST',headers:{'x-idempotency-key':key},value:input});
}
async function complete(id,cookie=alice){for(let i=0;i<120;i++){const r=await api(`/api/jobs/${id}`,{cookie});assert.equal(r.status,200);if(['succeeded','failed','cancelled'].includes(r.payload.status))return r.payload;await pause(50);}throw Error('Job timeout');}
test.before(async()=>{await start();alice=await register('alice@example.com');bob=await register('bob@example.com');});
test.after(async()=>{await stop();});

test('health and readiness do not need Firebase or Gemini',async()=>{
  assert.equal((await api('/api/ready')).payload.database,'sqlite');
  assert.equal((await api('/api/health')).payload.provider,'fake');
});
test('anonymous API access denied and origin/host enforced',async()=>{
  assert.equal((await api('/api/jobs')).status,401);
  assert.equal((await api('/api/jobs',{cookie:alice,headers:{origin:'https://evil.example'}})).status,403);
  const hostStatus=await new Promise((resolve,reject)=>{const req=http.get(base+'/api/jobs',{headers:{host:`evil.example:${port}`,cookie:alice}},res=>{res.resume();resolve(res.statusCode);});req.on('error',reject);});
  assert.equal(hostStatus,403);
  const allowed=await api('/api/jobs',{cookie:alice,headers:{origin:'http://127.0.0.1:3000'}});assert.equal(allowed.status,200);assert.equal(allowed.headers.get('access-control-allow-credentials'),'true');
});
test('password hashes and session hashes are persisted, not plaintext',async()=>{
  const db=new DatabaseSync(join(directory,'formlab.sqlite'));const user=db.prepare('SELECT password FROM users LIMIT 1').get();const session=db.prepare('SELECT hash FROM sessions LIMIT 1').get();db.close();
  assert.ok(user.password.includes(':'));assert.ok(!user.password.includes('correct horse'));assert.equal(session.hash.length,64);assert.ok(!alice.includes(session.hash));
  const login=await api('/api/auth/login',{method:'POST',value:{email:'alice@example.com',password:'wrong'}});assert.equal(login.status,401);
  const success=await api('/api/auth/login',{method:'POST',value:{email:'alice@example.com',password:'correct horse battery staple'}});assert.equal(success.status,200);assert.match(success.headers.get('set-cookie'),/HttpOnly/);assert.match(success.headers.get('set-cookie'),/SameSite=Strict/);
});
test('async content request is durable and owner scoped',async()=>{
  const r=await submit(alice);assert.equal(r.status,202);assert.equal((await api(`/api/jobs/${r.payload.jobId}`,{cookie:bob})).status,404);
  const job=await complete(r.payload.jobId);assert.equal(job.status,'succeeded');assert.match(job.response.text,/Fake provider/);
});
test('concurrent idempotency key executes one logical job; mismatch is 409',async()=>{
  const key=randomUUID(),input={model:'gemini-2.5-flash',contents:'concurrent'};
  const results=await Promise.all(Array.from({length:5},()=>submit(alice,input,key)));
  assert.ok(results.every(r=>r.status===202));assert.equal(new Set(results.map(r=>r.payload.jobId)).size,1);
  const job=await complete(results[0].payload.jobId);assert.equal(job.attempt,1);
  assert.equal((await submit(alice,{...input,contents:'changed'},key)).status,409);
});
test('rejects traversal key, arbitrary models, inline media and malformed JSON',async()=>{
  assert.equal((await submit(alice,undefined,'../../escaped')).status,400);
  assert.equal((await submit(alice,{model:'arbitrary',contents:'hello'})).status,400);
  assert.equal((await submit(alice,{model:'gemini-2.5-flash',contents:[{inlineData:{mimeType:'image/png',data:'abc'}}]})).status,400);
  assert.equal((await api('/api/ai/generate-content',{cookie:alice,method:'POST',body:'{broken',headers:{'content-type':'application/json','x-idempotency-key':randomUUID()}})).status,400);
});
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXioAAAAASUVORK5CYII=','base64');
test('binary media validation, range serving, ownership and deletion',async()=>{
  const bad=await api('/api/assets',{cookie:alice,method:'POST',body:Buffer.from('not an image'),headers:{'content-type':'image/png'}});assert.equal(bad.status,400);
  const r=await api('/api/assets',{cookie:alice,method:'POST',body:png,headers:{'content-type':'image/png'}});assert.equal(r.status,201,JSON.stringify(r.payload));
  const path=r.payload.url;
  assert.equal((await fetch(base+path,{headers:{cookie:bob}})).status,404);
  const range=await fetch(base+path,{headers:{cookie:alice,range:'bytes=0-7'}});assert.equal(range.status,206);assert.deepEqual(Buffer.from(await range.arrayBuffer()),png.subarray(0,8));
  assert.equal((await fetch(base+path,{headers:{cookie:alice,range:'bytes=999-'}})).status,416);
  assert.equal((await api(`/api${path}`,{cookie:bob,method:'DELETE'})).status,404);
  assert.equal((await api(`/api${path}`,{cookie:alice,method:'DELETE'})).status,200);
  assert.equal((await fetch(base+path,{headers:{cookie:alice}})).status,404);
});
test('generated image stored as asset reference rather than inline base64 JSON',async()=>{
  const r=await submit(alice,{model:'gemini-2.5-flash-image',contents:'image fixture',config:{responseModalities:['IMAGE']}});
  const job=await complete(r.payload.jobId);assert.equal(job.status,'succeeded',JSON.stringify(job));
  const part=job.response.candidates[0].content.parts[0];assert.ok(part.fileData.fileUri.startsWith('/assets/'));assert.equal(part.inlineData,undefined);
  assert.equal((await fetch(base+part.fileData.fileUri,{headers:{cookie:alice}})).status,200);
  assert.equal((await api(`/api${part.fileData.fileUri}`,{cookie:alice,method:'DELETE'})).status,409);
  const db=new DatabaseSync(join(directory,'formlab.sqlite'));
  try{assert.equal(db.prepare("SELECT count(*) n FROM job_assets WHERE job_id=? AND role='output'").get(job.id).n,1);}
  finally{db.close();}
});
test('relational references prevent cross-owner links and preserve shared assets',async()=>{
  const upload=await api('/api/assets',{cookie:alice,method:'POST',body:png,headers:{'content-type':'image/png'}});
  const asset=upload.payload,id=asset.id;
  assert.equal((await api('/api/documents/projects/foreign-absolute',{cookie:bob,method:'PUT',value:{value:{image:base+asset.url},revision:0}})).status,404);
  for(const document of ['share-one','share-two'])assert.equal((await api('/api/documents/projects/'+document,{cookie:alice,method:'PUT',value:{value:{image:asset.url},revision:0}})).status,200);
  const db=new DatabaseSync(join(directory,'formlab.sqlite'));db.exec('PRAGMA foreign_keys=ON');
  try{
    assert.equal(db.prepare('SELECT count(*) n FROM asset_references WHERE asset_id=?').get(id).n,2);
    const owner=db.prepare('SELECT id FROM users WHERE email=?').get('bob@example.com').id;
    db.prepare('INSERT INTO documents VALUES(?,?,?,?,?)').run(owner,'projects','cross-owner','{}',1);
    assert.throws(()=>db.prepare('INSERT INTO asset_references VALUES(?,?,?,?)').run(owner,'projects','cross-owner',id),/FOREIGN KEY/);
  }finally{db.close();}
  await api('/api/documents/projects/share-one',{cookie:alice,method:'DELETE'});
  assert.equal((await api('/api'+asset.url,{cookie:alice,method:'DELETE'})).status,409);
  await api('/api/documents/projects/share-two',{cookie:alice,method:'DELETE'});
  assert.equal((await api('/api'+asset.url,{cookie:alice,method:'DELETE'})).status,200);
});
test('ambiguous submission is recoverable by owner-scoped idempotency key',async()=>{
  const key=randomUUID(),r=await submit(alice,{model:'gemini-2.5-flash',contents:'recover'},key);
  assert.equal((await api('/api/jobs/by-key/'+key,{cookie:alice})).payload.id,r.payload.jobId);
  assert.equal((await api('/api/jobs/by-key/'+key,{cookie:bob})).status,404);
  await complete(r.payload.jobId);
});
test('API and queue logs correlate without leaking concrete URL identifiers',async()=>{
  const r=await submit(alice);const responseId=r.headers.get('x-request-id');await complete(r.payload.jobId);await pause(30);
  const entries=logs.split('\n').filter(line=>line.startsWith('{')).map(line=>JSON.parse(line));
  assert.ok(entries.some(e=>e.event==='http_request'&&e.requestId===responseId&&e.jobId===r.payload.jobId&&e.route==='/api/ai/generate-content'));
  assert.ok(entries.some(e=>e.event==='job_started'&&e.requestId===responseId&&e.jobId===r.payload.jobId&&e.attemptId));
  assert.ok(entries.some(e=>e.event==='http_request'&&e.route==='/api/jobs/:id'));
});
test('job history is paginated and excludes private queue payloads',async()=>{
  const r=await api('/api/jobs',{cookie:alice});assert.ok(r.payload.jobs.length<=25);
  assert.ok(r.payload.jobs.every(job=>!('input' in job)&&!('operation' in job)&&!('claim_token' in job)));
  assert.equal((await api('/api/jobs?offset=-1',{cookie:alice})).status,400);
});
test('generated image is attached to the project without any browser completion save',async()=>{
  const project='durable-workflow';await api('/api/documents/project-state/'+project,{cookie:alice,method:'PUT',value:{value:{id:project,generatedModelHistory:[]},revision:0}});
  const key=randomUUID(),input={model:'gemini-2.5-flash-image',contents:'image fixture',config:{responseModalities:['IMAGE']},attachment:{projectId:project,history:{id:'durable-model',parentId:null,baseModelId:'durable-model',type:'model-generation',prompt:'model',modelName:'test',settings:{aspectRatio:'2:3'}}}};
  const response=await submit(alice,input,key);assert.equal(response.status,202);await pause(750);
  const saved=(await api('/api/documents/project-state/'+project,{cookie:alice})).payload.value;
  assert.equal(saved.generatedModelHistory.length,1);assert.ok(saved.generatedModelHistory[0].imageUrl.startsWith('/assets/'));
  assert.equal((await submit(alice,input,key)).payload.jobId,response.payload.jobId);
  assert.equal((await api('/api/documents/project-state/'+project,{cookie:alice})).payload.value.generatedModelHistory.length,1);
  assert.equal((await submit(bob,input)).status,404);
  const stale=(await api('/api/documents/project-state/'+project,{cookie:alice})).payload;
  assert.equal((await api('/api/documents/project-state/'+project,{cookie:alice,method:'PUT',value:{revision:stale.revision,value:{...stale.value,generatedModelHistory:[]}}})).status,200);
  assert.equal((await api('/api/documents/project-state/'+project,{cookie:alice})).payload.value.generatedModelHistory.length,1,'Delayed autosave must not erase delivered history');
  assert.equal((await api(`/api/projects/${project}/history/durable-model`,{cookie:alice,method:'DELETE'})).status,200);
  assert.equal((await api('/api/documents/project-state/'+project,{cookie:alice})).payload.value.generatedModelHistory.length,0,'Explicit deletion must not resurrect delivered history');
});
test('document mutation receipt makes a lost acknowledgment safe to replay',async()=>{
  const path='/api/documents/projects/mutation-test',mutationId=randomUUID(),value={value:{name:'once'},revision:0,mutationId};
  assert.equal((await api(path,{cookie:alice,method:'PUT',value})).payload.revision,1);
  assert.equal((await api(path,{cookie:alice,method:'PUT',value})).payload.revision,1);
  assert.equal((await api(path,{cookie:alice,method:'PUT',value:{...value,value:{name:'changed'}}})).status,409);
});
test('try-on and composite outputs use their correct durable project history locations',async()=>{
  for(const type of ['try-on','composite-generation']){
    const project='delivery-'+type;await api('/api/documents/project-state/'+project,{cookie:alice,method:'PUT',value:{value:{id:project},revision:0}});
    const input={model:'gemini-2.5-flash-image',contents:'fixture',config:{responseModalities:['IMAGE']},attachment:{projectId:project,history:{id:'history-'+type,parentId:null,baseModelId:'base-model',type,prompt:type,modelName:'test',settings:{}}}};
    const r=await submit(alice,input);assert.equal(r.status,202);assert.equal((await complete(r.payload.jobId)).status,'succeeded');
    const state=(await api('/api/documents/project-state/'+project,{cookie:alice})).payload.value;
    assert.equal(type==='try-on'?state.stylingHistory['base-model'].length:state.compositeHistory.length,1);
  }
});
test('content-addressed uploads reuse an owned asset and cannot be looked up cross-owner',async()=>{
  const {createHash}=await import('node:crypto');const key=createHash('sha256').update(png).digest('hex');
  const first=await api('/api/assets',{cookie:alice,method:'POST',body:png,headers:{'content-type':'image/png','x-idempotency-key':key}});
  assert.equal(first.status,201);assert.equal((await api('/api/assets/by-key/'+key,{cookie:alice})).payload.id,first.payload.id);
  assert.equal((await api('/api/assets/by-key/'+key,{cookie:bob})).status,404);
});
test('capabilities, local alerts and usage ledger expose only the documented local contract',async()=>{
  assert.deepEqual((await api('/api/capabilities')).payload.imageSizes,['1K','2K']);
  const usage=await api('/api/usage',{cookie:alice});assert.equal(usage.status,200);assert.ok(usage.payload.attempts.length>0);assert.match(usage.payload.unitDefinition,/not currency/);
  assert.equal((await api('/api/alerts',{cookie:alice})).status,200);assert.equal((await api('/api/usage')).status,401);
});
test('request and media byte limits return 413 without breaking the API',async()=>{
  const tooLarge=await submit(alice,{model:'gemini-2.5-flash',contents:'x'.repeat(300000)});assert.equal(tooLarge.status,413);
  const media=await api('/api/assets',{cookie:alice,method:'POST',body:Buffer.alloc(2*1024*1024),headers:{'content-type':'image/png'}});assert.equal(media.status,413);
  assert.equal((await api('/api/health')).status,200);
});
test('versioned document writes isolate users and reject stale saves and inline media',async()=>{
  const path='/api/documents/project-state/test-project';
  assert.equal((await api(path,{cookie:alice,method:'PUT',value:{value:{name:'project'},revision:0}})).status,200);
  assert.equal((await api(path,{cookie:bob})).status,404);
  assert.equal((await api(path,{cookie:alice,method:'PUT',value:{value:{name:'stale'},revision:0}})).status,409);
  assert.equal((await api(path,{cookie:alice,method:'PUT',value:{value:{image:'data:image/png;base64,abc'},revision:1}})).status,400);
  assert.equal((await api(path,{cookie:alice})).payload.value.name,'project');
});
test('cancelled job remains terminal even if provider completes',async()=>{
  const r=await submit(alice);const id=r.payload.jobId;
  assert.equal((await api(`/api/jobs/${id}/cancel`,{cookie:alice,method:'POST'})).payload.status,'cancelled');
  await pause(450);assert.equal((await api(`/api/jobs/${id}`,{cookie:alice})).payload.status,'cancelled');
});
test('video fake lifecycle uses authorized stored image',async()=>{
  await api('/api/documents/project-state/video-project',{cookie:alice,method:'PUT',value:{value:{id:'video-project'},revision:0}});
  const asset=await api('/api/assets',{cookie:alice,method:'POST',body:png,headers:{'content-type':'image/png'}});
  const r=await submit(alice,{model:'veo-3.1-fast-generate-preview',prompt:'animate',image:{assetId:asset.payload.id},config:{numberOfVideos:1},attachment:{projectId:'video-project',history:{id:'video-history',type:'video-generation',parentId:null,baseModelId:'video-history',prompt:'animate',modelName:'video',settings:{}}}},randomUUID(),'video');
  assert.equal(r.status,202);const job=await complete(r.payload.jobId);assert.equal(job.status,'succeeded',JSON.stringify(job));assert.ok(job.outputUrl.startsWith('/assets/'));
  assert.equal((await api('/api/documents/project-state/video-project',{cookie:alice})).payload.value.videoHistory[0].videoUrl,job.outputUrl);
});
test('server restart preserves session, project and completed job',async()=>{
  const r=await submit(alice);await complete(r.payload.jobId);await stop();await start();
  assert.equal((await api('/api/auth/session',{cookie:alice})).payload.user.email,'alice@example.com');
  assert.equal((await api('/api/documents/project-state/test-project',{cookie:alice})).payload.value.name,'project');
  assert.equal((await api(`/api/jobs/${r.payload.jobId}`,{cookie:alice})).payload.status,'succeeded');
});
test('expired content lease fails without duplicate paid submission; saved video resumes',async()=>{
  await stop();const db=new DatabaseSync(join(directory,'formlab.sqlite'));
  const owner=db.prepare('SELECT id FROM users WHERE email=?').get('alice@example.com').id;
  const content=randomUUID(),video=randomUUID(),now=Date.now();
  const insert=db.prepare('INSERT INTO jobs(id,owner,key,hash,kind,input,status,created,updated,lease,operation) VALUES(?,?,?,?,?,?,?,?,?,?,?)');
  insert.run(content,owner,randomUUID(),'test','content','{}','processing',now,now,0,null);
  insert.run(video,owner,randomUUID(),'test','video',JSON.stringify({model:'veo-3.1-fast-generate-preview'}),'processing',now,now,0,JSON.stringify({name:'saved-operation'}));db.close();
  await start();assert.equal((await complete(content)).status,'failed');assert.equal((await complete(video)).status,'succeeded');
});
test('logout revokes cookie',async()=>{
  assert.equal((await api('/api/auth/logout',{cookie:bob,method:'POST'})).status,200);
  assert.equal((await api('/api/jobs',{cookie:bob})).status,401);
});
test('logs omit passwords, cookies and full payloads',()=>{
  assert.ok(!logs.includes('correct horse battery staple'));assert.ok(!logs.includes(alice));assert.ok(!logs.includes('image fixture'));
});
test('frontend config never injects provider key',async()=>{
  assert.doesNotMatch(await readFile('vite.config.ts','utf8'),/define:.*GEMINI_API_KEY/s);
});
test('offline backup copies a restorable SQLite database and every recorded media file',async()=>{
  await stop();
  const backup=join(await mkdtemp(join(tmpdir(),'formlab-backup-test-')),'snapshot');
  try{
    const result=await new Promise(resolve=>{
      const child=spawn(process.execPath,['scripts/data.mjs','backup',backup],{env:{...process.env,FORMLAB_API_PORT:String(port),FORMLAB_DATA_DIR:directory,FORMLAB_AI_PROVIDER:'fake',GEMINI_API_KEY:''},stdio:['ignore','pipe','pipe']});
      let output='';child.stdout.on('data',d=>output+=d);child.stderr.on('data',d=>output+=d);child.on('exit',code=>resolve({code,output}));
    });
    assert.equal(result.code,0,result.output);
    const db=new DatabaseSync(join(backup,'formlab.sqlite'),{readOnly:true});
    try{
      assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
      for(const asset of db.prepare('SELECT id,size FROM assets').all())assert.equal((await readFile(join(backup,'assets',asset.id))).length,asset.size);
    }finally{db.close();}
  }finally{await start();}
});
