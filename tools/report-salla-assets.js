#!/usr/bin/env node
import fs from 'fs-extra';
import path from 'path';
import { validateSallaAssets } from './validate-salla-assets.js';

async function listThemes() {
  const outDir = path.join(process.cwd(), 'output');
  if (!(await fs.pathExists(outDir))) return [];
  const ents = await fs.readdir(outDir, { withFileTypes: true });
  return ents.filter(e=>e.isDirectory()).map(e=>e.name);
}

async function main() {
  const themes = await listThemes();
  const lines = [];
  lines.push('# Salla Assets Summary');
  for (const t of themes) {
    const rep = await validateSallaAssets(t);
    lines.push(`\n## ${t}`);
    lines.push(`- errors: ${(rep.errors||[]).length}`);
    lines.push(`- warnings: ${(rep.warnings||[]).length}`);
    (rep.warnings||[]).forEach(w=>lines.push(`  - ${w.type}: ${JSON.stringify(w)}`));
  }
  await fs.ensureDir(path.join(process.cwd(),'reports'));
  await fs.writeFile(path.join(process.cwd(),'reports','salla-assets-summary.md'), lines.join('\n'));
}

main().catch(e => { console.error(e); process.exit(1); });

