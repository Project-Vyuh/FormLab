import React, {useEffect, useState} from 'react';
import {localRequest} from '../services/localApi';
import {cancelGeneration, GenerationJob,pendingGenerationCommands,recoverGenerationCommands,discardGenerationCommand} from '../services/aiGateway';
import {pendingSaves,flushPendingSaves,discardPendingSave} from '../services/localDocuments';
import {JournalEntry} from '../services/browserJournal';

export default function LocalActivity() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState('Local storage');
  const [jobs, setJobs] = useState<GenerationJob[]>([]);
  const [error, setError] = useState('');
  const [fake, setFake] = useState(false);
  const [pending,setPending]=useState<JournalEntry[]>([]),[commands,setCommands]=useState<JournalEntry[]>([]),[alerts,setAlerts]=useState<{code:string}[]>([]);
  useEffect(()=>{const clear=()=>{setJobs([]);setPending([]);setCommands([]);setAlerts([]);setStatus('Local storage');};window.addEventListener('formlab:session',clear);return()=>window.removeEventListener('formlab:session',clear);},[]);
  useEffect(() => { void localRequest<{provider: string}>('/api/health').then(result => setFake(result.provider === 'fake')).catch(() => {}); }, []);
  useEffect(() => {
    const listener = (event: Event) => setStatus(({saving:'Saving locally…',saved:'Saved locally',error:'Local save failed',offline:'Offline cached data',pending:'Saved on device; sync pending',conflict:'Pending edit needs review',blocked:'Sync blocked'} as Record<string,string>)[(event as CustomEvent).detail]||'Local storage');
    window.addEventListener('formlab:save', listener);
    return () => window.removeEventListener('formlab:save', listener);
  }, []);
  useEffect(() => {
    if (!open) return;
    let alive = true;
    const refresh = () => void localRequest<{jobs: GenerationJob[]}>('/api/jobs').then(result => {if(alive) {setJobs(result.jobs);setError('');}}).catch(e => {if(alive)setError(e.message);});
    const recoveries=()=>{void Promise.all([pendingSaves(),pendingGenerationCommands(),localRequest<{alerts:{code:string}[]}>('/api/alerts')]).then(([s,c,a])=>{if(alive){setPending(s);setCommands(c);setAlerts(a.alerts);}}).catch(()=>{});};
    refresh();recoveries();const timer = setInterval(()=>{refresh();recoveries();}, 2000);
    return () => {alive=false;clearInterval(timer);};
  }, [open]);
  return <div className="relative">
    <button className="text-xs text-gray-400 px-3" title="Local saves and generation history" onClick={() => setOpen(!open)}>{status}{fake ? ' · Test provider' : ''}</button>
    {open && <div className="absolute right-0 top-8 z-50 w-80 max-h-96 overflow-auto rounded-xl border border-white/10 bg-[#191919] p-4 shadow-xl">
      <div className="flex justify-between mb-3"><h3 className="text-sm text-white">Generation history</h3><button onClick={() => setOpen(false)} aria-label="Close generation history">×</button></div>
      <p className="text-xs text-gray-400 mb-3">Jobs remain available after a refresh. Fake mode produces test fixtures.</p>
      {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
      {alerts.map(a=><p key={a.code} role="alert" className="text-xs text-red-300">{a.code.replaceAll('_',' ')}</p>)}
      {(pending.length>0||commands.length>0)&&<div className="text-xs text-yellow-200 mb-3">
        <p>{pending.length} pending edits; {commands.length} generation requests awaiting reconciliation.</p>
        <button onClick={()=>void Promise.all([flushPendingSaves(),recoverGenerationCommands()]).catch(e=>setError(e.message))}>Retry pending work</button>
        {pending.map(entry=><details key={entry.id}><summary>{entry.status}: {entry.path}</summary><pre className="whitespace-pre-wrap break-all">{JSON.stringify(entry.value,(_key,value)=>value instanceof Blob?`[Stored media: ${value.type}, ${value.size} bytes]`:value,2)}</pre><p>Conflicts never overwrite newer server data automatically. Preserve your changes before discarding.</p><button onClick={()=>{if(window.confirm('Discard this device-only edit? This cannot be undone.'))void discardPendingSave(entry.id);}}>Discard edit</button></details>)}
        {commands.map(entry=><div key={entry.id}>{entry.status}: {entry.error||'Generation recovery'} <button onClick={()=>{if(window.confirm('Stop reconciling this request? An already accepted server job will not be cancelled.'))void discardGenerationCommand(entry.id);}}>Dismiss recovery</button></div>)}
      </div>}
      {!jobs.length && <p className="text-xs text-gray-400">No generations yet.</p>}
      {jobs.map(job => <div key={job.id} className="border-t border-white/10 py-2 text-xs">
        <div>{job.kind || 'Generation'}: {job.status}</div><div className="text-gray-500 break-all">{job.id}</div>
        {job.error && <p className="text-red-300">{job.error}</p>}
        {job.outputUrl && <a href={job.outputUrl} target="_blank" rel="noreferrer" className="text-blue-300">Open video</a>}
        {job.response?.candidates?.flatMap(c => c.content?.parts || []).filter(p => p.fileData?.fileUri).map((p,i) => <a key={i} href={p.fileData!.fileUri} target="_blank" rel="noreferrer" className="text-blue-300 block">Open image</a>)}
        {['queued','processing'].includes(job.status) && <button className="text-red-300" onClick={() => void cancelGeneration(job.id).catch(e => setError(e.message))}>Cancel</button>}
      </div>)}
    </div>}
  </div>;
}
