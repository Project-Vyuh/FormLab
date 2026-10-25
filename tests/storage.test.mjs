import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readdir,unlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {openStore} from '../server/store.mjs';
import {mediaStorage} from '../server/media.mjs';
import {runtimeLock} from '../server/runtime-lock.mjs';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXioAAAAASUVORK5CYII=','base64');
async function setup(){const directory=await mkdtemp(join(tmpdir(),'formlab-storage-'));await mkdir(join(directory,'assets'));const config={directory,assetLimit:1048576,storageLimit:10485760,dailyLimit:10,pendingLimit:10};const store=openStore(config);store.run("INSERT INTO users VALUES('owner','test@example.test','Test','unused')");return {store,config,media:mediaStorage(store,config)};}
test('staged publication recovers a complete checksummed file after process restart',async()=>{
  const {store,media}=await setup();try{const asset=await media.saveBytes(png,'owner','image/png');store.run("UPDATE assets SET state='staging' WHERE id=?",asset.id);assert.throws(()=>media.row(asset.id,'owner'));const result=await media.recover();assert.equal(result.restored,1);assert.equal(media.row(asset.id,'owner').checksum.length,64);}finally{store.db.close();}
});
test('recovery quarantines partial and unknown files without adopting them into an account',async()=>{
  const {store,media,config}=await setup();try{
    const id=randomUUID();store.run("INSERT INTO assets(id,owner,mime,size,created,state) VALUES(?,'owner','image/png',0,?,'staging')",id,Date.now());await writeFile(media.path(id+'.part'),'partial');
    const unknown=randomUUID();await writeFile(media.path(unknown),png);const result=await media.recover();assert.equal(result.quarantined,2);assert.equal(store.get('SELECT count(*) n FROM assets').n,0);assert.equal((await readdir(join(config.directory,'trash'))).length,2);
  }finally{store.db.close();}
});
test('deletion resumes after crash and missing files remain flagged rather than falsely delivered',async()=>{
  const {store,media}=await setup();try{
    const deleted=await media.saveBytes(png,'owner','image/png'),missing=await media.saveBytes(png,'owner','image/png');
    store.run("UPDATE assets SET state='deleting' WHERE id=?",deleted.id);await unlink(media.path(missing.id));const result=await media.recover();
    assert.equal(result.missing,1);assert.equal(store.get('SELECT id FROM assets WHERE id=?',deleted.id),undefined);assert.equal(store.get('SELECT state FROM assets WHERE id=?',missing.id).state,'missing');assert.throws(()=>media.row(missing.id,'owner'));
  }finally{store.db.close();}
});
test('retention is dry-run by default and preserves shared/active references',async()=>{
  const {store,media}=await setup();try{
    const orphan=await media.saveBytes(png,'owner','image/png'),shared=await media.saveBytes(png,'owner','image/png'),active=await media.saveBytes(png,'owner','image/png');const old=Date.now()-40*86400000;
    store.run('UPDATE assets SET created=?',old);store.run('INSERT INTO documents VALUES(?,?,?,?,?)','owner','projects','shared',JSON.stringify({image:shared.url}),1);store.run('INSERT INTO asset_references VALUES(?,?,?,?)','owner','projects','shared',shared.id);
    store.admit('owner','active-job-key','hash','content',{model:'test',contents:[{assetId:active.id}]});
    assert.equal((await media.maintain()).unreferencedAssets,1);assert.ok(media.row(orphan.id,'owner'));
    assert.equal((await media.maintain({apply:true})).unreferencedAssets,1);assert.throws(()=>media.row(orphan.id,'owner'));assert.ok(media.row(shared.id,'owner'));assert.ok(media.row(active.id,'owner'));
  }finally{store.db.close();}
});
test('kernel-backed data lock excludes another runtime or maintenance process',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'formlab-lock-')),unlock=runtimeLock(directory);
  assert.throws(()=>runtimeLock(directory),/in use/);unlock();const release=runtimeLock(directory);release();
});
