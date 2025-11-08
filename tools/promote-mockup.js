#!/usr/bin/env node
import fs from 'fs-extra';
import path from 'path';

async function main() {
  const theme = process.argv[2];
  if (!theme) { console.error('Usage: node tools/promote-mockup.js <theme-name>'); process.exit(1); }
  const mock = path.join(process.cwd(), 'mockups', theme);
  if (!(await fs.pathExists(mock))) { console.error('No mockup found at', mock); process.exit(1); }
  const inputDir = path.join(process.cwd(), 'input', theme);
  await fs.ensureDir(inputDir);
  // Create minimal input based on preview
  const html = await fs.readFile(path.join(mock, 'preview.html'), 'utf8');
  await fs.writeFile(path.join(inputDir, 'index.html'), html, 'utf8');
  const assetsDir = path.join(inputDir, 'assets');
  await fs.ensureDir(assetsDir);
  const css = await fs.readFile(path.join(mock, 'tokens.css'), 'utf8') + '\n' + await fs.readFile(path.join(mock, 'preview.css'), 'utf8');
  await fs.writeFile(path.join(assetsDir, 'style.css'), css, 'utf8');
  await fs.writeFile(path.join(assetsDir, 'app.js'), "// promoted from mockup\n", 'utf8');

  console.log(`Promoted mockup to input/${theme}. Building theme...`);
  const { execSync } = await import('child_process');
  execSync(`node cli.js ${theme} --sanitize --i18n --autofix`, { stdio: 'inherit' });
  console.log('Build completed.');
}

main().catch(e => { console.error(e); process.exit(1); });

