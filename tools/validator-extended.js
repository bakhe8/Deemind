/**
 * DEEMIND — THEMING ENGINE — Extended Validator
 * Adds deep checks for encoding, assets, translation, cycles, and budgets.
 */
import fs from 'fs-extra';
import path from 'path';
import { globSync } from 'glob';
import { createHash } from 'crypto';

export async function validateExtended(themePath) {
  const report = {
    errors: [],
    warnings: [],
    checks: {}
  };
  // Load settings
  let settings = { rawAllowlist: [], failOnBudget: false, requireI18n: false };
  try { settings = await fs.readJson(path.resolve('configs', 'settings.json')); } catch (err) { void err; }

  // 1) UTF-8 encoding check
  for (const file of globSync(`${themePath}/**/*.{html,twig,css,js}`, { nodir: true })) {
    const buf = await fs.readFile(file);
    const text = buf.toString('utf8');
    if (/�/.test(text)) {
      report.errors.push({ type: 'encoding', file, message: 'Invalid UTF-8 characters detected.' });
    }
  }
  report.checks.encoding = true;

  // 2) Inline handlers / unsafe scripts
  const twigs = globSync(`${themePath}/**/*.twig`, { nodir: true });
  for (const file of twigs) {
    const content = await fs.readFile(file, 'utf8');
    if (/\son[a-z]+\s*=\s*["']/i.test(content)) {
      report.errors.push({ type: 'inline-handler', file, message: 'Inline JS event handler found.' });
    }
    if (/<script[^>]+src=['"]http:\/\//i.test(content)) {
      report.errors.push({ type: 'insecure-script', file, message: 'Insecure script source (HTTP) detected.' });
    }
    // raw filter usage check
    const rawUsages = Array.from(content.matchAll(/\|\s*raw\b/g)).length;
    if (rawUsages) {
      // allowlist check
      const allowed = (settings.rawAllowlist || []).some(a => content.includes(a));
      if (!allowed) report.errors.push({ type: 'raw-disallowed', file, message: '| raw used without allowlist' });
    }
  }
  report.checks.scripts = true;

  // 3) Include / extends cycles
  const deps = {};
  for (const file of twigs) {
    const content = await fs.readFile(file, 'utf8');
    const matches = Array.from(content.matchAll(/{%\s*(include|extends)\s*['"]([^'"]+)['"]/g));
    const includes = matches.map(m => path.join(themePath, m[2]).replace(/\\/g,'/'));
    deps[file.replace(/\\/g,'/')] = includes;
  }
  if (detectCycle(deps)) {
    report.errors.push({ type: 'dependency-cycle', message: 'Include/extends cycle detected.' });
  }
  report.checks.dependencies = true;

  // 4) Asset link validation
  // const assets = globSync(`${themePath}/assets/**/*`, { nodir: true });
  const twigsContent = twigs.map(f => fs.readFileSync(f, 'utf8')).join('\n');
  const missing = [];
  for (const match of twigsContent.matchAll(/assets\/([^"')\s]+)/g)) {
    const ref = path.join(themePath, 'assets', match[1]);
    if (!fs.existsSync(ref)) missing.push(ref);
  }
  if (missing.length) {
    report.errors.push({ type: 'missing-assets', message: `${missing.length} asset references not found.` });
  }
  report.checks.assets = true;

  // 5) Budget enforcement
  const budgets = await loadBudgets();
  const css = globSync(`${themePath}/assets/**/*.css`).map(f => fs.statSync(f).size);
  const js = globSync(`${themePath}/assets/**/*.js`).map(f => fs.statSync(f).size);
  const totalCSS = css.reduce((a, b) => a + b, 0);
  const totalJS = js.reduce((a, b) => a + b, 0);
  if (totalCSS > budgets.maxCSS) {
    (settings.failOnBudget ? report.errors : report.warnings).push({ type: 'budget-css', message: `Total CSS ${totalCSS}B exceeds ${budgets.maxCSS}B.` });
  }
  if (totalJS > budgets.maxJS) {
    (settings.failOnBudget ? report.errors : report.warnings).push({ type: 'budget-js', message: `Total JS ${totalJS}B exceeds ${budgets.maxJS}B.` });
  }
  report.checks.budgets = true;

  // 6) Translation check (simple visible text check)
  const untranslated = twigs.filter(f => {
    const text = fs.readFileSync(f, 'utf8');
    return />[^<]{8,}</.test(text) && !/\|\s*t/.test(text);
  });
  if (untranslated.length) {
    (settings.requireI18n ? report.errors : report.warnings).push({ type: 'i18n', message: `${untranslated.length} files with unwrapped visible text.` });
  }
  report.checks.i18n = true;

  // Sample string detection
  const samples = /(Lorem ipsum|Sample Product|PRODUCT_NAME)/i;
  for (const f of twigs) {
    const text = fs.readFileSync(f, 'utf8');
    if (samples.test(text)) report.errors.push({ type: 'sample-strings', file: f, message: 'Sample placeholder string found.' });
  }

  // Case-insensitive partial name collisions
  const partialsDir = path.join(themePath, 'partials');
  if (fs.existsSync(partialsDir)) {
    const parts = globSync('**/*.twig', { cwd: partialsDir, nodir: true });
    const seen = new Map();
    for (const p of parts) {
      const key = p.toLowerCase();
      if (seen.has(key) && seen.get(key) !== p) {
        report.errors.push({ type: 'partial-collision', files: [seen.get(key), p], message: 'Case-insensitive collision in partials.' });
      } else {
        seen.set(key, p);
      }
    }
  }

  // SVG sanitize: forbid <script> or on* attributes
  const svgs = globSync(`${themePath}/assets/**/*.svg`, { nodir: true });
  for (const f of svgs) {
    const s = await fs.readFile(f, 'utf8');
    if (/<script\b/i.test(s) || /\son[a-z]+\s*=\s*["']/i.test(s)) {
      report.errors.push({ type: 'svg-unsafe', file: f, message: 'SVG includes script or inline handlers.' });
    }
  }

  // 7) Manifest + version integrity
  const manifestPath = path.join(themePath, 'manifest.json');
  if (fs.existsSync(manifestPath)) {
    const manifest = await fs.readJson(manifestPath);
    manifest.checksum = createHash('md5').update(JSON.stringify(manifest)).digest('hex');
    await fs.writeJson(manifestPath, manifest, { spaces: 2 });
  } else {
    report.errors.push({ type: 'manifest-missing', message: 'manifest.json not found.' });
  }
  report.checks.manifest = true;

  const outFile = path.join(themePath, 'report-extended.json');
  const summary = {
    passed: report.errors.length === 0,
    errors: report.errors.length,
    warnings: report.warnings.length,
    timestamp: new Date().toISOString(),
  };
  await fs.writeJson(outFile, { ...report, summary }, { spaces: 2 });

  console.log(`\n🧪 Extended Validation Complete\nErrors: ${report.errors.length}\nWarnings: ${report.warnings.length}\nReport: ${outFile}\n`);
  return report;
}

function detectCycle(graph) {
  const visited = new Set();
  const stack = new Set();
  function dfs(node) {
    if (stack.has(node)) return true;
    if (visited.has(node)) return false;
    visited.add(node); stack.add(node);
    for (const dep of graph[node] || []) {
      if (dfs(dep)) return true;
    }
    stack.delete(node);
    return false;
  }
  return Object.keys(graph).some(dfs);
}

async function loadBudgets() {
  try {
    return await fs.readJson('configs/budgets.json');
  } catch {
    return { maxCSS: 300000, maxJS: 400000 };
  }
}
