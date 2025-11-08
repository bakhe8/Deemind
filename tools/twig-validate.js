#!/usr/bin/env node
import fs from 'fs-extra';
import path from 'path';

function list(dir, ext='.twig'){
  const out=[]; if(!fs.existsSync(dir)) return out;
  for(const n of fs.readdirSync(dir)){ const p=path.join(dir,n); const st=fs.statSync(p); if(st.isDirectory()) out.push(...list(p,ext)); else if(p.endsWith(ext)) out.push(p); }
  return out;
}

function extractSallaCalls(txt){
  const calls = new Set();
  const re = /\{\{\s*salla\.([a-zA-Z0-9_\.]+)\s*\}\}/g;
  let m; while((m=re.exec(txt))) calls.add(m[1]);
  return Array.from(calls);
}

async function main(){
  const theme = process.argv[2] || 'salla-new-theme';
  const root = path.join(process.cwd(),'output',theme);
  const knowledgePath = path.join(process.cwd(),'configs','knowledge','salla-docs.json');
  const knowledge = (await fs.pathExists(knowledgePath)) ? await fs.readJson(knowledgePath) : { helpers: [], webComponents: { tags: [] } };
  const allowed = new Set((knowledge.helpers||[]).map(h=>h.replace(/^salla\./,'')));
  const files = list(root);
  const invalid = [];
  for (const f of files){ const t = await fs.readFile(f,'utf8'); const calls=extractSallaCalls(t); for(const c of calls){ const key=c; const top=key.split('.')[0]; if(!allowed.has('salla.'+key) && !allowed.has(key) && !allowed.has(top)) { invalid.push({file:path.relative(root,f).replace(/\\/g,'/'), call:'salla.'+key}); } } }
  const lines = [];
  lines.push('# Salla Twig Validation');
  lines.push(`Theme: ${theme}`);
  lines.push(`Files scanned: ${files.length}`);
  lines.push(`Invalid calls: ${invalid.length}`);
  invalid.forEach(i=>lines.push(`- ${i.file}: {{ ${i.call} }}`));
  await fs.ensureDir(path.join(process.cwd(),'reports'));
  await fs.writeFile(path.join(process.cwd(),'reports','salla-twig-validation.md'), lines.join('\n'));
}

main().catch(e=>{ console.error(e); process.exit(1); });

