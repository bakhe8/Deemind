import path from 'path';
import fs from 'fs-extra';

async function run() {
  const outRoot = path.join(process.cwd(), 'output');
  if (!(await fs.pathExists(outRoot))) return;
  const themes = (await fs.readdir(outRoot, { withFileTypes: true }))
    .filter(e => e.isDirectory()).map(e => e.name);
  for (const theme of themes) {
    try {
      const outputPath = path.join(outRoot, theme);
      const inputPath = path.join(process.cwd(), 'input', theme);
      const { fixMissingAssets } = await import('./fix-missing-assets.js');
      await fixMissingAssets(theme);
      const { normalizeCssAssets } = await import('./normalize-css-assets.js');
      await normalizeCssAssets({ outputPath, inputPath });
    } catch (e) { /* ignore per theme */ }
  }
}

run().catch(e => { console.error(e); process.exit(1); });

