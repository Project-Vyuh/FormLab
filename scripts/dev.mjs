import { spawn } from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {configuration} from '../server/config.mjs';
process.chdir(fileURLToPath(new URL('..',import.meta.url)));
await configuration();
process.env.FORMLAB_WEB_PORT ||= '3017';
process.env.FORMLAB_WEB_ORIGINS ||= `http://127.0.0.1:${process.env.FORMLAB_WEB_PORT},http://localhost:${process.env.FORMLAB_WEB_PORT}`;
console.log(`FormLab local checkout: ${process.cwd()}; open http://127.0.0.1:${process.env.FORMLAB_WEB_PORT}`);

const children = [
  spawn(process.execPath, ['server/index.mjs'], { stdio: 'inherit', env: process.env }),
  spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'dev:web'], { stdio: 'inherit', env: process.env }),
];

let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  process.exitCode=code;
  for (const child of children) child.kill('SIGTERM');
  setTimeout(() => process.exit(code), 6000).unref();
}

for (const child of children) {
  child.on('exit', code => {
    if (!stopping) stop(code || 1);
  });
  child.on('error', () => stop(1));
}

process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));
