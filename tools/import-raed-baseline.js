// Scans .baselines/theme-raed and extracts non-copyrightable
// structural patterns (includes/extends/blocks/variables/i18n keys)
// Writes results to configs/baselines/raed/*.json for adapter/validator use.
// Safe: stores only names/paths/signatures, not template content.

/* eslint-disable no-useless-escape */
import fs from 'fs';
import path from 'path';

const RAED_ROOT = path.resolve('.baselines/theme-raed');
const OUT_DIR   = path.resolve('configs/baselines/raed');

const INCLUDE_RX = /\{\%\s*(?:include|embed)\s+['\"]([^'\"]+)['\"]/g;
const EXTENDS_RX = /\{\%\s*extends\s+['\"]([^'\"]+)['\"]/g;
const BLOCK_RX   = /\{\%\s*block\s+([a-zA-Z0-9_\-]+)\s*\%\}/g;
const VAR_RX     = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_\.\[\]]*)/g;
const I18N_RX    = /\|\s*t\b|\{\%\s*trans\b/g;

function walk(dir, out=[]) {
  for (const n of fs.readdirSync(dir)) {
    const full = path.join(dir, n);
    const st = fs.statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (n.endsWith('.twig')) out.push(full);
  }
  return out;
}

function uniq(arr){ return Array.from(new Set(arr)).sort(); }

function extractFromTwig(content){
  const includes = [];
  const extendsArr = [];
  const blocks = [];
  const vars = new Set();
  let hasI18n = false;

  let m;
  while((m = INCLUDE_RX.exec(content))) includes.push(m[1]);
  while((m = EXTENDS_RX.exec(content))) extendsArr.push(m[1]);
  while((m = BLOCK_RX.exec(content))) blocks.push(m[1]);
  while((m = VAR_RX.exec(content))) vars.add(m[1].split('(')[0]);
  hasI18n = I18N_RX.test(content);

  return { includes, extendsArr, blocks, vars: Array.from(vars), hasI18n };
}

function writeJSON(p, data){
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2));
}

function main(){
  if (!fs.existsSync(RAED_ROOT)) {
    console.error('Missing baseline repo at', RAED_ROOT);
    process.exit(1);
  }
  const files = walk(path.join(RAED_ROOT, 'src'));
  const graph = {};
  const counts = { includes: {}, blocks: {}, vars: {} };
  let extendsMap = {};
  let i18nFiles = 0;

  for (const f of files) {
    const rel = path.relative(RAED_ROOT, f).replace(/\\/g,'/');
    const txt = fs.readFileSync(f, 'utf8');
    const meta = extractFromTwig(txt);
    graph[rel] = {
      includes: uniq(meta.includes),
      extends: uniq(meta.extendsArr),
      blocks: uniq(meta.blocks),
      vars: uniq(meta.vars),
      i18n: !!meta.hasI18n
    };
    if (meta.hasI18n) i18nFiles++;
    for (const i of meta.includes) counts.includes[i] = (counts.includes[i]||0)+1;
    for (const b of meta.blocks) counts.blocks[b] = (counts.blocks[b]||0)+1;
    for (const v of meta.vars) counts.vars[v] = (counts.vars[v]||0)+1;
    for (const p of meta.extendsArr) extendsMap[rel] = p;
  }

  const summary = {
    totalTwig: files.length,
    i18nFiles,
    topIncludes: Object.entries(counts.includes).sort((a,b)=>b[1]-a[1]).slice(0,50),
    topBlocks: Object.entries(counts.blocks).sort((a,b)=>b[1]-a[1]).slice(0,50),
    topVars: Object.entries(counts.vars).sort((a,b)=>b[1]-a[1]).slice(0,100)
  };

  writeJSON(path.join(OUT_DIR, 'graph.json'), graph);
  writeJSON(path.join(OUT_DIR, 'summary.json'), summary);

  // Conventions (folder expectations) inferred from paths
  const conventions = {
    layoutDir: 'src/views/layout',
    pagesDir: 'src/views/pages',
    partialsDir: 'src/views/components',
    assetsDir: 'src/assets',
    locales: ['src/locales/ar.json','src/locales/en.json']
  };
  writeJSON(path.join(OUT_DIR, 'conventions.json'), conventions);

  console.log('✅ Imported Raed baseline →', OUT_DIR);
}

main();
