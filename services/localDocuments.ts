import {localRequest,ApiError,uploadAsset,sessionScope,getSessionOwner} from './localApi';
import {journalEntries,journalPut,journalRemove,JournalEntry} from './browserJournal';
const revisions=new Map<string,number>(),writes=new Map<string,Promise<void>>();
window.addEventListener('formlab:session',()=>{revisions.clear();writes.clear();});
const route=(collection:string,id?:string)=>`/api/documents/${encodeURIComponent(collection)}${id?`/${encodeURIComponent(id)}`:''}`;
const network=(e:any)=>e instanceof TypeError||e?.name==='TimeoutError';
const notify=(state:string)=>window.dispatchEvent(new CustomEvent('formlab:save',{detail:state}));
export async function readDocument<T>(collection:string,id:string):Promise<T|null>{
  const path=route(collection,id),scope=sessionScope();
  try{
    const result=await localRequest<{value:T;revision:number}>(path);scope.assert();
    revisions.set(path,result.revision);
    if(scope.owner)await journalPut({owner:scope.owner,kind:'cache',id:path,path,value:result.value,revision:result.revision,created:Date.now()});
    scope.assert();return result.value;
  }catch(error){
    scope.assert();
    if(error instanceof ApiError&&error.status===404){revisions.set(path,0);if(scope.owner)await journalRemove(scope.owner,'cache',path);return null;}
    if(network(error)&&scope.owner){const cached=(await journalEntries(scope.owner,'cache')).find(e=>e.path===path);scope.assert();if(cached){revisions.set(path,cached.revision!);notify('offline');return cached.value;}}
    throw error;
  }
}
async function captureMedia(value:any,scope:ReturnType<typeof sessionScope>):Promise<any>{
  scope.assert();
  if(value instanceof Blob)return value;
  if(typeof value==='string'&&/^(data:(image|video)\/|blob:)/.test(value)){const blob=await (await fetch(value,{signal:scope.signal})).blob();scope.assert();return blob;}
  if(Array.isArray(value)){const result=[];for(const item of value)result.push(await captureMedia(item,scope));return result;}
  if(value&&typeof value==='object'){const result:Record<string,any>={};for(const [key,item]of Object.entries(value))result[key]=await captureMedia(item,scope);return result;}
  return value;
}
async function persistMedia(value:any,scope:ReturnType<typeof sessionScope>):Promise<any>{
  scope.assert();
  if(value instanceof Blob){const asset=await uploadAsset(value);scope.assert();return asset.url;}
  if(Array.isArray(value)){const result=[];for(const item of value)result.push(await persistMedia(item,scope));return result;}
  if(value&&typeof value==='object'){const result:Record<string,any>={};for(const [key,item]of Object.entries(value))result[key]=await persistMedia(item,scope);return result;}
  return value;
}
async function sendSave(entry:JournalEntry,scope:ReturnType<typeof sessionScope>){
  scope.assert();if(scope.owner!==entry.owner)throw new DOMException('Wrong recovery owner','AbortError');
  if(entry.revision===null||entry.revision===undefined){entry.status='conflict';entry.error='No known base revision. Reload and resolve this edit.';await journalPut(entry);throw new ApiError(entry.error,409,'BASE_REVISION_REQUIRED');}
  // Persist the normalized asset IDs before the mutation; a dropped response reuses both IDs and key.
  const value=await persistMedia(entry.value,scope);scope.assert();entry.value=value;await journalPut(entry);scope.assert();
  const result=await localRequest<{revision:number}>(entry.path!,{method:'PUT',signal:scope.signal,body:JSON.stringify({value,revision:entry.revision,mutationId:entry.id})});scope.assert();
  revisions.set(entry.path!,result.revision);
  await journalPut({owner:entry.owner,kind:'cache',id:entry.path!,path:entry.path,value,revision:result.revision,created:Date.now()});
  await journalRemove(entry.owner,'save',entry.id);notify('saved');
}
export async function writeDocument(collection:string,id:string,value:unknown):Promise<void>{
  const scope=sessionScope(),path=route(collection,id),snapshot=structuredClone(value);
  if(!scope.owner)throw new ApiError('Sign in before saving',401,'AUTH_REQUIRED');
  const operation=(writes.get(path)||Promise.resolve()).catch(()=>{}).then(async()=>{
    scope.assert();notify('saving');
    if(!revisions.has(path)){
      try{await readDocument(collection,id);}catch(error){if(!network(error))throw error;}
    }
    scope.assert();
    const entry:JournalEntry={owner:scope.owner!,kind:'save',id:crypto.randomUUID(),path,value:await captureMedia(snapshot,scope),revision:revisions.get(path)??null,status:'pending',created:Date.now(),attempts:0};
    scope.assert();await journalPut(entry);scope.assert();
    try{await sendSave(entry,scope);}
    catch(error){scope.assert();entry.status=error instanceof ApiError&&error.status===409?'conflict':'pending';entry.error=error instanceof ApiError?error.code:'NETWORK_UNAVAILABLE';await journalPut(entry);notify(entry.status==='conflict'?'conflict':'pending');throw error;}
  });
  writes.set(path,operation);try{await operation;}finally{if(writes.get(path)===operation)writes.delete(path);}
}
let flushing=false;
export async function flushPendingSaves(){
  if(flushing)return;const scope=sessionScope();if(!scope.owner)return;flushing=true;
  try{
    const blocked=new Set<string>();
    for(const entry of await journalEntries(scope.owner,'save')){
      scope.assert();if(blocked.has(entry.path!)||entry.status!=='pending'||(entry.nextTry||0)>Date.now()){blocked.add(entry.path!);continue;}
      try{await sendSave(entry,scope);}catch(error){scope.assert();entry.attempts=(entry.attempts||0)+1;entry.status=error instanceof ApiError&&error.status===409?'conflict':error instanceof ApiError&&error.status<500?'blocked':'pending';entry.nextTry=Date.now()+Math.min(60000,1000*2**Math.min(entry.attempts,6));entry.error=error instanceof ApiError?error.code:'NETWORK_UNAVAILABLE';await journalPut(entry);blocked.add(entry.path!);notify(entry.status);}
    }
  }finally{flushing=false;}
}
export async function pendingSaves(){const owner=getSessionOwner();return owner?journalEntries(owner,'save'):[];}
export async function discardPendingSave(id:string){const owner=getSessionOwner();if(owner)await journalRemove(owner,'save',id);}
for(const event of ['online','formlab:session','formlab:recovery'])window.addEventListener(event,()=>{void flushPendingSaves().catch(()=>{});});
setInterval(()=>{void flushPendingSaves().catch(()=>{});},15000);
export async function listDocuments<T>(collection:string):Promise<T[]>{
  const scope=sessionScope(),values:T[]=[];let offset:number|null=0;
  while(offset!==null){const result:{documents:{value:T;revision:number}[];nextOffset:number|null}=await localRequest(`${route(collection)}?offset=${offset}`);scope.assert();values.push(...result.documents.map(item=>item.value));offset=result.nextOffset;}
  return values;
}
export async function removeDocument(collection:string,id:string){
  const scope=sessionScope(),path=route(collection,id);
  if(scope.owner&&(await journalEntries(scope.owner,'save')).some(e=>e.path===path))throw new ApiError('Resolve pending edits before deleting',409,'PENDING_EDITS');
  scope.assert();await localRequest(path,{method:'DELETE'});scope.assert();revisions.delete(path);if(scope.owner)await journalRemove(scope.owner,'cache',path);
}
export async function deleteProjectHistory(projectId:string,historyId:string){
  const scope=sessionScope();await localRequest(`/api/projects/${encodeURIComponent(projectId)}/history/${encodeURIComponent(historyId)}`,{method:'DELETE'});scope.assert();
  revisions.delete(route('project-state',projectId));return readDocument<any>('project-state',projectId);
}
