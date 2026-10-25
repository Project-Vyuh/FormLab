import { mkdir, chmod } from 'node:fs/promises';
import { loadEnvFile } from 'node:process';
import { resolve, join } from 'node:path';

export async function configuration() {
  // OS environment wins, then .env.local, then .env. Never expose values to Vite.
  for (const file of [process.env.FORMLAB_ENV_FILE, '.env.local', '.env'].filter(Boolean)) {
    try { loadEnvFile(file); } catch (error) { if (error.code !== 'ENOENT') throw error;if(file===process.env.FORMLAB_ENV_FILE)throw Error('Configured external env file does not exist'); }
  }
  for(const [name,allowed] of Object.entries({FORMLAB_DEPLOYMENT_MODE:['local'],FORMLAB_DB_PROVIDER:['sqlite'],FORMLAB_AUTH_PROVIDER:['local'],FORMLAB_STORAGE_PROVIDER:['filesystem']})){
    if(process.env[name]&&!allowed.includes(process.env[name]))throw Error(`${name}: this build supports only ${allowed.join(', ')}; production adapters are not configured`);
  }
  const number = (name, fallback, min, max) => {
    const value = Number(process.env[name] ?? fallback);
    if (!Number.isInteger(value) || value < min || value > max) throw Error(`Invalid ${name}`);
    return value;
  };
  const directory = resolve(process.env.FORMLAB_DATA_DIR || '.formlab');
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await chmod(directory, 0o700);
  await mkdir(join(directory, 'assets'), { recursive: true, mode: 0o700 });
  const provider = process.env.FORMLAB_AI_PROVIDER || 'gemini';
  if (!['gemini', 'fake'].includes(provider)) throw Error('Unsupported FORMLAB_AI_PROVIDER');
  return {
    directory, provider, key: process.env.GEMINI_API_KEY,
    port: number('FORMLAB_API_PORT', 8787, 1, 65535),
    origins: new Set((process.env.FORMLAB_WEB_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000').split(',')),
    concurrency: number('FORMLAB_WORKERS', 2, 1, 8),
    memoryBudget: number('FORMLAB_MEMORY_BUDGET_BYTES', 512*1024*1024, 64*1024*1024, 4*1024*1024*1024),
    maxRss: number('FORMLAB_MAX_RSS_BYTES', 768*1024*1024, 64*1024*1024, 8*1024*1024*1024),
    retentionEnabled: process.env.FORMLAB_RETENTION_ENABLED==='true',
    jobRetentionMs: number('FORMLAB_JOB_RETENTION_DAYS',30,1,3650)*86400000,
    orphanRetentionMs: number('FORMLAB_ORPHAN_RETENTION_DAYS',7,1,3650)*86400000,
    trashRetentionMs: number('FORMLAB_TRASH_RETENTION_DAYS',7,1,3650)*86400000,
    dailyBudgetUnits: number('FORMLAB_DAILY_BUDGET_UNITS',100,1,1000000),
    dailyLimit: number('FORMLAB_DAILY_JOB_LIMIT', 50, 1, 10000),
    pendingLimit: number('FORMLAB_PENDING_JOB_LIMIT', 10, 1, 100),
    assetLimit: number('FORMLAB_MAX_ASSET_BYTES', 20 * 1024 * 1024, 1024, 100 * 1024 * 1024),
    storageLimit: number('FORMLAB_USER_STORAGE_BYTES', 1024 * 1024 * 1024, 1024, 100 * 1024 * 1024 * 1024),
    videoEnabled: process.env.FORMLAB_VIDEO_ENABLED === 'true',
    registration: process.env.FORMLAB_ALLOW_REGISTRATION === 'true',
    fakeDelay: number('FORMLAB_FAKE_DELAY_MS', 30, 0, 60000),
    fakeImage: process.env.FORMLAB_FAKE_IMAGE_PATH,
    models: {
      'gemini-2.5-flash': process.env.FORMLAB_TEXT_MODEL || 'gemini-2.5-flash',
      'gemini-2.5-flash-image': process.env.FORMLAB_IMAGE_MODEL || 'gemini-2.5-flash-image',
      'gemini-3-pro-image-preview': process.env.FORMLAB_PRO_MODEL || 'gemini-3-pro-image-preview',
      'veo-3.1-fast-generate-preview': process.env.FORMLAB_VIDEO_MODEL || 'veo-3.1-fast-generate-preview',
    },
  };
}
export const problem = (status, code, message) => Object.assign(new Error(message), { status, code });
export function object(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw problem(400, 'INVALID_INPUT', 'Expected a JSON object');
  return value;
}
