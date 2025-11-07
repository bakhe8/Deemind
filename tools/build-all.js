import fs from 'fs-extra';
import path from 'path';
import { spawn } from 'node:child_process';

async function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: 'inherit', shell: false, ...opts });
    p.on('close', (code) => {
      if (code === 0) resolve(); else reject(new Error(`${cmd} ${args.join(' ')} exited with ${code}`));
    });
  });
}

async function main() {
  const inputDir = path.join(process.cwd(), 'input');
  if (!(await fs.pathExists(inputDir))) {
    console.error('No input/ directory found.');
    process.exit(1);
  }
  const entries = await fs.readdir(inputDir, { withFileTypes: true });
  const themes = entries.filter(e => e.isDirectory()).map(e => e.name);
  if (themes.length === 0) {
    console.log('No themes found under input/.');
    return;
  }
  for (const theme of themes) {
    console.log(`\n=== Building theme: ${theme} ===`);
    await run(process.execPath, ['cli.js', theme]);
  }
  console.log('\nAll themes built.');
}

main().catch((e) => { console.error(e); process.exit(1); });

