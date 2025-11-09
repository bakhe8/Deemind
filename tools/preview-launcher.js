#!/usr/bin/env node
import { spawn } from 'child_process';
import path from 'path';
import open from 'open';

const theme = process.argv[2] || 'demo';
const port = Number(process.env.PREVIEW_PORT || 4100);
const root = process.cwd();

function run(command, args = [], opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      cwd: root,
      ...opts,
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve(null);
      else reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

async function main() {
  console.log(`🧩 Seeding preview snapshots for ${theme}...`);
  await run(process.execPath, ['tools/preview-static.js', theme]);

  console.log('⚡ Launching runtime stub...');
  const stub = spawn(process.execPath, ['server/runtime-stub.js', theme], {
    cwd: root,
    env: { ...process.env, PREVIEW_PORT: String(port) },
    stdio: 'inherit',
  });

  process.on('SIGINT', () => {
    stub.kill();
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    stub.kill();
    process.exit(0);
  });

  setTimeout(() => {
    console.log(`🌐 Opening http://localhost:${port}/page/index`);
    open(`http://localhost:${port}/page/index`).catch(() => undefined);
  }, 1500);
}

main().catch((err) => {
  console.error('Preview launcher failed:', err);
  process.exit(1);
});
