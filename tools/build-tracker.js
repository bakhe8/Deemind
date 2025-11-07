import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';

export async function generateBuildManifest(outputPath) {
  const theme = path.basename(outputPath);
  const pagesDir = path.join(outputPath, 'pages');
  const layoutDir = path.join(outputPath, 'layout');
  const assetsDir = path.join(outputPath, 'assets');

  const pages = await listFiles(pagesDir, '.twig');
  const components = await listFiles(layoutDir, '.twig');
  const assets = await listAllFiles(assetsDir);

  const checksum = hashOf([...pages, ...components, ...assets]);

  return {
    theme,
    version: '1.0.0',
    engine: 'Deemind 1.0',
    adapter: 'Salla',
    timestamp: new Date().toISOString(),
    pages: pages.length,
    components: components.length,
    assets: assets.length,
    checksum,
  };
}

async function listFiles(dir, ext) {
  const out = [];
  async function walk(d) {
    if (!(await fs.pathExists(d))) return;
    const entries = await fs.readdir(d, { withFileTypes: true });
    for (const e of entries) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) await walk(p);
      else if (!ext || p.endsWith(ext)) out.push(p);
    }
  }
  await walk(dir);
  return out;
}

async function listAllFiles(dir) {
  return listFiles(dir);
}

function hashOf(files) {
  const h = crypto.createHash('md5');
  for (const f of files) h.update(f);
  return h.digest('hex');
}

