#!/usr/bin/env node
import fs from 'fs-extra';
import path from 'path';

function list(dir, ext = '.twig') {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const n of fs.readdirSync(dir)) {
    const p = path.join(dir, n);
    const st = fs.statSync(p);
    if (st.isDirectory()) out.push(...list(p, ext)); else if (p.endsWith(ext)) out.push(p);
  }
  return out;
}

async function main() {
  const theme = process.argv[2] || 'demo';
  const root = path.join(process.cwd(), 'output', theme);
  const allow = await fs.readJson(path.join(process.cwd(), 'configs', 'twig-allowlist.json')).catch(() => ({ tags: [], filters: [], functions: [], sallaHelpers: [] }));

  const files = list(root);
  const errors = [];
  const reTag = /\{\%\s*([a-zA-Z_][a-zA-Z0-9_]*)\b/g;
  const reFilter = /\|\s*([a-zA-Z_][a-zA-Z0-9_]*)\b/g;
  const reCall = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_\.]*)\s*\(/g;

  for (const f of files) {
    const txt = await fs.readFile(f, 'utf8');
    let m;
    while ((m = reTag.exec(txt))) {
      const tag = m[1];
      if (!allow.tags.includes(tag)) errors.push({ file: f, type: 'tag', value: tag });
    }
    while ((m = reFilter.exec(txt))) {
      const filt = m[1];
      if (!allow.filters.includes(filt)) errors.push({ file: f, type: 'filter', value: filt });
    }
    while ((m = reCall.exec(txt))) {
      const fn = m[1];
      if (!(allow.functions.includes(fn) || allow.sallaHelpers.some(h => fn.startsWith(h)))) {
        errors.push({ file: f, type: 'function', value: fn });
      }
    }
  }

  const repDir = path.join(process.cwd(), 'reports');
  await fs.ensureDir(repDir);
  await fs.writeJson(path.join(repDir, `twig-lint-${theme}.json`), { theme, files: files.length, errors }, { spaces: 2 });
  if (errors.length) {
    console.error(`Twig lint failed: ${errors.length} issues`);
    process.exit(1);
  }
  console.log('Twig lint passed.');
}

main().catch(e => { console.error(e); process.exit(1); });

