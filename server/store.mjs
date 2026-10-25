import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { problem } from './config.mjs';

export function openStore(config) {
  const db = new DatabaseSync(join(config.directory, 'formlab.sqlite'));
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,name TEXT NOT NULL,password TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions(hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY,owner TEXT NOT NULL REFERENCES users(id),key TEXT NOT NULL,hash TEXT NOT NULL,
      kind TEXT NOT NULL,input TEXT,status TEXT NOT NULL,attempt INTEGER NOT NULL DEFAULT 0,operation TEXT,result TEXT,error TEXT,
      created INTEGER NOT NULL,updated INTEGER NOT NULL,next_run INTEGER NOT NULL DEFAULT 0,lease INTEGER,worker TEXT,
      UNIQUE(owner,key));
    CREATE INDEX IF NOT EXISTS jobs_queue ON jobs(status,next_run,created);
    CREATE INDEX IF NOT EXISTS jobs_owner ON jobs(owner,created);
    CREATE TABLE IF NOT EXISTS assets(id TEXT PRIMARY KEY,owner TEXT NOT NULL REFERENCES users(id),mime TEXT NOT NULL,size INTEGER NOT NULL,created INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS documents(owner TEXT NOT NULL REFERENCES users(id),collection TEXT NOT NULL,id TEXT NOT NULL,value TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 1,PRIMARY KEY(owner,collection,id));
    CREATE TABLE IF NOT EXISTS limits(key TEXT PRIMARY KEY,count INTEGER NOT NULL,expires INTEGER NOT NULL);
    `);
  // Additive, transactional migration preserves existing users, assets and jobs.
  const version = db.prepare('PRAGMA user_version').get().user_version;
  if (version > 5) { db.close(); throw Error('Database schema is newer than this server'); }
  if (version < 2) {
    db.exec('BEGIN IMMEDIATE');
    try {
      const columns = new Set(db.prepare('PRAGMA table_info(jobs)').all().map(c => c.name));
      for (const [name, type] of Object.entries({claim_token:'TEXT', failure_count:'INTEGER NOT NULL DEFAULT 0', poll_count:'INTEGER NOT NULL DEFAULT 0', memory_bytes:'INTEGER NOT NULL DEFAULT 0', request_id:'TEXT', error_code:'TEXT'})) {
        if (!columns.has(name)) db.exec(`ALTER TABLE jobs ADD COLUMN ${name} ${type}`);
      }
      db.exec(`CREATE TABLE IF NOT EXISTS provider_health(provider TEXT PRIMARY KEY, failures INTEGER NOT NULL DEFAULT 0, open_until INTEGER NOT NULL DEFAULT 0);
        CREATE TABLE IF NOT EXISTS generation_attempts(id TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES jobs(id), worker TEXT NOT NULL, started INTEGER NOT NULL, finished INTEGER, status TEXT NOT NULL, error_code TEXT);
        PRAGMA user_version=2; COMMIT;`);
    } catch (error) { db.exec('ROLLBACK'); db.close(); throw error; }
  }
  if (version < 3) {
    db.exec('BEGIN IMMEDIATE');
    try {
      db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS assets_owner_id ON assets(owner,id);
        CREATE UNIQUE INDEX IF NOT EXISTS jobs_owner_id ON jobs(owner,id);
        CREATE TABLE IF NOT EXISTS job_assets(owner TEXT NOT NULL,job_id TEXT NOT NULL,asset_id TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('input','output')),
          PRIMARY KEY(job_id,asset_id,role),FOREIGN KEY(owner,job_id) REFERENCES jobs(owner,id) ON DELETE CASCADE,FOREIGN KEY(owner,asset_id) REFERENCES assets(owner,id));
        CREATE TABLE IF NOT EXISTS asset_references(owner TEXT NOT NULL,collection TEXT NOT NULL,document_id TEXT NOT NULL,asset_id TEXT NOT NULL,
          PRIMARY KEY(owner,collection,document_id,asset_id),FOREIGN KEY(owner,collection,document_id) REFERENCES documents(owner,collection,id) ON DELETE CASCADE,
          FOREIGN KEY(owner,asset_id) REFERENCES assets(owner,id));
        CREATE INDEX IF NOT EXISTS job_assets_asset ON job_assets(owner,asset_id);
        CREATE INDEX IF NOT EXISTS asset_references_asset ON asset_references(owner,asset_id);`);
      // Backfill only verified same-owner files; older dangling links remain visible for repair.
      for (const row of db.prepare('SELECT owner,collection,id,value FROM documents').iterate()) for (const assetId of assetIds(row.value)) {
        if (db.prepare('SELECT id FROM assets WHERE owner=? AND id=?').get(row.owner,assetId)) db.prepare('INSERT OR IGNORE INTO asset_references VALUES(?,?,?,?)').run(row.owner,row.collection,row.id,assetId);
      }
      for (const row of db.prepare('SELECT owner,id,input,result FROM jobs').iterate()) {
        for (const [role,text] of [['input',row.input],['output',row.result]]) for (const assetId of assetIds(text)) {
          if (db.prepare('SELECT id FROM assets WHERE owner=? AND id=?').get(row.owner,assetId)) db.prepare('INSERT OR IGNORE INTO job_assets VALUES(?,?,?,?)').run(row.owner,row.id,assetId,role);
        }
      }
      db.prepare("UPDATE jobs SET memory_bytes=?+length(coalesce(input,''))*4 WHERE status='queued' AND memory_bytes=0").run(32*1024*1024+24*1024*1024*4+(config.assetLimit||20*1024*1024)*6);
      db.exec('PRAGMA user_version=3; COMMIT;');
    } catch (error) { db.exec('ROLLBACK'); db.close(); throw error; }
  }
  if(version<4){
    db.exec('BEGIN IMMEDIATE');
    try{
      const assetColumns=new Set(db.prepare('PRAGMA table_info(assets)').all().map(c=>c.name));
      for(const [name,type] of Object.entries({state:"TEXT NOT NULL DEFAULT 'ready'",checksum:'TEXT',width:'INTEGER',height:'INTEGER',reserved_bytes:'INTEGER NOT NULL DEFAULT 0'}))if(!assetColumns.has(name))db.exec(`ALTER TABLE assets ADD COLUMN ${name} ${type}`);
      if(!db.prepare('PRAGMA table_info(jobs)').all().some(c=>c.name==='attachment'))db.exec('ALTER TABLE jobs ADD COLUMN attachment TEXT');
      db.exec(`CREATE TABLE IF NOT EXISTS document_mutations(owner TEXT NOT NULL REFERENCES users(id),id TEXT NOT NULL,hash TEXT NOT NULL,revision INTEGER NOT NULL,created INTEGER NOT NULL,PRIMARY KEY(owner,id));
        CREATE TABLE IF NOT EXISTS workflow_deliveries(job_id TEXT PRIMARY KEY REFERENCES jobs(id) ON DELETE CASCADE,owner TEXT NOT NULL,project_id TEXT NOT NULL,history_id TEXT NOT NULL,delivered INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS usage_ledger(attempt_id TEXT PRIMARY KEY,owner TEXT NOT NULL REFERENCES users(id),job_id TEXT NOT NULL,provider TEXT NOT NULL,model TEXT NOT NULL,reserved_units INTEGER NOT NULL,actual_usage TEXT,status TEXT NOT NULL,created INTEGER NOT NULL,finished INTEGER);
        CREATE INDEX IF NOT EXISTS usage_owner_created ON usage_ledger(owner,created);
        CREATE TABLE IF NOT EXISTS upload_keys(owner TEXT NOT NULL,key TEXT NOT NULL,asset_id TEXT NOT NULL,PRIMARY KEY(owner,key),FOREIGN KEY(owner,asset_id) REFERENCES assets(owner,id) ON DELETE CASCADE);
        PRAGMA user_version=4;COMMIT;`);
    }catch(error){db.exec('ROLLBACK');db.close();throw error;}
  }
  if(version<5)db.exec(`BEGIN IMMEDIATE;CREATE TABLE IF NOT EXISTS history_tombstones(owner TEXT NOT NULL REFERENCES users(id),project_id TEXT NOT NULL,history_id TEXT NOT NULL,created INTEGER NOT NULL,PRIMARY KEY(owner,project_id,history_id));PRAGMA user_version=5;COMMIT;`);
  const run = (sql, ...args) => db.prepare(sql).run(...args);
  const get = (sql, ...args) => db.prepare(sql).get(...args);
  const all = (sql, ...args) => db.prepare(sql).all(...args);
  const transaction = fn => {
    db.exec('BEGIN IMMEDIATE');
    try { const result = fn(); db.exec('COMMIT'); return result; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  };
  return {
    db, run, get, all, transaction,
    admit(owner, key, hash, kind, input, requestId=null, attachment=null) {
      return transaction(() => {
        const existing = get('SELECT * FROM jobs WHERE owner=? AND key=?', owner, key);
        if (existing) {
          if (existing.hash !== hash || existing.kind !== kind) throw problem(409, 'IDEMPOTENCY_CONFLICT', 'This request key was used for different input');
          return existing;
        }
        const now = Date.now();
        const health = get('SELECT open_until FROM provider_health WHERE provider=?', config.provider || 'gemini');
        if (health?.open_until > now) throw problem(503, 'PROVIDER_PAUSED', 'Generation provider is paused after failures; retry later');
        if (get('SELECT count(*) AS n FROM jobs WHERE owner=? AND created>=?', owner, now-86400000).n >= config.dailyLimit) throw problem(429, 'DAILY_LIMIT', 'Daily generation allowance reached');
        if (get("SELECT count(*) AS n FROM jobs WHERE owner=? AND status IN ('queued','processing')", owner).n >= config.pendingLimit) throw problem(429, 'QUEUE_LIMIT', 'Too many pending generations');
        const id = randomUUID();
        const serialized = JSON.stringify(input);
        let referenceBytes = 0;
        const visit = value => {
          if (!value || typeof value !== 'object') return;
          if (typeof value.assetId === 'string') referenceBytes += get('SELECT size FROM assets WHERE id=? AND owner=?', value.assetId, owner)?.size || 0;
          for (const nested of Object.values(value)) visit(nested);
        };
        visit(input);
        // Reserve for SDK/base64/native working buffers, not just the serialized request.
        const memoryBytes = 32*1024*1024 + referenceBytes*4 + (config.assetLimit || 20*1024*1024)*6 + Buffer.byteLength(serialized)*4;
        if (memoryBytes > (config.memoryBudget || 512*1024*1024)) throw problem(413, 'MEMORY_BUDGET', 'Generation exceeds the server memory reservation budget');
        run("INSERT INTO jobs(id,owner,key,hash,kind,input,status,created,updated,memory_bytes,request_id,attachment) VALUES(?,?,?,?,?,?,'queued',?,?,?,?,?)", id, owner, key, hash, kind, serialized, now, now, memoryBytes, requestId,attachment?JSON.stringify(attachment):null);
        for (const assetId of assetIds(serialized)) run('INSERT INTO job_assets VALUES(?,?,?,?)',owner,id,assetId,'input');
        return get('SELECT * FROM jobs WHERE id=?', id);
      });
    },
    limit(key, max, window=60000) {
      transaction(() => {
        run('DELETE FROM limits WHERE expires<?', Date.now());
        const entry=get('SELECT count FROM limits WHERE key=?',key);
        if (entry?.count >= max) throw problem(429,'RATE_LIMIT','Too many requests; try again later');
        run('INSERT INTO limits VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1',key,Date.now()+window);
      });
    },
  };
}
export function publicJob(row) {
  return { id: row.id, status: row.status, kind: row.kind, attempt: row.attempt, failureCount:row.failure_count, pollCount:row.poll_count, createdAt: new Date(row.created).toISOString(), updatedAt: new Date(row.updated).toISOString(), ...(row.result ? JSON.parse(row.result) : {}), ...(row.error ? { error: row.error, errorCode:row.error_code } : {}) };
}
export function assetIds(text) {
  const ids=new Set();
  if (!text) return ids;
  // Inspect structured references, not arbitrary prose that happens to mention an ID.
  const visit=value=>{
    if(typeof value==='string'){
      const match=/^(?:https?:\/\/[^/?#]+)?\/assets\/([a-f0-9-]{36})$/.exec(value);
      if(match)ids.add(match[1]);
    }else if(value&&typeof value==='object'){
      if(typeof value.assetId==='string'&&/^[a-f0-9-]{36}$/.test(value.assetId))ids.add(value.assetId);
      for(const nested of Object.values(value))visit(nested);
    }
  };
  try{visit(JSON.parse(text));}catch{throw problem(500,'INVALID_STORED_JSON','Stored artifact references are invalid');}
  return ids;
}
