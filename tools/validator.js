import fs from 'fs-extra';
import path from 'path';
import { glob } from 'glob';

/**
 * Core validator focused on structure and minimal Twig hygiene.
 * Why: Run a fast, low‑noise gate before deeper checks to keep the
 * main CLI responsive; extended checks run in a separate pass.
 */
export async function validateTheme(outputPath) {
  const layoutDir = path.join(outputPath, 'layout');
  const pagesDir = path.join(outputPath, 'pages');
  const reportPath = path.join(outputPath, 'report.json');

  const issues = [];
  const exists = async (p) => (await fs.pathExists(p));

  if (!(await exists(layoutDir))) issues.push({ level: 'critical', type: 'missing-dir', dir: 'layout' });
  if (!(await exists(pagesDir))) issues.push({ level: 'critical', type: 'missing-dir', dir: 'pages' });

  let pageCount = 0;
  if (await exists(pagesDir)) {
    const files = await glob('**/*.twig', { cwd: pagesDir, nodir: true });
    pageCount = files.length;
    if (pageCount === 0) issues.push({ level: 'critical', type: 'no-pages' });
    // Twig lint: basic checks for extends and blocks
    for (const f of files) {
      const p = path.join(pagesDir, f);
      try {
        const txt = await fs.readFile(p, 'utf8');
        if (!/{%\s*extends\s*"layout\/default\.twig"\s*%}/.test(txt)) {
          issues.push({ level: 'warning', type: 'missing-extends', file: `pages/${f}` });
        }
        if (!/{%\s*block\s+content\s*%}/.test(txt) || !/{%\s*endblock\s*%}/.test(txt)) {
          issues.push({ level: 'warning', type: 'missing-content-block', file: `pages/${f}` });
        }
      } catch (err) { void err; }
    }
  }

  // Required templates check via configs/routes.json (if present)
  try {
    const routesPath = path.resolve('configs', 'routes.json');
    if (await fs.pathExists(routesPath)) {
      const routes = await fs.readJson(routesPath);
      const required = routes.required || [];
      for (const req of required) {
        const reqPath = path.join(pagesDir, req);
        if (!(await exists(reqPath))) {
          issues.push({ level: 'warning', type: 'required-missing', file: `pages/${req}` });
        }
      }
    }
  } catch (err) { void err; }
  // Manifest fingerprint check (warning)
  const manifestFile = path.join(outputPath, 'manifest.json');
  if (await exists(manifestFile)) {
    try {
      const manifest = await fs.readJson(manifestFile);
      const assetsDir = path.join(outputPath, 'assets');
      const actualAssets = await countFiles(assetsDir);
      if (manifest.assets !== undefined && manifest.assets !== actualAssets) {
        issues.push({ level: 'warning', type: 'manifest-asset-mismatch', expected: manifest.assets, actual: actualAssets });
      }
    } catch (err) { void err; }
  }

  const report = {
    status: issues.length ? 'warn' : 'ok',
    issues,
    stats: { pages: pageCount }
  };
  await fs.writeJson(reportPath, report, { spaces: 2 });
  return report;
}

// no-op helper retained for potential future expansion
async function countFiles(dir) {
  let count = 0;
  async function walk(d) {
    if (!(await fs.pathExists(d))) return;
    const entries = await fs.readdir(d, { withFileTypes: true });
    for (const e of entries) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) await walk(p); else count++;
    }
  }
  await walk(dir);
  return count;
}

// Integrated manifest generation (consolidated tracking)
import crypto from 'crypto';

export async function generateBuildManifest(outputPath, { coreReport, elapsedSec, layoutMap, inputChecksum } = {}) {
  const pagesDir = path.join(outputPath, 'pages');
  const layoutDir = path.join(outputPath, 'layout');
  const assetsDir = path.join(outputPath, 'assets');
  const theme = path.basename(outputPath);

  const pages = await listFiles(pagesDir, '.twig');
  const components = await listFiles(layoutDir, '.twig');
  const assets = await listFilesRecursive(assetsDir);

  const checksum = await hashOfContents([...pages, ...components, ...assets]);

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
    factoryVersion: '1.0.0',
    elapsedSec,
    warnings: coreReport?.issues?.length || 0,
    pageOrder: layoutMap?.map(l => l.page) || [],
    failedFiles: (coreReport?.issues || []).filter(i => i.level==='critical').map(i => i.file).filter(Boolean),
    inputChecksum,
  };
}

async function listFiles(baseDir, ext) {
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
  await walk(baseDir);
  return out;
}

async function listFilesRecursive(baseDir) { return listFiles(baseDir); }

async function hashOfContents(files) {
  const h = crypto.createHash('md5');
  for (const f of files) {
    try { h.update(await fs.readFile(f)); } catch (err) { void err; }
  }
  return h.digest('hex');
}
