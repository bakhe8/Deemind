#!/usr/bin/env node
/**
 * @domain DeemindTools
 * Naive coverage helper: list exported functions/classes without tests and stub pending tests.
 */
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const SCAN_DIRS = ['tools','cli.js'];
const TESTS_DIR = path.join(ROOT, 'tests', 'pending');

const EXPR = {
  exportFunc: /export\s+(async\s+)?function\s+([a-zA-Z0-9_]+)\s*\(/g,
  exportNamed: /export\s*\{([^}]+)\}\s*;?/g,
  exportClass: /export\s+class\s+([A-Za-z0-9_]+)/g
};

function listFiles() {
  const out = [];
  const walk = d => {
    const p = path.join(ROOT, d);
    if (!fs.existsSync(p)) return;
    if (fs.statSync(p).isFile()) { out.push(d); return; }
    for (const n of fs.readdirSync(p)) {
      const child = path.join(d, n);
      const abs = path.join(ROOT, child);
      if (fs.statSync(abs).isDirectory()) { if (n === 'node_modules' || n.startsWith('.')) continue; walk(child); }
      else if (/\.(js|mjs|cjs)$/.test(child)) out.push(child);
    }
  };
  SCAN_DIRS.forEach(walk);
  return out;
}

function extractExports(file) {
  const txt = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const items = new Set();
  let m;
  while ((m = EXPR.exportFunc.exec(txt))) items.add(m[2]);
  while ((m = EXPR.exportClass.exec(txt))) items.add(m[1]);
  while ((m = EXPR.exportNamed.exec(txt))) {
    String(m[1]).split(',').map(s=>s.trim()).filter(Boolean).forEach(x=>items.add(x.split(' as ')[0].trim()));
  }
  return Array.from(items);
}

function hasTest(name) {
  // naive: search tests/ for name occurrence
  const td = path.join(ROOT, 'tests');
  if (!fs.existsSync(td)) return false;
  const walk = d => {
    for (const n of fs.readdirSync(d)) {
      const p = path.join(d, n);
      const st = fs.statSync(p);
      if (st.isDirectory()) walk(p); else if (st.isFile()) {
        const t = fs.readFileSync(p, 'utf8');
        if (t.includes(name)) return true;
      }
    }
    return false;
  };
  return walk(td);
}

function main() {
  if (!fs.existsSync(TESTS_DIR)) fs.mkdirSync(TESTS_DIR, { recursive: true });
  const files = listFiles();
  const uncovered = [];
  for (const f of files) {
    const exps = extractExports(f);
    for (const e of exps) {
      if (!hasTest(e)) {
        uncovered.push({ file: f, name: e });
        const stub = `// auto-generated pending test\ndescribe('${e}', () => { it('pending', () => { /* TODO */ }); });\n`;
        const safe = f.replace(/[\\/]/g,'_');
        fs.writeFileSync(path.join(TESTS_DIR, `${safe}.${e}.spec.js`), stub);
      }
    }
  }
  const lines = [];
  lines.push('# Test Coverage Summary');
  lines.push('');
  lines.push(`Uncovered exports: ${uncovered.length}`);
  uncovered.forEach(u => lines.push(`- ${u.name} @ ${u.file}`));
  const outDir = path.join(ROOT, 'reports');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);
  fs.writeFileSync(path.join(outDir, 'test-coverage-summary.md'), lines.join('\n'));
}

main();

