import fs from 'fs-extra';
import path from 'path';

async function main() {
  const theme = 'demo';
  const outCssDir = path.join(process.cwd(), 'output', theme, 'assets', 'css');
  await fs.ensureDir(outCssDir);
  const cssFile = path.join(outCssDir, 'unit-test.css');
  await fs.writeFile(cssFile, `/* unit */\n.hero{ background:url(../img/pic.png) center/cover no-repeat; }`, 'utf8');
  const { normalizeCssAssets } = await import('../tools/normalize-css-assets.js');
  await normalizeCssAssets({ outputPath: path.join(process.cwd(), 'output', theme), inputPath: path.join(process.cwd(), 'input', theme) });
  const result = await fs.readFile(cssFile, 'utf8');
  if (!/url\('assets\/normalized\/img\/pic\.png'\)/.test(result)) {
    console.error('❌ CSS url() normalization failed.');
    process.exit(1);
  }
  console.log('✅ CSS url() normalization test passed.');
}

main().catch(e => { console.error(e); process.exit(1); });

