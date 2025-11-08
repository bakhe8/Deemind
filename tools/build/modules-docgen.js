#!/usr/bin/env node
/**
 * @domain DeemindTools
 * Generates docs/modules.md with a map of files → exported symbols.
 */
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const SCAN = ['cli.js','tools'];
const OUT = path.join(ROOT, 'docs', 'modules.md');

const EXPR = {
  exportFunc: /export\s+(async\s+)?function\s+([a-zA-Z0-9_]+)\s*\(/g,
  exportNamed: /export\s*\{([^}]+)\}\s*;?/g,
  exportClass: /export\s+class\s+([A-Za-z0-9_]+)/g,
  domainTag: /@domain\s+(\S+)/
};

function listFiles(base) {
  const out = [];
  const walk = d => {
    const p = path.join(ROOT, d);
    if (!fs.existsSync(p)) return;
    if (fs.statSync(p).isFile()) { out.push(d); return; }
    for (const n of fs.readdirSync(p)) {
      const child = path.join(d, n);
      const abs = path.join(ROOT, child);
      const st = fs.statSync(abs);
      if (st.isDirectory()) { if (n === 'node_modules' || n.startsWith('.')) continue; walk(child); }
      else if (/\.(js|mjs|cjs)$/.test(child)) out.push(child);
    }
  };
  SCAN.forEach(walk);
  return out;
}

function main() {
  const files = listFiles('');
  const lines = [];
  lines.push('# Modules Map');
  lines.push('');
  for (const f of files.sort()) {
    const txt = fs.readFileSync(path.join(ROOT, f), 'utf8');
    const items = new Set();
    let m;
    while ((m = EXPR.exportFunc.exec(txt))) items.add(m[2]);
    while ((m = EXPR.exportClass.exec(txt))) items.add(m[1]);
    while ((m = EXPR.exportNamed.exec(txt))) String(m[1]).split(',').map(s=>s.trim()).filter(Boolean).forEach(x=>items.add(x.split(' as ')[0].trim()));
    const dm = EXPR.domainTag.exec(txt);
    const domain = dm ? dm[1] : 'Unspecified';
    lines.push(`- ${f} — domain: ${domain}`);
    if (items.size) {
      items.forEach(i => lines.push(`  - ${i}`));
    }
  }
  if (!fs.existsSync(path.dirname(OUT))) fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, lines.join('\n'));
}

main();

