import {createReadStream,createWriteStream} from 'node:fs';
import {open,rename,unlink,stat,mkdir,readdir} from 'node:fs/promises';
import {pipeline} from 'node:stream/promises';
import {Transform,Readable} from 'node:stream';
import {join} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import sharp from 'sharp';
import {problem} from './config.mjs';
sharp.cache({memory:16,files:0,items:32});sharp.concurrency(1);
const valid=id=>/^[a-f0-9-]{36}$/.test(id);
export function mediaStorage(store,config){
  const path=id=>join(config.directory,'assets',id),trash=join(config.directory,'trash');
  const row=(id,owner)=>{
    const asset=valid(id)&&store.get("SELECT * FROM assets WHERE id=? AND owner=? AND state='ready'",id,owner);
    if(!asset)throw problem(404,'ASSET_NOT_FOUND','Asset not found');return asset;
  };
  const referenced=id=>store.get('SELECT asset_id FROM job_assets WHERE asset_id=? LIMIT 1',id)||store.get('SELECT asset_id FROM asset_references WHERE asset_id=? LIMIT 1',id);
  async function quarantine(id){await mkdir(trash,{recursive:true,mode:0o700});await rename(path(id),join(trash,`${Date.now()}-${id}`)).catch(e=>{if(e.code!=='ENOENT')throw e;});}
  async function remove(id,owner){
    store.transaction(()=>{
      if(!store.get('SELECT id FROM assets WHERE id=? AND owner=?',id,owner))throw problem(404,'ASSET_NOT_FOUND','Asset not found');
      if(referenced(id))throw problem(409,'ASSET_IN_USE','Asset is referenced');
      store.run("UPDATE assets SET state='deleting' WHERE id=?",id);
    });
    await quarantine(id);store.run('DELETE FROM assets WHERE id=? AND owner=?',id,owner);
  }
  async function recover(){
    await mkdir(trash,{recursive:true,mode:0o700});let restored=0,quarantined=0,missing=0;
    for(const asset of store.all("SELECT * FROM assets WHERE state!='ready'")){
      if(asset.state==='missing')continue;
      if(asset.state==='deleting'){await quarantine(asset.id);store.run('DELETE FROM assets WHERE id=?',asset.id);quarantined++;continue;}
      let intact=false;
      try{
        const hash=createHash('sha256');let size=0;
        for await(const chunk of createReadStream(path(asset.id))){size+=chunk.length;hash.update(chunk);}
        intact=Boolean(asset.checksum)&&size===asset.size&&hash.digest('hex')===asset.checksum;
      }catch(e){if(e.code!=='ENOENT')throw e;}
      if(intact){store.run("UPDATE assets SET state='ready',reserved_bytes=0 WHERE id=?",asset.id);restored++;}
      else{await quarantine(asset.id);await quarantine(asset.id+'.part');store.run('DELETE FROM assets WHERE id=?',asset.id);quarantined++;}
    }
    for(const asset of store.all("SELECT id,size FROM assets WHERE state='ready'")){
      const size=await stat(path(asset.id)).then(s=>s.size).catch(e=>{if(e.code!=='ENOENT')throw e;return -1;});
      if(size!==asset.size){store.run("UPDATE assets SET state='missing' WHERE id=?",asset.id);missing++;}
    }
    // Unknown UUID files are preserved in trash, never silently adopted into an account.
    for(const name of await readdir(join(config.directory,'assets')))if(/^[a-f0-9-]{36}(\.part)?$/.test(name)&&!store.get('SELECT id FROM assets WHERE id=?',name.replace(/\.part$/,''))){await quarantine(name);quarantined++;}
    return {restored,quarantined,missing};
  }
  return {row,path,remove,recover,
    async save(stream,owner,mime,signal){
      if(!['image/png','image/jpeg','image/webp','image/gif','video/mp4','video/webm'].includes(mime))throw problem(415,'UNSUPPORTED_MEDIA','Unsupported media type');
      const id=randomUUID(),temporary=path(id+'.part');let size=0,metadata={};const hash=createHash('sha256');
      store.transaction(()=>{
        const used=store.get("SELECT coalesce(sum(CASE WHEN state='staging' THEN reserved_bytes ELSE size END),0) n FROM assets WHERE owner=?",owner).n;
        if(used+config.assetLimit>config.storageLimit)throw problem(413,'STORAGE_LIMIT','Insufficient storage reservation for upload');
        store.run("INSERT INTO assets(id,owner,mime,size,created,state,reserved_bytes) VALUES(?,?,?,0,?,'staging',?)",id,owner,mime,Date.now(),config.assetLimit);
      });
      try{
        const meter=new Transform({transform(chunk,encoding,callback){size+=chunk.length;hash.update(chunk);callback(size>config.assetLimit?problem(413,'ASSET_TOO_LARGE','Asset exceeds limit'):null,chunk);}});
        await pipeline(stream,meter,createWriteStream(temporary,{flags:'wx',mode:0o600}),{signal});
        if(!size)throw problem(400,'INVALID_MEDIA','Empty media');
        if(mime.startsWith('image/')){
          metadata=await sharp(temporary,{limitInputPixels:24000000}).metadata().catch(()=>{throw problem(400,'INVALID_MEDIA','Invalid or oversized image');});
          if(metadata.format!==({'image/png':'png','image/jpeg':'jpeg','image/webp':'webp','image/gif':'gif'}[mime])||(metadata.pages||1)>1)throw problem(400,'INVALID_MEDIA','Signature mismatch or animation unsupported');
        }else{
          const handle=await open(temporary,'r'),prefix=Buffer.alloc(16);try{await handle.read(prefix,0,16,0);}finally{await handle.close();}
          if(mime==='video/mp4'?prefix.toString('ascii',4,8)!=='ftyp':prefix.subarray(0,4).toString('hex')!=='1a45dfa3')throw problem(400,'INVALID_MEDIA','Invalid video signature');
        }
        store.run('UPDATE assets SET size=?,checksum=?,width=?,height=? WHERE id=?',size,hash.digest('hex'),metadata.width||null,metadata.height||null,id);
        // Flush file contents before publication. The staged row makes every crash boundary recoverable.
        const handle=await open(temporary,'r');try{await handle.sync();}finally{await handle.close();}
        await rename(temporary,path(id));
        store.run("UPDATE assets SET state='ready',reserved_bytes=0 WHERE id=?",id);
        return {id,url:`/assets/${id}`,mimeType:mime,size};
      }catch(error){
        await unlink(temporary).catch(()=>{});await unlink(path(id)).catch(()=>{});
        store.run("DELETE FROM assets WHERE id=? AND state='staging'",id);throw error;
      }
    },
    async saveBytes(bytes,owner,mime,signal){return this.save(Readable.from([bytes]),owner,mime,signal);},
    async serve(req,res,id,owner){
      const asset=row(id,owner);await stat(path(id));let start=0,end=asset.size-1,status=200;
      if(req.headers.range){
        const match=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
        if(!match||(!match[1]&&!match[2]))throw problem(416,'INVALID_RANGE','Invalid byte range');
        if(!match[1])start=Math.max(0,asset.size-Number(match[2]));else{start=Number(match[1]);if(match[2])end=Math.min(Number(match[2]),end);}
        if(start>end||start>=asset.size){res.setHeader('content-range',`bytes */${asset.size}`);throw problem(416,'INVALID_RANGE','Invalid byte range');}
        status=206;res.setHeader('content-range',`bytes ${start}-${end}/${asset.size}`);
      }
      res.writeHead(status,{'content-type':asset.mime,'content-length':end-start+1,'accept-ranges':'bytes','cache-control':'private,no-store','x-content-type-options':'nosniff'});
      if(req.method==='HEAD')return res.end();await pipeline(createReadStream(path(id),{start,end}),res);
    },
    async maintain({apply=false,now=Date.now()}={}){
      const jobs=store.all("SELECT id FROM jobs j WHERE status IN ('succeeded','failed','cancelled') AND updated<? AND NOT EXISTS(SELECT 1 FROM workflow_deliveries w JOIN documents d ON d.owner=w.owner AND d.collection='project-state' AND d.id=w.project_id WHERE w.job_id=j.id)",now-(config.jobRetentionMs||30*86400000));
      if(apply)store.transaction(()=>{for(const job of jobs){store.run('DELETE FROM generation_attempts WHERE job_id=?',job.id);store.run('DELETE FROM jobs WHERE id=?',job.id);}store.run('DELETE FROM document_mutations WHERE created<?',now-30*86400000);});
      const assets=store.all("SELECT id,owner FROM assets a WHERE state='ready' AND created<? AND NOT EXISTS(SELECT 1 FROM job_assets j WHERE j.asset_id=a.id) AND NOT EXISTS(SELECT 1 FROM asset_references r WHERE r.asset_id=a.id)",now-(config.orphanRetentionMs||7*86400000));
      if(apply)for(const asset of assets)await remove(asset.id,asset.owner);
      let purged=0;await mkdir(trash,{recursive:true,mode:0o700});
      for(const name of await readdir(trash)){const match=/^(\d+)-[a-f0-9-]{36}(\.part)?$/.exec(name);if(match&&Number(match[1])<now-(config.trashRetentionMs||7*86400000)){if(apply)await unlink(join(trash,name));purged++;}}
      return {apply,expiredJobs:jobs.length,unreferencedAssets:assets.length,expiredTrashFiles:purged};
    },
  };
}
