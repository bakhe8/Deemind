#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs-extra';
import path from 'path';

const BASES = [
  { name: 'raed', repo: 'https://github.com/SallaApp/theme-raed.git' },
  { name: 'luna', repo: 'https://github.com/SallaApp/theme-luna.git' },
  { name: 'mono', repo: 'https://github.com/SallaApp/theme-mono.git' }
];

async function main() {
  const baseRoot = path.join(process.cwd(), '.baselines');
  await fs.ensureDir(baseRoot);
  for (const b of BASES) {
    const dir = path.join(baseRoot, `theme-${b.name}`);
    if (await fs.pathExists(dir)) { console.log(`Baseline exists: ${b.name}`); continue; }
    try {
      console.log(`Cloning ${b.repo} -> ${dir}`);
      execSync(`git clone --depth 1 ${b.repo} "${dir}"`, { stdio: 'inherit' });
    } catch (e) {
      console.warn(`Skip clone ${b.name}: ${e?.message || e}`);
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });

