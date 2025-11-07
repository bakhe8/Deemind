import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';

export async function generateBuildManifest(outputPath, { coreReport, elapsedSec, layoutMap, inputChecksum } = {}) {
  const theme = path.basename(outputPath);
  const pagesDir = path.join(outputPath, 'pages');
  const layoutDir = path.join(outputPath, 'layout');
  const assetsDir = path.join(outputPath, 'assets');

  const pages = await listFiles(pagesDir, '.twig');
  const components = await listFiles(layoutDir, '.twig');
  const assets = await listAllFiles(assetsDir);

  const checksum = await hashOfContents([...pages, ...components, ...assets]);

  const manifest = {
    theme,
    version: '1.0.0',
    engine: 'Deemind 1.0',
    adapter: 'Salla',
    timestamp: new Date().toISOString(),
    pages: pages.length,
    components: components.length,
    assets: assets.length,
    checksum,
    factoryVersion: '1.0.0',
    elapsedSec,
    warnings: coreReport?.issues?.length || 0,
    pageOrder: layoutMap?.map(l => l.page) || [],
    failedFiles: (coreReport?.issues || []).filter(i => i.level==='critical').map(i => i.file).filter(Boolean),
    inputChecksum,
  };

  // Append analytics build history (respect local settings)
  try {
    const settingsPath = path.resolve('configs', 'settings.json');
    const settings = (await fs.pathExists(settingsPath)) ? await fs.readJson(settingsPath) : {};
    if (settings.enableAnalytics) {
      const analyticsDir = path.join(process.cwd(), 'analytics');
      const historyFile = path.join(analyticsDir, 'build-history.json');
      await fs.ensureDir(analyticsDir);
      let history = [];
      if (await fs.pathExists(historyFile)) {
        try { history = await fs.readJson(historyFile); } catch { history = []; }
      }
      history.push({ ...manifest });
      await fs.writeJson(historyFile, history, { spaces: 2 });
    }
  } catch (err) { void err; }

  return manifest;
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

async function hashOfContents(files) {
  const h = crypto.createHash('md5');
  for (const f of files) {
    try {
      const buf = await fs.readFile(f);
      h.update(buf);
    } catch (err) { void err; }
  }
  return h.digest('hex');
}
