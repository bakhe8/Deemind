#!/usr/bin/env node
/**
 * @domain DeemindTools
 * Purpose: Watch input/ for newly created theme folders and automatically run
 *          the new-theme pipeline (build → i18n wrap → validate → snapshot).
 */
import fs from 'fs';
import fsx from 'fs-extra';
import path from 'path';
import { exec } from 'child_process';

const ROOT = process.cwd();
const INPUT = path.join(ROOT, 'input');

function run(cmd) {
  const child = exec(cmd, { cwd: ROOT });
  child.stdout?.pipe(process.stdout);
  child.stderr?.pipe(process.stderr);
}

async function main() {
  await fsx.ensureDir(INPUT);
  const known = new Set(
    fsx.readdirSync(INPUT).filter(d => fsx.statSync(path.join(INPUT, d)).isDirectory())
  );
  console.log(`👀 Watching for new themes in ${INPUT} ...`);
  // Initial detect (process any theme not yet snapshotted)
  run('npm run -s deemind:new');

  fs.watch(INPUT, { recursive: false }, async (eventType, filename) => {
    if (!filename) return;
    const full = path.join(INPUT, filename);
    // Only react to new directories
    if (!await fsx.pathExists(full)) return;
    const stat = await fsx.stat(full).catch(() => null);
    if (!stat || !stat.isDirectory()) return;
    if (known.has(filename)) return; // already processed
    known.add(filename);
    console.log(`📂 Detected new theme folder: ${filename}`);
    run(`node tools/new-theme-pipeline.js ${filename}`);
  });
}

main().catch(e => { console.error(e); process.exit(1); });

