#!/usr/bin/env node
/**
 * @domain DeemindTools
 * Builds a lightweight dependency graph (adjacency) and writes reports/architecture-graph.md.
 */
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const SCAN = ['cli.js','tools'];
const RE = /\bfrom\s+['"]([^'"\\]+)['"]|require\((['"])([^'"\\]+)\2\)/g;

function listFiles(base) {
  const files = [];
  const walk = d => {
    const p = path.join(ROOT, d);
    if (!fs.existsSync(p)) return;
    const st = fs.statSync(p);
    if (st.isFile()) { files.push(d); return; }
    for (const n of fs.readdirSync(p)) {
      const child = path.join(d, n);
      const st2 = fs.statSync(path.join(ROOT, child));
      if (st2.isDirectory()) { if (n === 'node_modules' || n.startsWith('.')) continue; walk(child); }
      else if (/\.(js|mjs|cjs)$/.test(child)) files.push(child);
    }
  };
  for (const d of SCAN) walk(d);
  return files;
}

function main() {
  const files = listFiles('');
  const edges = [];
  const nodes = new Set();
  for (const rel of files) {
    const abs = path.join(ROOT, rel);
    const txt = fs.readFileSync(abs, 'utf8');
    nodes.add(rel);
    let m; while ((m = RE.exec(txt))) {
      const mod = m[1] || m[3];
      if (!mod) continue;
      if (mod.startsWith('.') || mod.startsWith('tools/') || mod.startsWith('..')) {
        // normalize to relative
        const target = mod.startsWith('tools/') ? mod + (mod.endsWith('.js')?'':'.js') : path.normalize(path.join(path.dirname(rel), mod)).replace(/\\/g,'/');
        edges.push([rel.replace(/\\/g,'/'), target]);
        nodes.add(target);
      }
    }
  }
  const lines = [];
  lines.push('# Architecture Graph');
  lines.push('');
  lines.push('## Edges (importer → imported)');
  edges.sort().forEach(([a,b]) => lines.push(`- ${a} → ${b}`));
  lines.push('');
  lines.push(`Nodes: ${nodes.size}`);
  lines.push(`Edges: ${edges.length}`);

  const outDir = path.join(ROOT, 'reports');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);
  fs.writeFileSync(path.join(outDir, 'architecture-graph.md'), lines.join('\n'));
}

main();

