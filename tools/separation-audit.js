#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();

function listFiles(dir) {
  const out = [];
  const walk = d => {
    if (!fs.existsSync(d)) return;
    for (const n of fs.readdirSync(d)) {
      const p = path.join(d, n); const st = fs.statSync(p);
      if (st.isDirectory()) { if (n === 'node_modules' || n.startsWith('.')) continue; walk(p); }
      else out.push(p);
    }
  };
  walk(dir); return out;
}

function main() {
  const srcDir = path.join(ROOT, 'src');
  const importRe = /\bfrom\s+['"]([^'"\\]+)['"]|require\((['"])([^'"\\]+)\2\)/g;
  const sep = [];
  let cross = 0;
  if (fs.existsSync(srcDir)) {
    for (const f of listFiles(srcDir)) {
      try {
        const txt = fs.readFileSync(f,'utf8');
        let m; while ((m = importRe.exec(txt))) {
          const mod = m[1] || m[3]; if (!mod) continue;
          if (mod.startsWith('tools/') || mod.includes('/tools/')) { cross++; sep.push(`Cross import: ${path.relative(ROOT,f)} -> ${mod}`); }
        }
      } catch (e) { void e; }
    }
  }
  const score = cross === 0 ? 100 : Math.max(0, 100 - cross*10);
  const outDir = path.join(ROOT,'reports','harmony');
  fs.mkdirSync(outDir,{recursive:true});
  const lines = ['# Separation Audit', '', sep.length? sep.map(d=>`- ${d}`).join('\n'):'- No violations detected', '', `Score: ${score}`];
  fs.writeFileSync(path.join(outDir,'separation-audit.md'), lines.join('\n'));
  console.log('Separation audit complete, score', score);
}

main();
