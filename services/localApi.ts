import { runtimeConfig } from './runtimeConfig';

export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string) { super(message); }
}
export const apiUrl = (path: string) => `${runtimeConfig.apiBaseUrl}${path}`;
let sessionVersion = 0;
let sessionOwner:string|null=null;
export const setSessionOwner=(owner:string|null)=>{sessionOwner=owner;};
export const getSessionOwner=()=>sessionOwner;
let sessionController = new AbortController();
window.addEventListener('formlab:session', () => {
  sessionVersion++;
  sessionController.abort(new DOMException('Session changed', 'AbortError'));
  sessionController = new AbortController();
});
export function sessionScope() {
  const version = sessionVersion, signal = sessionController.signal,owner=sessionOwner;
  return {signal,owner, assert() { if (version !== sessionVersion||owner!==sessionOwner) throw new DOMException('Session changed', 'AbortError'); signal.throwIfAborted(); }};
}
export function localAssetId(value: string): string | null {
  const url = new URL(value, window.location.href);
  const trusted = new URL(apiUrl('/assets/'), window.location.href);
  return url.origin === trusted.origin && !url.search && !url.hash ? /^\/assets\/([a-f0-9-]{36})$/.exec(url.pathname)?.[1] || null : null;
}
export const mediaFetchOptions = (url: string): RequestInit => ({mode:'cors', credentials:localAssetId(url) ? 'include' : 'omit'});
export async function localRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const scope = sessionScope();
  scope.assert();
  const response = await fetch(apiUrl(path), {
    ...init, credentials: 'include', signal: AbortSignal.any([scope.signal, AbortSignal.timeout(30000), ...(init.signal ? [init.signal] : [])]),
    headers: { 'x-formlab-client': 'web', ...(typeof init.body === 'string' ? { 'content-type': 'application/json' } : {}), ...init.headers },
  });
  const payload = await response.json().catch(() => ({}));
  scope.assert();
  if (!response.ok) throw new ApiError(payload.error || 'FormLab request failed', response.status, payload.code);
  return payload as T;
}
let uploadTail: Promise<unknown> = Promise.resolve();
export async function uploadAsset(blob: Blob): Promise<{id: string; url: string}> {
  const scope = sessionScope();
  // Serialize across all helpers so recursive saves cannot exceed server upload capacity.
  const operation = uploadTail.catch(() => {}).then(() => {
    scope.assert();
    return (async()=>{
      const digest=await crypto.subtle.digest('SHA-256',await blob.arrayBuffer());scope.assert();
      const key=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
      try{return await localRequest<{id:string;url:string}>(`/api/assets/by-key/${key}`,{signal:scope.signal});}
      catch(error){if(!(error instanceof ApiError&&error.status===404))throw error;}
      scope.assert();
      return localRequest<{id:string;url:string}>('/api/assets', { method: 'POST', headers: { 'content-type': blob.type,'x-idempotency-key':key }, body: blob, signal:scope.signal });
    })();
  });
  uploadTail = operation;
  return operation;
}
// Binary media crosses the browser API boundary once. Gemini-specific base64 exists only inside its server adapter.
export async function referenceParts(value: any): Promise<any> {
  const scope = sessionScope();
  if (Array.isArray(value)) { const result=[]; for (const item of value) { scope.assert(); result.push(await referenceParts(item)); } scope.assert(); return result; }
  if (!value || typeof value !== 'object') return value;
  if (value.inlineData) {
    const data = value.inlineData;
    const blob = await (await fetch(`data:${data.mimeType};base64,${data.data}`)).blob();
    scope.assert();
    const asset = await uploadAsset(blob);
    return { assetId: asset.id };
  }
  const result: Record<string,unknown> = {};
  for (const [key,item] of Object.entries(value)) { scope.assert(); result[key] = await referenceParts(item); }
  scope.assert(); return result;
}
