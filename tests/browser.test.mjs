import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {IDBFactory} from 'fake-indexeddb';
import {webcrypto} from 'node:crypto';

function environment(fetch,database=new IDBFactory(),owner='alice') {
  const window=new EventTarget();window.location={href:'http://localhost:3017/'};
  const modules=new Map();
  const load=name=>{
    if(name==='./runtimeConfig')return {runtimeConfig:{apiBaseUrl:''}};
    if(modules.has(name))return modules.get(name);
    const code=ts.transpileModule(readFileSync(`services/${name.slice(2)}.ts`,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
    const exports={};modules.set(name,exports);
    vm.runInNewContext(code,{exports,require:load,window,fetch,AbortController,AbortSignal,DOMException,Event,CustomEvent,URL,Blob,Map,Promise,TypeError,structuredClone,console,indexedDB:database,TextEncoder,Uint8Array,crypto:webcrypto,setTimeout,clearTimeout,setInterval:()=>0});
    return exports;
  };
  load('./localApi').setSessionOwner(owner);return {window,load};
}
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json'}});
test('pending document read cannot cause an old save under a new session',async()=>{
  let release,puts=0;
  const pending=new Promise(resolve=>release=resolve);
  const env=environment(async(path,init)=>{if(init.method==='PUT'){puts++;return json({revision:1});}return pending;});
  const docs=env.load('./localDocuments');
  const operation=docs.writeDocument('projects','one',{secret:'old account'});
  const rejected=assert.rejects(operation,e=>e.name==='AbortError');
  await new Promise(resolve=>setTimeout(resolve,10));
  env.window.dispatchEvent(new Event('formlab:session'));release(json({value:{},revision:0}));
  await rejected;assert.equal(puts,0);
});
test('dropped generation response is reconciled with the same key after reload',async()=>{
  const database=new IDBFactory();let admittedKey=null,posts=0;
  const fetch=async(path,init)=>{
    if(path.startsWith('/api/jobs/by-key/'))return admittedKey?json({id:'job-one',status:'processing'}):json({code:'JOB_NOT_FOUND'},404);
    posts++;admittedKey=init.headers['x-idempotency-key'];throw new TypeError('response lost after admission');
  };
  const first=environment(fetch,database).load('./aiGateway');
  await assert.rejects(first.submitGeneration('/api/ai/generate-content',{model:'test',contents:'same operation'}),/saved locally/);
  const reloaded=environment(fetch,database).load('./aiGateway');
  assert.equal((await reloaded.submitGeneration('/api/ai/generate-content',{contents:'same operation',model:'test'})).jobId,'job-one');
  assert.equal(posts,1);assert.equal((await reloaded.pendingGenerationCommands()).length,1);
  assert.equal((await environment(fetch,database,'bob').load('./aiGateway').pendingGenerationCommands()).length,0);
});
test('offline save survives module reload and retries its frozen revision and mutation identity',async()=>{
  const database=new IDBFactory();let online=true,mutationId,puts=0;
  const fetch=async(path,init)=>{
    if(!online)throw new TypeError('offline');
    if(init.method==='PUT'){puts++;const value=JSON.parse(init.body);mutationId=value.mutationId;assert.equal(value.revision,3);return json({revision:4});}
    return json({value:{name:'old'},revision:3});
  };
  const first=environment(fetch,database).load('./localDocuments');await first.readDocument('projects','one');online=false;
  await assert.rejects(first.writeDocument('projects','one',{name:'offline change'}));
  const pending=await first.pendingSaves();assert.equal(pending.length,1);
  const reloaded=environment(fetch,database).load('./localDocuments');online=true;await reloaded.flushPendingSaves();
  assert.equal(puts,1);assert.equal(mutationId,pending[0].id);assert.equal((await reloaded.pendingSaves()).length,0);
});
test('offline conflict remains visible and is never silently rebased or replayed under another owner',async()=>{
  const database=new IDBFactory();let online=true,puts=0;
  const fetch=async(path,init)=>{
    if(!online)throw new TypeError('offline');
    if(init.method==='PUT'){puts++;return json({error:'conflict',code:'REVISION_CONFLICT'},409);}
    return json({value:{name:'old'},revision:1});
  };
  const first=environment(fetch,database).load('./localDocuments');await first.readDocument('projects','one');online=false;
  await assert.rejects(first.writeDocument('projects','one',{name:'pending Alice'}));online=true;
  await environment(fetch,database,'bob').load('./localDocuments').flushPendingSaves();assert.equal(puts,0);
  const reloaded=environment(fetch,database).load('./localDocuments');await reloaded.flushPendingSaves();await reloaded.flushPendingSaves();
  assert.equal(puts,1);assert.equal((await reloaded.pendingSaves())[0].status,'conflict');assert.equal((await reloaded.pendingSaves())[0].revision,1);
});
test('offline media blobs survive reload and are replaced with stable asset URLs before replay',async()=>{
  const database=new IDBFactory();let online=true,stored=null;
  const fetch=async(path,init)=>{
    if(!online)throw new TypeError('offline');
    if(path.startsWith('/api/assets/by-key/'))return json({code:'ASSET_NOT_FOUND'},404);
    if(path==='/api/assets')return json({id:'asset-one',url:'/assets/asset-one'});
    if(init.method==='PUT'){stored=JSON.parse(init.body);return json({revision:2});}
    return json({value:{},revision:1});
  };
  const first=environment(fetch,database).load('./localDocuments');await first.readDocument('projects','media');online=false;
  await assert.rejects(first.writeDocument('projects','media',{image:new Blob(['fixture'],{type:'image/png'})}));
  assert.equal((await first.pendingSaves())[0].value.image.size,7);
  online=true;await environment(fetch,database).load('./localDocuments').flushPendingSaves();assert.equal(stored.value.image,'/assets/asset-one');
});
test('queued uploads from a previous session never start after account switch',async()=>{
  let release,calls=0;
  const pending=new Promise(resolve=>release=resolve);
  const env=environment(async()=>{calls++;return pending;});const api=env.load('./localApi');
  const a=api.uploadAsset(new Blob(['one'],{type:'image/png'})),b=api.uploadAsset(new Blob(['two'],{type:'image/png'}));
  const rejected=Promise.all([assert.rejects(a,e=>e.name==='AbortError'),assert.rejects(b,e=>e.name==='AbortError')]);
  await new Promise(resolve=>setTimeout(resolve,10));env.window.dispatchEvent(new Event('formlab:session'));release(json({id:'asset',url:'/assets/asset'}));
  await rejected;assert.equal(calls,1);
});
test('credentials are included only for trusted protected media',()=>{
  const {load}=environment(()=>{}),api=load('./localApi');
  const id='12345678-1234-1234-1234-123456789abc';
  assert.equal(api.localAssetId('/assets/'+id),id);
  assert.equal(api.mediaFetchOptions('/assets/'+id).credentials,'include');
  assert.equal(api.mediaFetchOptions('https://evil.example/assets/'+id).credentials,'omit');
  assert.equal(api.localAssetId('https://evil.example/assets/'+id),null);
});
