/**
 * DEEMIND — THEMING ENGINE — Extended Validator
 * Adds deep checks for encoding, assets, translation, cycles, and budgets.
 */
import fs from 'fs-extra';
import path from 'path';
import { globSync } from 'glob';
import { createHash } from 'crypto';

const SALLA_DIR = path.resolve('core', 'salla');
const ALWAYS_ALLOWED_FILTERS = new Set(['t', 'trans', 'raw', 'escape', 'e', 'default', 'upper', 'lower', 'length', 'json_encode', 'merge', 'keys']);
import { buildTwigDependencyGraph } from './twig-dependency-graph.js';

export async function validateExtended(themePath) {
  const report = {
    errors: [],
    warnings: [],
    checks: {},
    logs: [],
  };
  // Load settings
  let settings = { rawAllowlist: [], failOnBudget: false, requireI18n: false };
  try { settings = await fs.readJson(path.resolve('configs', 'settings.json')); } catch { /* ignore */ }
  if (typeof process !== 'undefined' && process.env && typeof process.env.REQUIRE_I18N !== 'undefined') {
    settings.requireI18n = String(process.env.REQUIRE_I18N).toLowerCase() === 'true';
  }
  const sallaRefs = await loadSallaReferences();

  // 1) UTF-8 encoding check
  for (const file of globSync(`${themePath}/**/*.{html,twig,css,js}`, { nodir: true })) {
    const buf = await fs.readFile(file);
    const text = buf.toString('utf8');
    if (/�/.test(text)) {
      report.errors.push({ type: 'encoding', file, message: 'Invalid UTF-8 characters detected.' });
    }
  }
  report.checks.encoding = true;

  // Load baseline manifest (files copied from fallback)
  let baselineSummary = null;
  const baselineManifestPath = path.join(themePath, 'reports', 'baseline-summary.json');
  try {
    baselineSummary = await fs.readJson(baselineManifestPath);
  } catch {
    /* ignore missing baseline summary */
  }
  const baselineCopied = new Set(
    (baselineSummary?.copied || []).map((rel) => rel.replace(/\\/g, '/')),
  );
  const baselineFallbackName =
    baselineSummary?.baselineName ||
    process.env.DEEMIND_BASELINE ||
    process.env.DEEMIND_BASELINE_NAME ||
    'theme-raed';
  const baselineRoot =
    baselineSummary?.baselineRoot ||
    resolveBaselineRootPath(baselineFallbackName);
  const baselineAllowanceCache = new Map();

  function resolveBaselineRootPath(name) {
    const envRoot = process.env.DEEMIND_BASELINE_ROOT;
    if (envRoot) return path.resolve(envRoot);
    if (!name) return path.resolve('.baselines', 'theme-raed');
    if (path.isAbsolute(name)) return name;
    if (name.startsWith('.')) return path.resolve(name);
    return path.resolve('.baselines', name);
  }

  function mapBaselineSegments(relPath) {
    if (relPath.startsWith('layout/')) {
      return ['src', 'views', 'layouts', relPath.slice('layout/'.length)];
    }
    if (relPath.startsWith('pages/')) {
      return ['src', 'views', 'pages', relPath.slice('pages/'.length)];
    }
    if (relPath.startsWith('partials/')) {
      return ['src', 'views', 'components', relPath.slice('partials/'.length)];
    }
    if (relPath.startsWith('locales/')) {
      return ['src', 'locales', relPath.slice('locales/'.length)];
    }
    return null;
  }

  async function isBaselineFallback(relPath) {
    if (baselineCopied.has(relPath)) return true;
    if (!baselineRoot) return false;
    if (baselineAllowanceCache.has(relPath)) return baselineAllowanceCache.get(relPath);
    const segments = mapBaselineSegments(relPath);
    if (!segments) {
      baselineAllowanceCache.set(relPath, false);
      return false;
    }
    const candidate = path.join(baselineRoot, ...segments);
    if (!(await fs.pathExists(candidate))) {
      baselineAllowanceCache.set(relPath, false);
      return false;
    }
    try {
      const [current, baselineContent] = await Promise.all([
        fs.readFile(path.join(themePath, relPath), 'utf8'),
        fs.readFile(candidate, 'utf8'),
      ]);
      const same = current === baselineContent;
      baselineAllowanceCache.set(relPath, same);
      return same;
    } catch {
      baselineAllowanceCache.set(relPath, false);
      return false;
    }
  }

  // 2) Inline handlers / unsafe scripts
  const twigs = globSync(`${themePath}/**/*.twig`, { nodir: true });
  for (const file of twigs) {
    const rawContent = await fs.readFile(file, 'utf8');
    const content = stripTwigComments(rawContent);
    const relFile = path.relative(themePath, file).replace(/\\/g, '/');
    const baselineAllowed = await isBaselineFallback(relFile);
    if (/\son[a-z]+\s*=\s*["']/i.test(content)) {
      if (baselineAllowed) {
        report.warnings.push({
          type: 'inline-handler-baseline',
          file,
          message: 'Baseline fallback file contains inline JS handler. Override in input to replace.',
        });
      } else {
        report.errors.push({ type: 'inline-handler', file, message: 'Inline JS event handler found.' });
      }
    }
    if (/<script[^>]+src=['"]http:\/\//i.test(content)) {
      report.errors.push({ type: 'insecure-script', file, message: 'Insecure script source (HTTP) detected.' });
    }
    // raw filter usage check
    const rawUsages = Array.from(content.matchAll(/\|\s*raw\b/g)).length;
    if (rawUsages) {
      // allowlist check
      const allowed = (settings.rawAllowlist || []).some(a => content.includes(a));
      if (!allowed) {
        if (baselineAllowed) {
          if (!settings.suppressRawBaselineWarnings) {
            report.warnings.push({
              type: 'raw-baseline',
              file,
              message: '| raw preserved from baseline fallback. Override input to customize.',
            });
          }
        } else {
          report.errors.push({ type: 'raw-disallowed', file, message: '| raw used without allowlist' });
        }
      }
    }
  }
  report.checks.scripts = true;

  if (sallaRefs.filters.size) {
    const filterRe = /\|\s*([a-zA-Z_][\w]*)/g;
    for (const file of twigs) {
      const rawContent = await fs.readFile(file, 'utf8');
      const content = stripTwigComments(rawContent);
      const relFile = path.relative(themePath, file).replace(/\\/g, '/');
      const seen = new Set();
      let match;
      while ((match = filterRe.exec(content))) {
        const name = (match[1] || '').toLowerCase();
        if (name) seen.add(name);
      }
      for (const filterName of seen) {
        if (!ALWAYS_ALLOWED_FILTERS.has(filterName) && !sallaRefs.filters.has(filterName)) {
          report.warnings.push({
            type: 'filter-unknown',
            file: relFile,
            message: `Twig filter "${filterName}" not found in synced Salla filters.`,
          });
        }
      }
    }
  }

  // 3) Include / extends cycles
  try {
    const depInfo = await buildTwigDependencyGraph(themePath);
    if (depInfo.cycles.length) {
      report.errors.push({
        type: 'dependency-cycle',
        message: `Include/extends cycle detected (${depInfo.cycles.length}). See reports/twig-dependency-${path.basename(themePath)}.md`,
      });
    }
    report.checks.dependencies = true;
  } catch (err) {
    report.warnings.push({ type: 'dependency-scan', message: `Dependency scan skipped: ${err.message}` });
  }

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
    if (settings.requireI18n) {
      report.errors.push({ type: 'i18n', message: `${untranslated.length} files with unwrapped visible text.` });
    } else if (settings.warnOnI18n !== false) {
      report.warnings.push({ type: 'i18n', message: `${untranslated.length} files with unwrapped visible text.` });
    }
  }
  report.checks.i18n = true;

  // 6b) Baseline convention warnings (non-fatal)
  try {
    const baselineWarningsEnabled = settings.suppressBaselineConventionWarnings !== true;
    const baseRoot = path.resolve('configs', 'baselines', 'raed');
    const conventions = await fs.readJson(path.join(baseRoot, 'conventions.json'));
    const graph = await fs.readJson(path.join(baseRoot, 'graph.json'));
    const conv = { layoutDir: 'layout', pagesDir: 'pages', partialsDir: 'partials', assetsDir: 'assets', ...conventions };
    const basenames = [conv.layoutDir, conv.pagesDir, conv.partialsDir, conv.assetsDir].map(d => path.basename(d));
    // Map baseline 'components' folder to output 'partials' equivalence
    const mapped = basenames.map(b => (b === 'components' ? 'partials' : b));
    const expectDirs = mapped.map(name => path.join(themePath, name));
    for (const d of expectDirs) {
      if (!fs.existsSync(d) && baselineWarningsEnabled) {
        report.warnings.push({ type: 'baseline-convention', message: `Expected directory missing: ${path.relative(themePath, d)}` });
      }
    }
    // Pages should extend a layout
    for (const page of globSync(`${themePath}/pages/**/*.twig`, { nodir: true })) {
      const txt = await fs.readFile(page, 'utf8');
      if (!/{%\s*extends\s*['"]layout\//.test(txt) && baselineWarningsEnabled) {
        report.warnings.push({ type: 'baseline-convention', file: page, message: 'Page does not extend a layout/* template.' });
      }
    }
    // Includes should prefer partials/
    for (const file of twigs) {
      const txt = await fs.readFile(file, 'utf8');
      for (const m of txt.matchAll(/{%\s*include\s*['"]([^'"]+)['"]/g)) {
        if (!m[1].startsWith('partials/') && baselineWarningsEnabled) {
          report.warnings.push({ type: 'baseline-convention', file, message: `Include not under partials/: ${m[1]}` });
        }
      }
    }
    // i18n usage vs baseline (coarse)
    const baselineI18nRatio = (() => {
      const files = Object.keys(graph).filter(k => k.endsWith('.twig')).length || 1;
      const i18nFiles = Object.values(graph).filter(v => v.i18n).length || 0;
      return i18nFiles / files;
    })();
    const oursI18nRatio = (() => {
      const files = twigs.length || 1;
       
      const i18nFiles = twigs.filter(f => /\|\s*t\b|\{\%\s*trans\b/.test(fs.readFileSync(f, 'utf8'))).length;
      return i18nFiles / files;
    })();
    const tolerance = typeof settings.baselineI18nTolerance === 'number' ? settings.baselineI18nTolerance : 0.3;
    if (baselineWarningsEnabled && baselineI18nRatio - oursI18nRatio > tolerance && baselineI18nRatio > 0.4) {
      report.warnings.push({ type: 'baseline-convention', message: `Low i18n coverage (${(oursI18nRatio*100)|0}%) vs baseline (${(baselineI18nRatio*100)|0}%).` });
    }
    report.checks.baseline = true;
  } catch (e) { void e; }

  // 6c) SDK usage checks (warn-only)
  try {
    const knowPath = path.resolve('configs', 'knowledge', 'salla-docs.json');
    if (await fs.pathExists(knowPath)) {
      const know = await fs.readJson(knowPath);
      const knownApis = new Set(((know.sdk && know.sdk.apis) || []).map(String));
      const deprecated = new Set(((know.sdk && know.sdk.deprecated) || []).map(String));
      const rx = /\b(?:salla|Salla|SDK)\.[A-Za-z0-9_.]+/g;
      const seen = new Set();
      // scan twig files
      for (const file of twigs) {
        const txt = await fs.readFile(file, 'utf8');
        for (const m of txt.matchAll(rx)) seen.add(m[0]);
      }
      // scan built JS assets
      for (const jsFile of globSync(`${themePath}/assets/**/*.js`, { nodir: true })) {
        const txt = await fs.readFile(jsFile, 'utf8');
        for (const m of txt.matchAll(rx)) seen.add(m[0]);
      }
      for (const api of Array.from(seen)) {
        if (deprecated.has(api)) {
          report.warnings.push({ type: 'sdk-deprecated', message: `Deprecated SDK API used: ${api}` });
        } else if (!knownApis.has(api)) {
          report.warnings.push({ type: 'sdk-unknown', message: `Unknown SDK API reference: ${api}` });
        }
      }
      report.checks.sdk = true;
    }
  } catch (e) { void e; }

  // 6d) Web Components (custom elements) checks (warn-only)
  try {
    let knownTags = new Set(sallaRefs.components || []);
    const knowPath = path.resolve('configs', 'knowledge', 'salla-docs.json');
    if (await fs.pathExists(knowPath)) {
      const know = await fs.readJson(knowPath);
      const extraTags = ((know.webComponents && know.webComponents.tags) || []).map((t) => t.toLowerCase());
      extraTags.forEach((tag) => knownTags.add(tag));
    }
    if (knownTags.size) {
      const rxTag = /<\s*([a-z][a-z0-9-]+)(\s|>)/g;
      const used = new Set();
      for (const f of twigs) {
        const txt = await fs.readFile(f, 'utf8');
        for (const m of txt.matchAll(rxTag)) {
          const tag = (m[1] || '').toLowerCase();
          if (tag.includes('-')) used.add(tag);
        }
      }
      for (const tag of Array.from(used)) {
        if (tag.startsWith('salla-') && !knownTags.has(tag)) {
          report.warnings.push({ type: 'webcomponents-unknown', message: `Unknown Salla web component: <${tag}>` });
        }
      }
      report.checks.webComponents = true;
    }
  } catch (e) { void e; }

  // Sample string detection
  const samplePatterns = [/Lorem ipsum/i, /Sample Product/i, /\bPRODUCT_NAME\b/];
  for (const f of twigs) {
    const relFile = path.relative(themePath, f).replace(/\\/g, '/');
    const text = await fs.readFile(f, 'utf8');
    const hasSampleString = samplePatterns.some((pattern) => pattern.test(text));
    if (hasSampleString) {
      if (await isBaselineFallback(relFile)) {
        report.warnings.push({ type: 'sample-strings-baseline', file: f, message: 'Sample placeholder string retained from baseline fallback.' });
      } else {
        report.errors.push({ type: 'sample-strings', file: f, message: 'Sample placeholder string found.' });
      }
    }
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
  let manifestPreviewMeta = null;
  if (fs.existsSync(manifestPath)) {
    const manifest = await fs.readJson(manifestPath);
    manifest.checksum = createHash('md5').update(JSON.stringify(manifest)).digest('hex');
    await fs.writeJson(manifestPath, manifest, { spaces: 2 });
    manifestPreviewMeta = manifest?.preview || null;
    if (manifestPreviewMeta?.url || typeof manifestPreviewMeta?.port !== 'undefined') {
      report.logs.push({
        type: 'preview-manifest',
        message: `Preview mapped to ${manifestPreviewMeta?.url || 'n/a'} (port ${manifestPreviewMeta?.port ?? 'n/a'})`,
        url: manifestPreviewMeta?.url || null,
        port: typeof manifestPreviewMeta?.port === 'number' ? manifestPreviewMeta.port : null,
        routes: Array.isArray(manifestPreviewMeta?.routes) ? manifestPreviewMeta.routes : [],
        timestamp: new Date().toISOString(),
      });
    }
  } else {
    report.errors.push({ type: 'manifest-missing', message: 'manifest.json not found.' });
  }
  report.checks.manifest = true;

  const outFile = path.join(themePath, 'report-extended.json');
  const budgetExceeded = [...report.errors, ...report.warnings].some(
    (entry) => entry?.type && entry.type.startsWith('budget-'),
  );
  const sdkUnknownCount =
    report.errors.filter((entry) => entry.type === 'sdk-unknown').length +
    report.warnings.filter((entry) => entry.type === 'sdk-unknown').length;

  const summary = {
    passed: report.errors.length === 0,
    errors: report.errors.length,
    warnings: report.warnings.length,
    budgetExceeded,
    sdkUnknownCount,
    timestamp: new Date().toISOString(),
    preview: {
      url: manifestPreviewMeta?.url || null,
      port: typeof manifestPreviewMeta?.port === 'number' ? manifestPreviewMeta.port : null,
    },
  };
  await fs.writeJson(outFile, { ...report, summary }, { spaces: 2 });

  console.log(
    JSON.stringify({
      event: 'validator-extended',
      theme: path.basename(themePath),
      errors: report.errors.length,
      warnings: report.warnings.length,
      budgetExceeded,
      sdkUnknownCount,
      report: outFile,
    }),
  );
  return report;
}

async function loadBudgets() {
  try {
    return await fs.readJson('configs/budgets.json');
  } catch {
    return { maxCSS: 600000, maxJS: 400000 };
  }
}

async function readJsonIfExists(p) {
  try {
    return await fs.readJson(p);
  } catch {
    return null;
  }
}

function extractFilterSet(data) {
  const set = new Set();
  if (!data) return set;
  if (Array.isArray(data)) {
    data.forEach((entry) => {
      if (typeof entry === 'string') set.add(entry.toLowerCase());
      else if (entry && typeof entry === 'object' && entry.name) set.add(String(entry.name).toLowerCase());
    });
  } else if (typeof data === 'object') {
    if (Array.isArray(data.filters)) {
      data.filters.forEach((entry) => {
        if (typeof entry === 'string') set.add(entry.toLowerCase());
        else if (entry && entry.name) set.add(String(entry.name).toLowerCase());
      });
    }
    Object.keys(data).forEach((key) => {
      if (key !== 'filters') set.add(key.toLowerCase());
    });
  }
  return set;
}

function extractComponentSet(data) {
  const set = new Set();
  if (!data) return set;
  const add = (value) => {
    if (typeof value === 'string') set.add(value.toLowerCase());
  };
  if (Array.isArray(data)) {
    data.forEach(add);
  } else if (typeof data === 'object') {
    if (Array.isArray(data.webComponents)) data.webComponents.forEach(add);
    if (Array.isArray(data.components)) data.components.forEach(add);
    if (data.layouts && typeof data.layouts === 'object') {
      Object.keys(data.layouts).forEach((key) => add(key));
    }
    Object.keys(data).forEach((key) => {
      if (key.startsWith('salla-')) add(key);
    });
  }
  return set;
}

function stripTwigComments(text) {
  return text.replace(/\{#[\s\S]*?#\}/g, ' ');
}

async function loadSallaReferences() {
  const [filtersJson, partialsJson] = await Promise.all([
    readJsonIfExists(path.join(SALLA_DIR, 'filters.json')),
    readJsonIfExists(path.join(SALLA_DIR, 'partials.json')),
  ]);
  return {
    filters: extractFilterSet(filtersJson),
    components: extractComponentSet(partialsJson),
  };
}
