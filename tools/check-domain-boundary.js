#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'src');

function listFiles(dir) {
  const out = [];
  const walk = d => {
    if (!fs.existsSync(d)) return;
    for (const n of fs.readdirSync(d)) {
      const p = path.join(d, n);
      const st = fs.statSync(p);
      if (st.isDirectory()) { if (n === 'node_modules' || n.startsWith('.')) continue; walk(p); }
      else if (/\.(js|mjs|cjs|ts)$/.test(p)) out.push(p);
    }
  };
  walk(dir);
  return out;
}

function main() {
  if (!fs.existsSync(SRC)) { console.log('No src/ directory present; boundary check skipped.'); return; }
  const files = listFiles(SRC);
  const diags = [];
  const re = /\bfrom\s+['"]([^'"\\]+)['"]|require\((['"])([^'"\\]+)\2\)/g;
  for (const f of files) {
    const txt = fs.readFileSync(f, 'utf8');
    let m; while ((m = re.exec(txt))) {
      const mod = m[1] || m[3];
      if (!mod) continue;
      if (mod.startsWith('tools/') || mod.includes('/tools/')) {
        diags.push(`${path.relative(ROOT, f)} -> ${mod}`);
      }
    }
  }
  if (diags.length) {
    console.error('❌ Domain boundary violations detected (no /tools imports allowed in /src):');
    for (const d of diags) console.error(' -', d);
    process.exit(1);
  }
  console.log('✅ Domain boundaries respected: no /tools imports in /src.');
}

main();

