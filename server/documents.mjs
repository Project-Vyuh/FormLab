import {assetIds} from './store.mjs';
import {problem,object} from './config.mjs';

// Caller owns the transaction, allowing job completion and document delivery to commit together.
export function putDocument(store,owner,collection,id,value,expected) {
  if(collection==='project-state')value=protectDeliveredHistory(store,owner,id,value);
  const serialized=JSON.stringify(value),references=assetIds(serialized);
  if(Buffer.byteLength(serialized)>2*1024*1024||/data:(image|video)\/|blob:/.test(serialized))throw problem(413,'DOCUMENT_LIMIT','Use owned asset URLs and documents smaller than 2 MiB');
  for(const asset of references)if(!store.get("SELECT id FROM assets WHERE owner=? AND id=? AND state='ready'",owner,asset))throw problem(404,'ASSET_NOT_FOUND','Asset not found');
  const old=store.get('SELECT revision,length(CAST(value AS BLOB)) bytes FROM documents WHERE owner=? AND collection=? AND id=?',owner,collection,id);
  if((old?.revision||0)!==expected)throw problem(409,'REVISION_CONFLICT','Document changed; reload or resolve the pending edit');
  const bytes=store.get('SELECT coalesce(sum(length(CAST(value AS BLOB))),0) n FROM documents WHERE owner=?',owner).n;
  if(bytes-(old?.bytes||0)+Buffer.byteLength(serialized)>50*1024*1024)throw problem(413,'DOCUMENT_STORAGE_LIMIT','Project metadata allowance reached');
  const revision=expected+1;
  store.run('INSERT INTO documents VALUES(?,?,?,?,?) ON CONFLICT(owner,collection,id) DO UPDATE SET value=excluded.value,revision=excluded.revision',owner,collection,id,serialized,revision);
  store.run('DELETE FROM asset_references WHERE owner=? AND collection=? AND document_id=?',owner,collection,id);
  for(const asset of references)store.run('INSERT INTO asset_references VALUES(?,?,?,?)',owner,collection,id,asset);
  return revision;
}
export function protectDeliveredHistory(store,owner,projectId,value){
  if(!value||typeof value!=='object'||Array.isArray(value))throw problem(400,'INVALID_PROJECT','Project state must be an object');
  const state=structuredClone(value),deleted=new Set(store.all('SELECT history_id FROM history_tombstones WHERE owner=? AND project_id=?',owner,projectId).map(r=>r.history_id));
  for(const key of ['generatedModelHistory','compositeHistory','videoHistory'])if(state[key]){if(!Array.isArray(state[key]))throw problem(400,'INVALID_PROJECT','History must be an array');state[key]=state[key].filter(h=>!deleted.has(h.id));}
  if(state.stylingHistory)for(const [base,list]of Object.entries(state.stylingHistory)){if(!Array.isArray(list))throw problem(400,'INVALID_PROJECT','Styling history must contain arrays');state.stylingHistory[base]=list.filter(h=>!deleted.has(h.id));}
  for(const row of store.all('SELECT j.attachment,j.result FROM workflow_deliveries d JOIN jobs j ON j.id=d.job_id WHERE d.owner=? AND d.project_id=?',owner,projectId)){
    const target=JSON.parse(row.attachment),result=JSON.parse(row.result),h=target.history;
    if(deleted.has(h.id))continue;
    const url=result.outputUrl||(result.response?.candidates||[]).flatMap(c=>c.content?.parts||[]).find(p=>p.fileData)?.fileData?.fileUri;if(!url)continue;
    let list;
    if(h.type.startsWith('try-on')){state.stylingHistory||={};state.stylingHistory[h.baseModelId]||=[];list=state.stylingHistory[h.baseModelId];}
    else{const key=h.type==='video-generation'?'videoHistory':h.type==='composite-generation'?'compositeHistory':'generatedModelHistory';state[key]||=[];list=state[key];}
    const prior=list.find(x=>x.id===h.id),history={...h,imageUrl:url,...(h.type==='video-generation'?{videoUrl:url}:{}),...(prior?.name?{name:prior.name}:{}),isStarred:Boolean(prior?.isStarred)};
    const index=list.findIndex(x=>x.id===h.id);if(index<0)list.push(history);else list[index]=history;
  }
  if(deleted.has(state.currentHistoryItemId))state.currentHistoryItemId=null;
  return state;
}
export function validateAttachment(store,owner,value) {
  if(value===undefined||value===null)return null;
  object(value);const history=object(value.history);
  for(const key of [history.id,history.baseModelId,history.parentId].filter(Boolean))if(!/^[A-Za-z0-9_-]{1,128}$/.test(key)||['__proto__','constructor','prototype'].includes(key))throw problem(400,'INVALID_ATTACHMENT','Invalid history identity');
  if(!/^[A-Za-z0-9_-]{1,128}$/.test(value.projectId)||!/^[A-Za-z0-9_-]{1,128}$/.test(history.id)||!['model-generation','model-revision','try-on','try-on-revision','composite-generation','video-generation'].includes(history.type)||typeof history.prompt!=='string'||history.prompt.length>16000||typeof history.modelName!=='string'||history.modelName.length>100||JSON.stringify(value).length>64000)throw problem(400,'INVALID_ATTACHMENT','Invalid project delivery target');
  if(!store.get("SELECT id FROM documents WHERE owner=? AND collection='project-state' AND id=?",owner,value.projectId))throw problem(404,'PROJECT_NOT_FOUND','Save this project before starting generation');
  return {projectId:value.projectId,history:{id:history.id,parentId:history.parentId||null,type:history.type,baseModelId:history.baseModelId||history.id,prompt:history.prompt,modelName:history.modelName,settings:object(history.settings),isStarred:false}};
}
export function deliverResult(store,job,result) {
  if(!job.attachment||store.get('SELECT job_id FROM workflow_deliveries WHERE job_id=?',job.id))return;
  const target=JSON.parse(job.attachment),row=store.get("SELECT value,revision FROM documents WHERE owner=? AND collection='project-state' AND id=?",job.owner,target.projectId);
  if(!row)throw problem(409,'PROJECT_REMOVED','The target project was removed');
  const image=result.outputUrl||(result.response?.candidates||[]).flatMap(c=>c.content?.parts||[]).find(p=>p.fileData?.mimeType?.startsWith('image/'))?.fileData?.fileUri;
  if(!image)throw problem(502,'INVALID_OUTPUT','Project workflow requires an image');
  const state=JSON.parse(row.value),history={...target.history,imageUrl:image};
  if(history.type==='video-generation'){
    state.videoHistory=[...(state.videoHistory||[]).filter(h=>h.id!==history.id),{...history,videoUrl:image}];
  }else if(history.type.startsWith('try-on')){
    state.stylingHistory||={};state.stylingHistory[history.baseModelId]=[...(state.stylingHistory[history.baseModelId]||[]).filter(h=>h.id!==history.id),history];
  }else if(history.type==='composite-generation'){
    state.compositeHistory=[...(state.compositeHistory||[]).filter(h=>h.id!==history.id),history];state.currentCompositeHistoryId=history.id;
  }else{
    state.generatedModelHistory=[...(state.generatedModelHistory||[]).filter(h=>h.id!==history.id),history];
    state.currentHistoryItemId=history.id;state.generationSettings=history.settings;state.selectedModelName=history.modelName;
  }
  putDocument(store,job.owner,'project-state',target.projectId,state,row.revision);
  if(history.type==='model-generation'){
    const library=store.get("SELECT value,revision FROM documents WHERE owner=? AND collection='library' AND id='models'",job.owner);
    const models=library?JSON.parse(library.value):[],now=new Date().toISOString();
    const model={id:`model-${history.id}`,userId:job.owner,url:image,name:history.prompt,projectId:target.projectId,historyItemId:history.id,source:'user-global',createdAt:now,updatedAt:now};
    putDocument(store,job.owner,'library','models',[...models.filter(m=>m.id!==model.id),model],library?.revision||0);
  }
  store.run('INSERT INTO workflow_deliveries VALUES(?,?,?,?,?)',job.id,job.owner,target.projectId,history.id,Date.now());
}
