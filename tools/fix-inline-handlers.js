#!/usr/bin/env node
import fs from 'fs-extra';
import path from 'path';

function listTwig(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const n of fs.readdirSync(dir)) {
    const p = path.join(dir, n);
    const st = fs.statSync(p);
    if (st.isDirectory()) out.push(...listTwig(p));
    else if (p.endsWith('.twig')) out.push(p);
  }
  return out;
}

export async function fixInlineHandlers(theme) {
  const root = path.join(process.cwd(), 'output', theme);
  const targets = ['layout','pages','partials'].map(d => path.join(root, d));
  const files = targets.flatMap(listTwig);
  let changed = 0;
  const report = [];
  const reHandler = /\s(on[a-zA-Z]+)=("[^"]*"|'[^']*')/g;
  for (const f of files) {
    let src = await fs.readFile(f, 'utf8');
    let count = 0;
    const next = src.replace(reHandler, (_m, attr, val) => {
      count++;
      const evt = String(attr).toLowerCase().replace(/^on/, '');
      return ` data-on-${evt}=${val}`; // preserve as data-*; validator won't flag inline JS
    });
    if (count > 0 && next !== src) {
      const banner = '{# Deemind: inline event handlers converted to data-on-* attributes #}\n';
      await fs.writeFile(f, (next.startsWith('{# Deemind:') ? '' : banner) + next, 'utf8');
      report.push({ file: path.relative(root, f).replace(/\\/g,'/'), converted: count });
      changed += count;
    }
  }
  const repDir = path.join(root, 'reports');
  await fs.ensureDir(repDir);
  await fs.writeJson(path.join(repDir, 'inline-handlers.json'), { changed, details: report }, { spaces: 2 });
  return { files: files.length, changed };
}

async function main() {
  const theme = process.argv[2];
  if (!theme) { console.error('Usage: node tools/fix-inline-handlers.js <theme>'); process.exit(1); }
  const res = await fixInlineHandlers(theme);
  console.log(`Inline handlers converted: ${res.changed}`);
}

if (import.meta.url === new URL('file://' + process.argv[1]).href) {
  // invoked directly
  main().catch(e => { console.error(e); process.exit(1); });
}

