import type { GenerateContentResponse } from '@google/genai';
import { localRequest, referenceParts, uploadAsset, apiUrl, sessionScope,ApiError,getSessionOwner } from './localApi';
import {journalEntries,journalCommand,journalPut,journalRemove,JournalEntry} from './browserJournal';
export interface GenerationAttachment {projectId:string;history:Record<string,any>}

type GenerateRequest = Record<string, any>;
export interface GenerationJob {
  id: string;
  kind?: string;
  status: 'queued' | 'processing' | 'succeeded' | 'failed' | 'cancelled';
  response?: GenerateContentResponse;
  outputUrl?: string;
  error?: string;
}
export function getGenerationJob(jobId: string, signal?: AbortSignal): Promise<GenerationJob> {
  return localRequest(`/api/jobs/${encodeURIComponent(jobId)}`, {signal});
}
export function cancelGeneration(jobId: string) {
  return localRequest(`/api/jobs/${encodeURIComponent(jobId)}/cancel`, {method: 'POST'});
}
export async function waitForGeneration(jobId: string, signal?: AbortSignal): Promise<GenerationJob> {
  const scope = sessionScope();
  const deadline = Date.now() + 16 * 60 * 1000;
  while (Date.now() < deadline) {
    scope.assert();
    signal?.throwIfAborted();
    const job = await getGenerationJob(jobId, signal);
    scope.assert();
    if(['succeeded','failed','cancelled'].includes(job.status)&&scope.owner){for(const entry of await journalEntries(scope.owner,'command'))if(entry.value.jobId===jobId)await journalRemove(scope.owner,'command',entry.id);scope.assert();}
    if (job.status === 'failed' || job.status === 'cancelled') throw new Error(job.error || `Generation ${job.status}`);
    if (job.status === 'succeeded') return job;
    await new Promise<void>((resolve,reject) => {
      const combined=AbortSignal.any([scope.signal,...(signal?[signal]:[])]);
      combined.throwIfAborted();
      const abort=()=>{clearTimeout(timer);reject(combined.reason);};
      const timer=setTimeout(()=>{combined.removeEventListener('abort',abort);resolve();},1000);
      combined.addEventListener('abort',abort,{once:true});
    });
  }
  throw new Error(`Generation is still pending. Resume job ${jobId} instead of resubmitting.`);
}
const canonical=(value:any):any=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
async function sendCommand(entry:JournalEntry){
  const scope=sessionScope();scope.assert();if(scope.owner!==entry.owner)throw new DOMException('Wrong recovery owner','AbortError');
  let job:GenerationJob|null=null;
  try{job=await localRequest(`/api/jobs/by-key/${entry.value.key}`);}catch(error){if(!(error instanceof ApiError&&error.status===404))throw error;}
  scope.assert();
  if(job){
    if(['succeeded','failed','cancelled'].includes(job.status))await journalRemove(entry.owner,'command',entry.id);
    else{entry.value.jobId=job.id;await journalPut(entry);}
    return {jobId:job.id};
  }
  const accepted=await localRequest<{jobId:string}>(entry.value.path,{method:'POST',headers:{'x-idempotency-key':entry.value.key},body:JSON.stringify(entry.value.input)});
  scope.assert();entry.value.jobId=accepted.jobId;await journalPut(entry);scope.assert();return accepted;
}
export async function submitGeneration(path:string,input:GenerateRequest){
  const scope=sessionScope();if(!scope.owner)throw new ApiError('Sign in before generating',401,'AUTH_REQUIRED');
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(canonical({path,input}))));scope.assert();
  const signature=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
  const entry=await journalCommand(scope.owner,signature,{path,input,key:crypto.randomUUID()});scope.assert();
  try {
    return await sendCommand(entry);
  } catch (error) {
    scope.assert();
    if(error instanceof ApiError&&error.status<500&&error.status!==429){await journalRemove(entry.owner,'command',entry.id);throw error;}
    if (error instanceof TypeError||error?.name==='TimeoutError') throw new Error('Generation request saved locally. It will be reconciled after reconnect; do not submit it again.');
    throw error;
  }
}
let replaying=false;
export async function recoverGenerationCommands(){
  if(replaying)return;const scope=sessionScope();if(!scope.owner)return;replaying=true;
  try{for(const entry of await journalEntries(scope.owner,'command')){
    scope.assert();if(entry.status==='blocked'||(entry.nextTry||0)>Date.now())continue;
    try{await sendCommand(entry);}catch(error){scope.assert();entry.attempts=(entry.attempts||0)+1;entry.nextTry=Date.now()+Math.min(60000,1000*2**Math.min(entry.attempts,6));entry.status=error instanceof ApiError&&error.status<500&&error.status!==429?'blocked':'pending';entry.error=error instanceof ApiError?error.code:'NETWORK_UNAVAILABLE';await journalPut(entry);}
  }}finally{replaying=false;}
}
export async function pendingGenerationCommands(){const owner=getSessionOwner();return owner?journalEntries(owner,'command'):[];}
export async function discardGenerationCommand(id:string){const owner=getSessionOwner();if(owner)await journalRemove(owner,'command',id);}
for(const event of ['online','formlab:session','formlab:recovery'])window.addEventListener(event,()=>{void recoverGenerationCommands().catch(()=>{});});
setInterval(()=>{void recoverGenerationCommands().catch(()=>{});},15000);
export const aiGateway = {
  models: {
    async generateContent(input: GenerateRequest): Promise<GenerateContentResponse> {
      const scope=sessionScope();
      const normalized = await referenceParts({
        model: input.model,
        contents: input.contents && !Array.isArray(input.contents) && typeof input.contents === 'object' ? [input.contents] : input.contents,
        config: input.config || {},
        ...(input.attachment?{attachment:input.attachment}:{}),
      });
      scope.assert();
      const {jobId} = await submitGeneration('/api/ai/generate-content', normalized);
      const job = await waitForGeneration(jobId);
      scope.assert();
      if (!job.response) throw new Error('Generation response is missing');
      // Existing consumers can use fileData.fileUri without transporting generated images in JSON.
      for (const candidate of job.response.candidates || []) for (const part of candidate.content?.parts || []) {
        if (part.fileData?.fileUri?.startsWith('/assets/')) part.fileData.fileUri = apiUrl(part.fileData.fileUri);
      }
      return job.response;
    },
  },
};
export const deliveryGateway=(attachment?:GenerationAttachment)=>attachment?{models:{generateContent:(input:GenerateRequest)=>aiGateway.models.generateContent({...input,attachment})}}:aiGateway;
export async function startVideoGeneration(input: GenerateRequest) {
  const scope=sessionScope();
  if (input.image?.imageBytes) {
    const blob = await (await fetch(`data:${input.image.mimeType};base64,${input.image.imageBytes}`)).blob();
    scope.assert();
    const asset = await uploadAsset(blob);
    input = {...input, image: {assetId: asset.id}};
  }
  scope.assert();
  return submitGeneration('/api/ai/generate-video', input);
}
