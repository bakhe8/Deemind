#!/usr/bin/env node
import fs from 'fs-extra';
import path from 'path';

function extractVars(css) {
  const out = new Set();
  const re = /var\((--[a-zA-Z0-9_-]+)\)/g;
  let m; while ((m = re.exec(css))) out.add(m[1]);
  return Array.from(out);
}

async function main() {
  const theme = process.argv[2] || 'salla-new-theme';
  const cssPath = path.join(process.cwd(),'output',theme,'assets','styles.css');
  const tokensPath = path.join(process.cwd(),'configs','design-tokens.json');
  const css = (await fs.pathExists(cssPath)) ? await fs.readFile(cssPath,'utf8') : '';
  const used = extractVars(css);
  const tokens = (await fs.pathExists(tokensPath)) ? await fs.readJson(tokensPath) : {};
  const official = new Set(Object.keys(tokens));
  const missing = used.filter(v => !official.has(v));
  const unused = Object.keys(tokens).filter(v => !used.includes(v));
  const lines = [];
  lines.push('# Salla CSS Tokens Diff');
  lines.push(`Theme: ${theme}`);
  lines.push(`Used: ${used.length}`);
  lines.push(`Missing (not in official tokens): ${missing.length}`);
  missing.forEach(m=>lines.push(`- ${m}`));
  lines.push(`\nUnused tokens in config: ${unused.length}`);
  unused.forEach(u=>lines.push(`- ${u}`));
  await fs.ensureDir(path.join(process.cwd(),'reports'));
  await fs.writeFile(path.join(process.cwd(),'reports','salla-css-tokens-diff.md'), lines.join('\n'));
}

main().catch(e => { console.error(e); process.exit(1); });

