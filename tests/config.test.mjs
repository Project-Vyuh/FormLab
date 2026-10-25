import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
test('unconfigured deployment profiles and missing explicit env files fail closed',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'formlab-profile-'));
  for(const overrides of [{FORMLAB_DEPLOYMENT_MODE:'production'},{FORMLAB_DB_PROVIDER:'postgres'},{FORMLAB_AUTH_PROVIDER:'auth0'},{FORMLAB_STORAGE_PROVIDER:'s3'},{FORMLAB_ENV_FILE:join(directory,'does-not-exist')}]){
    const result=spawnSync(process.execPath,['--input-type=module','-e',"import {configuration} from './server/config.mjs';await configuration();"],{env:{...process.env,FORMLAB_ENV_FILE:'',FORMLAB_DEPLOYMENT_MODE:'local',FORMLAB_DB_PROVIDER:'sqlite',FORMLAB_AUTH_PROVIDER:'local',FORMLAB_STORAGE_PROVIDER:'filesystem',FORMLAB_DATA_DIR:directory,GEMINI_API_KEY:'',...overrides},encoding:'utf8'});
    assert.notEqual(result.status,0);assert.match(result.stderr,/not configured|env file does not exist/);assert.equal(result.stdout,'');
  }
});
