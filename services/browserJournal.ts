export interface JournalEntry {
  owner:string; id:string; kind:'save'|'command'|'cache'; value:any;
  created:number; status?:'pending'|'conflict'|'blocked'; path?:string; revision?:number|null;
  signature?:string; attempts?:number; nextTry?:number; error?:string;
}
let database:Promise<IDBDatabase>|undefined;
function openJournal(){
  return database ||= new Promise<IDBDatabase>((resolve,reject)=>{
    const request=indexedDB.open('formlab-recovery-v1',1);
    request.onupgradeneeded=()=>{const store=request.result.createObjectStore('entries',{keyPath:'key'});store.createIndex('owner','owner');};
    request.onsuccess=()=>{request.result.onversionchange=()=>{request.result.close();database=undefined;};resolve(request.result);};
    request.onerror=()=>{database=undefined;reject(request.error);};
  });
}
export async function journalEntries(owner:string,kind?:JournalEntry['kind']):Promise<JournalEntry[]>{
  const db=await openJournal();
  return new Promise((resolve,reject)=>{
    const request=db.transaction('entries').objectStore('entries').index('owner').getAll(owner);
    request.onsuccess=()=>resolve(request.result.filter(e=>!kind||e.kind===kind).sort((a,b)=>a.created-b.created));request.onerror=()=>reject(request.error);
  });
}
export async function journalPut(entry:JournalEntry){
  const db=await openJournal();
  let binary=0;const visit=(v:any)=>{if(v instanceof Blob)binary+=v.size;else if(v&&typeof v==='object')Object.values(v).forEach(visit);};visit(entry.value);
  const bytes=new TextEncoder().encode(JSON.stringify(entry)).byteLength+binary;
  if(bytes>24*1024*1024)throw Error('Recovery entry exceeds local storage limit');
  return new Promise<void>((resolve,reject)=>{
    const tx=db.transaction('entries','readwrite'),store=tx.objectStore('entries'),key=`${entry.owner}:${entry.kind}:${entry.id}`;
    const request=store.index('owner').getAll(entry.owner);
    request.onsuccess=()=>{
      const others=request.result.filter(e=>e.key!==key);
      let total=others.reduce((n,e)=>n+(e.bytes||0),0)+bytes;
      for(const cached of others.filter(e=>e.kind==='cache').sort((a,b)=>a.created-b.created))if(total>64*1024*1024){store.delete(cached.key);total-=cached.bytes||0;}
      if(total>64*1024*1024||(entry.kind!=='cache'&&others.filter(e=>e.kind!=='cache').length>=100)){tx.abort();return;}
      store.put({...entry,key,bytes});
    };
    tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error||Error('Local recovery quota reached'));tx.onerror=()=>reject(tx.error);
  });
}
export async function journalCommand(owner:string,signature:string,value:any):Promise<JournalEntry>{
  const db=await openJournal();return new Promise((resolve,reject)=>{
    const tx=db.transaction('entries','readwrite'),store=tx.objectStore('entries'),key=`${owner}:command:${signature}`;
    let entry:JournalEntry;const request=store.get(key);
    request.onsuccess=()=>{
      if(request.result){entry=request.result;return;}
      const all=store.index('owner').getAll(owner);
      all.onsuccess=()=>{
        const bytes=new TextEncoder().encode(JSON.stringify(value)).byteLength;
        if(bytes>256*1024||all.result.filter(e=>e.kind!=='cache').length>=100||all.result.reduce((n,e)=>n+(e.bytes||0),0)+bytes>64*1024*1024){tx.abort();return;}
        entry={owner,id:signature,signature,kind:'command',value,created:Date.now(),status:'pending'};
        store.add({...entry,key,bytes});
      };
    };
    tx.oncomplete=()=>resolve(entry);tx.onabort=()=>reject(tx.error||Error('Generation recovery quota reached'));
  });
}
export async function journalRemove(owner:string,kind:JournalEntry['kind'],id:string){
  const db=await openJournal();return new Promise<void>((resolve,reject)=>{
    const tx=db.transaction('entries','readwrite');tx.objectStore('entries').delete(`${owner}:${kind}:${id}`);tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);
  });
}
