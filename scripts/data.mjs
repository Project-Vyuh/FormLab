import { cp, stat, chmod } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { configuration } from '../server/config.mjs';
import {runtimeLock} from '../server/runtime-lock.mjs';
import {openStore} from '../server/store.mjs';
import {mediaStorage} from '../server/media.mjs';
const config=await configuration();
const command=process.argv[2];
if(!['backup','inspect','recover','cleanup'].includes(command))throw Error('Use backup <new-directory>, inspect, recover or cleanup [--apply]');
const unlock=runtimeLock(config.directory);
if(['recover','cleanup'].includes(command)){
  const store=openStore(config),media=mediaStorage(store,config);
  try{console.log(JSON.stringify(command==='recover'?await media.recover():await media.maintain({apply:process.argv.includes('--apply')})));}
  finally{store.db.close();unlock();}
  process.exit(0);
}
// Maintenance requires all writers stopped; locks prove this rather than trusting a health endpoint on one port.
const db=new DatabaseSync(join(config.directory,'formlab.sqlite'));
db.exec('PRAGMA busy_timeout=1000; BEGIN EXCLUSIVE');
try{
  if(command==='inspect'){
    console.log(JSON.stringify({integrity:db.prepare('PRAGMA integrity_check').all(),jobs:db.prepare('SELECT status,count(*) AS count FROM jobs GROUP BY status').all(),assets:db.prepare('SELECT count(*) AS files,coalesce(sum(size),0) AS bytes FROM assets').get()},null,2));
  }else{
    const destination=process.argv[3];if(!destination)throw Error('Pass a new backup destination: npm run data:backup -- /absolute/new-backup-directory');
    const target=resolve(destination);if(target===config.directory||target.startsWith(config.directory+'/'))throw Error('Backup destination must be outside active data directory');
    try{await stat(target);throw Error('Backup destination already exists; choose a new directory');}catch(error){if(error.code!=='ENOENT')throw error;}
    // Run only after stopping the server, as documented. EXCLUSIVE in WAL mode alone does not exclude file writers.
    const live=await fetch(`http://127.0.0.1:${config.port}/api/health`,{signal:AbortSignal.timeout(1000)}).then(()=>true).catch(()=>false);
    if(live)throw Error('Stop the FormLab server before making a full database + media backup');
    // cp must create the destination itself: precreating it with errorOnExist fails.
    await cp(config.directory,target,{recursive:true,errorOnExist:true,force:false,filter:source=>!source.split('/').pop().startsWith('runtime-lock.sqlite')});
    await chmod(target,0o700);
    console.log(`Backup created at ${target}. Keep it private: it includes accounts, sessions and customer media.`);
  }
}finally{db.exec('ROLLBACK');db.close();unlock();}
