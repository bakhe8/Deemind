#!/usr/bin/env node
/**
 * @domain DeemindTools
 * Scans JS files for exact and near-duplicate functions/files.
 * Produces reports/duplication-map.md
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const ROOT = process.cwd();
const SCAN_DIRS = ['tools','src','scripts','tests'];

function listJsFiles(dir) {
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

function normalizeCode(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '') // block comments
    .replace(/\/\/.*$/gm, '') // line comments
    .replace(/\s+/g, ' ') // collapse whitespace
    .trim();
}

function main() {
  const files = SCAN_DIRS.flatMap(d => listJsFiles(path.join(ROOT, d)));
  const fileHash = new Map();
  const funcHash = new Map();
  const funcRegex = /export\s+(async\s+)?function\s+([a-zA-Z0-9_]+)\s*\([^)]*\)\s*{[\s\S]*?}\s*/g;

  for (const f of files) {
    const raw = fs.readFileSync(f, 'utf8');
    const norm = normalizeCode(raw);
    const fh = crypto.createHash('md5').update(norm).digest('hex');
    if (!fileHash.has(fh)) fileHash.set(fh, []);
    fileHash.get(fh).push(f);

    let m;
    while ((m = funcRegex.exec(raw))) {
      const sig = m[0];
      const nh = crypto.createHash('md5').update(normalizeCode(sig)).digest('hex');
      if (!funcHash.has(nh)) funcHash.set(nh, []);
      funcHash.get(nh).push({ file: f, name: m[2] });
    }
  }

  const lines = [];
  lines.push('# Duplication Map');
  lines.push('');
  lines.push('## Identical Files');
  for (const [h, list] of fileHash.entries()) {
    if (list.length > 1) {
      lines.push(`- Hash ${h}:`);
      for (const f of list) lines.push(`  - ${path.relative(ROOT, f)}`);
    }
  }
  lines.push('');
  lines.push('## Duplicate Function Implementations');
  for (const [_h, list] of funcHash.entries()) {
    if (list.length > 1) {
      const names = Array.from(new Set(list.map(x => x.name))).join(', ');
      lines.push(`- ${names}`);
      for (const {file,name} of list) lines.push(`  - ${name} @ ${path.relative(ROOT, file)}`);
    }
  }

  const outDir = path.join(ROOT, 'reports');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);
  fs.writeFileSync(path.join(outDir, 'duplication-map.md'), lines.join('\n'));
}

main();

