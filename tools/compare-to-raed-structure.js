#!/usr/bin/env node
import fs from 'fs-extra';
import path from 'path';

function list(dir, ext = '.twig') {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const n of fs.readdirSync(dir)) {
    const p = path.join(dir, n);
    const st = fs.statSync(p);
    if (st.isDirectory()) out.push(...list(p, ext)); else if (!ext || p.endsWith(ext)) out.push(p);
  }
  return out.map(p => p.replace(/\\/g,'/'));
}

function basenameNoDir(files) {
  return files.map(f => f.split('/').slice(-1)[0]);
}

async function main() {
  const baselineRoot = path.resolve('.baselines', 'theme-raed');
  const outRoot = path.resolve('output', 'demo');
  const reports = path.resolve('reports');
  await fs.ensureDir(reports);
  const basePages = list(path.join(baselineRoot, 'pages'));
  const outPages = list(path.join(outRoot, 'pages'));
  const baseNames = new Set(basenameNoDir(basePages));
  const outNames = new Set(basenameNoDir(outPages));
  let inter = 0;
  for (const n of outNames) if (baseNames.has(n)) inter++;
  const union = new Set([...baseNames, ...outNames]).size || 1;
  const jaccard = inter / union;
  const lines = [];
  lines.push('# Raed Structure Overlap');
  lines.push(`Overlap (Jaccard of page basenames): ${(jaccard*100).toFixed(2)}%`);
  lines.push(`Out pages: ${outNames.size}, Base pages: ${baseNames.size}, Intersect: ${inter}`);
  await fs.writeFile(path.join(reports, 'salla-raed-structure-overlap.md'), lines.join('\n'));
  await fs.writeJson(path.join(reports, 'salla-raed-structure-overlap.json'), { jaccard, outPages: outNames.size, basePages: baseNames.size, intersect: inter }, { spaces: 2 });
}

main().catch(e => { console.error(e); process.exit(1); });

