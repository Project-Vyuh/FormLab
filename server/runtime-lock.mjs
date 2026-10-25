import {DatabaseSync} from 'node:sqlite';
import {join} from 'node:path';

// A separate SQLite file is an OS-backed process lock, not an expiring lease.
// The kernel releases it on crash. Maintenance and API writers use the same lock.
export function runtimeLock(directory) {
  const db=new DatabaseSync(join(directory,'runtime-lock.sqlite'));
  try {
    db.exec('PRAGMA busy_timeout=0; PRAGMA journal_mode=DELETE; BEGIN EXCLUSIVE; CREATE TABLE IF NOT EXISTS runtime_lock(id INTEGER PRIMARY KEY);');
  } catch { db.close();throw Error('Data directory is in use by another FormLab API or maintenance process'); }
  return ()=>db.close();
}
