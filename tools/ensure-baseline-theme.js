import fs from 'fs-extra';
import path from 'path';
import { globSync } from 'glob';
import readline from 'readline';
import { execSync } from 'child_process';

const CACHE_PATH = path.resolve('.cache', 'baseline-index.json');
const LOG_DIR_DEFAULT = path.resolve('logs', 'baseline');
const BASELINE_MODES = ['fill', 'enrich', 'force'];
const DEFAULT_CONFIG = {
  useLayouts: true,
  usePages: true,
  useComponents: true,
  useLocales: true,
  useAssets: true,
  fallbackTheme: null,
};
const ENRICH_THRESHOLDS = {
  '.twig': 600,
  '.html': 600,
  '.json': 80,
  '.css': 120,
  '.js': 120,
};

const COPY_GROUPS = [
  { key: 'layouts', enabledKey: 'useLayouts', src: 'src/views/layouts', dest: 'layout', filter: (name) => name.endsWith('.twig') },
  { key: 'pages', enabledKey: 'usePages', src: 'src/views/pages', dest: 'pages', filter: (name) => name.endsWith('.twig') },
  { key: 'components', enabledKey: 'useComponents', src: 'src/views/components', dest: 'partials', filter: (name) => name.endsWith('.twig') },
  { key: 'locales', enabledKey: 'useLocales', src: 'src/locales', dest: 'locales', filter: (name) => name.endsWith('.json') },
  { key: 'public', enabledKey: 'useAssets', src: 'public', dest: 'assets' },
  { key: 'assets', enabledKey: 'useAssets', src: 'src/assets', dest: 'assets' },
];

function parseBaselineList(raw) {
  if (!raw) return ['theme-raed'];
  return Array.from(
    new Set(
      raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  );
}

function resolveBaselineRoot(name) {
  if (!name) return path.resolve('.baselines', 'theme-raed');
  const envRoot = process.env.DEEMIND_BASELINE_ROOT;
  if (envRoot) return path.resolve(envRoot);
  if (path.isAbsolute(name)) return name;
  if (name.startsWith('.')) return path.resolve(name);
  return path.resolve('.baselines', name);
}

async function needsEnrich(filePath) {
  try {
    if (!(await fs.pathExists(filePath))) return false;
    const stat = await fs.stat(filePath);
    if (stat.size === 0) return true;
    const ext = path.extname(filePath).toLowerCase();
    const threshold = ENRICH_THRESHOLDS[ext];
    if (threshold && stat.size < threshold) return true;
  } catch (err) {
    return false;
  }
  return false;
}

function deepMerge(target, source) {
  if (Array.isArray(target) && Array.isArray(source)) {
    return Array.from(new Set([...target, ...source]));
  }
  if (typeof target === 'object' && typeof source === 'object' && target && source) {
    const result = { ...target };
    for (const key of Object.keys(source)) {
      if (key in result) {
        result[key] = deepMerge(result[key], source[key]);
      } else {
        result[key] = source[key];
      }
    }
    return result;
  }
  return source ?? target;
}

async function loadJSONIfExists(filePath) {
  try {
    return await fs.readJson(filePath);
  } catch (err) {
    return null;
  }
}

async function loadBaselineConfig(options, baselineRoot) {
  let config = { ...DEFAULT_CONFIG };
  const candidates = [
    options.baselineConfigPath,
    options.inputPath ? path.join(options.inputPath, 'baseline.config.json') : null,
    path.join(baselineRoot, 'baseline.config.json'),
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (await fs.pathExists(candidate)) {
      const data = await loadJSONIfExists(candidate);
      if (data) config = { ...config, ...data };
      break;
    }
  }
  return config;
}

async function loadCache() {
  try {
    return await fs.readJson(CACHE_PATH);
  } catch (err) {
    return {};
  }
}

async function saveCache(cache) {
  await fs.ensureDir(path.dirname(CACHE_PATH));
  await fs.writeJson(CACHE_PATH, cache, { spaces: 2 });
}

async function getBaselineFiles(baselineRoot, cache) {
  const key = baselineRoot.replace(/\\/g, '/');
  const stat = await fs.stat(baselineRoot);
  const cached = cache[key];
  if (cached && cached.mtime === stat.mtimeMs) {
    return cached.files;
  }
  const files = globSync('**/*', { cwd: baselineRoot, nodir: true }).map((rel) => rel.replace(/\\/g, '/'));
  cache[key] = { mtime: stat.mtimeMs, files };
  await saveCache(cache);
  return files;
}

function filterGroupsByConfig(config) {
  return COPY_GROUPS.filter((group) => config[group.enabledKey] !== false);
}

function mapToPosixSegments(str) {
  return str.split(/\\|\//).filter(Boolean);
}

function buildGroupPrefix(group) {
  return mapToPosixSegments(group.src).join('/');
}

function buildDestPrefix(group) {
  return mapToPosixSegments(group.dest).join('/');
}

async function collectCopyPlan(baselineRoot, outputPath, groups, cache, mode) {
  const result = { toCopy: [], skipped: [], toEnrich: [], toForce: [] };
  const baselineFiles = await getBaselineFiles(baselineRoot, cache);
  for (const group of groups) {
    const prefix = buildGroupPrefix(group);
    const destPrefix = buildDestPrefix(group);
    for (const rel of baselineFiles) {
      if (!rel.startsWith(prefix)) continue;
      const rest = rel.slice(prefix.length).replace(/^\//, '');
      if (!rest) continue;
      if (group.filter && !group.filter(rest)) continue;
      const destRel = destPrefix ? `${destPrefix}/${rest}` : rest;
      const destPath = path.join(outputPath, ...destRel.split('/'));
      if (await fs.pathExists(destPath)) {
        if (mode === 'force') {
          result.toForce.push({ rel: destRel, src: path.join(baselineRoot, ...rel.split('/')), dest: destPath, group: group.key });
        } else if (await needsEnrich(destPath)) {
          result.toEnrich.push({ rel: destRel, src: path.join(baselineRoot, ...rel.split('/')), dest: destPath, group: group.key });
        } else {
          result.skipped.push(destRel);
        }
      } else {
        result.toCopy.push({ rel: destRel, src: path.join(baselineRoot, ...rel.split('/')), dest: destPath, group: group.key });
      }
    }
  }
  return result;
}

function createPrompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() !== 'n');
    });
  });
}

function injectMetadata(content, ext, info) {
  if (ext === '.twig') {
    return `{# Filled from ${info.baseline}/${info.rel} on ${info.timestamp} #}\n${content}`;
  }
  if (ext === '.json') {
    try {
      const data = JSON.parse(content || '{}');
      data._baselineSource = { baseline: info.baseline, file: info.rel, timestamp: info.timestamp };
      return JSON.stringify(data, null, 2);
    } catch (err) {
      return content;
    }
  }
  if (ext === '.css' || ext === '.scss' || ext === '.js') {
    return `/* Filled from ${info.baseline}/${info.rel} on ${info.timestamp} */\n${content}`;
  }
  return content;
}

async function copyWithMetadata(action, baselineName, timestamp) {
  const ext = path.extname(action.dest).toLowerCase();
  await fs.ensureDir(path.dirname(action.dest));
  if (['.twig', '.json', '.css', '.scss', '.js'].includes(ext)) {
    const raw = await fs.readFile(action.src, 'utf8');
    const transformed = injectMetadata(raw, ext, { baseline: baselineName, rel: action.rel, timestamp });
    await fs.writeFile(action.dest, transformed, 'utf8');
  } else {
    await fs.copy(action.src, action.dest);
  }
}

function markerForExt(ext, text) {
  if (ext === '.twig' || ext === '.html') return `{# ${text} #}`;
  if (ext === '.css' || ext === '.scss' || ext === '.js') return `/* ${text} */`;
  return `<!-- ${text} -->`;
}

async function enrichFile(action, baselineName, timestamp) {
  const ext = path.extname(action.dest).toLowerCase();
  const markerText = `Baseline supplement from ${baselineName}:${action.rel}`;
  const marker = markerForExt(ext, markerText);
  let destContent = '';
  try {
    destContent = await fs.readFile(action.dest, 'utf8');
    if (destContent.includes(markerText)) {
      return false;
    }
  } catch (err) { /* ignore */ }
  const baselineContent = await fs.readFile(action.src, 'utf8');
  if (!baselineContent.trim()) return false;

  if (ext === '.json') {
    let targetJson = {};
    let sourceJson = {};
    try {
      targetJson = destContent ? JSON.parse(destContent) : {};
    } catch (err) {
      targetJson = {};
    }
    try {
      sourceJson = JSON.parse(baselineContent);
    } catch (err) {
      sourceJson = {};
    }
    const merged = deepMerge(targetJson, sourceJson);
    if (JSON.stringify(targetJson) === JSON.stringify(merged)) return false;
    await fs.writeJson(action.dest, merged, { spaces: 2 });
    return true;
  }

  const enriched =
    destContent.trim().length > 0
      ? `${destContent.trim()}\n\n${marker}\n${baselineContent}`
      : `${marker}\n${baselineContent}`;
  await fs.writeFile(action.dest, enriched, 'utf8');
  return true;
}

function buildHistogram(list) {
  return list.reduce((acc, rel) => {
    const bucket = rel.split('/')[0] || '.';
    acc[bucket] = (acc[bucket] || 0) + 1;
    return acc;
  }, {});
}

async function writeDiffReport(outputPath, themeName, baselineName, logEntry) {
  const reportDir = path.join(outputPath, 'reports');
  const diffPath = path.join(reportDir, 'baseline-diff.md');
  const histogram = buildHistogram(logEntry.added);
  let md = `# Baseline Diff — ${themeName}\n\n`;
  md += `- Baseline: \`${baselineName}\`\n`;
  md += `- Timestamp: ${logEntry.timestamp}\n`;
  md += `- Duration: ${logEntry.duration}\n`;
  md += `- Added files: ${logEntry.added.length}\n`;
  md += `- Skipped files: ${logEntry.skipped.length}\n\n`;
  if (Object.keys(histogram).length) {
    md += '## Added by directory\n';
    for (const [dir, count] of Object.entries(histogram)) {
      md += `- ${dir}: ${count}\n`;
    }
    md += '\n';
  }
  md += '## Added Files\n';
  md += logEntry.added.length ? logEntry.added.map((f) => `- \`${f}\``).join('\n') + '\n\n' : '_None_\n\n';
  md += '## Skipped (already present)\n';
  if (logEntry.skipped.length) {
    const slice = logEntry.skipped.slice(0, 200);
    md += slice.map((f) => `- \`${f}\``).join('\n');
    if (logEntry.skipped.length > 200) md += `\n- ...and ${logEntry.skipped.length - 200} more`;
    md += '\n';
  } else {
    md += '_None_\n';
  }
  await fs.ensureDir(reportDir);
  await fs.writeFile(diffPath, md);
  return diffPath;
}

function getBaselineCommit(root) {
  try {
    return execSync(`git -C "${root}" rev-parse --short HEAD`, { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch (err) {
    return null;
  }
}

export async function ensureBaselineCompleteness(outputPath, options = {}) {
  const autoApprove = options.autoApprove || process.env.CI === 'true';
  const modeInput = options.mode || process.env.DEEMIND_BASELINE_MODE || process.env.DEEMIND_BASELINE_STRATEGY;
  const mode = BASELINE_MODES.includes(modeInput) ? modeInput : 'enrich';
  const enrichEnabled = mode === 'enrich' || mode === 'force';
  const forceEnabled = mode === 'force';
  const baselineNames = parseBaselineList(
    options.baselineName || process.env.DEEMIND_BASELINE || process.env.DEEMIND_BASELINE_NAME,
  );
  const baselineRoots = [];
  const queue = [...baselineNames];
  const cache = await loadCache();
  const tracker = {
    added: [],
    skipped: new Set(),
    stats: {},
    details: [],
    enriched: [],
  };
  let diffPath = null;
  let primaryBaseline = null;
  let fallbackBaselineName = null;
  let lastLogEntry = null;

  let baselineEncountered = false;
  for (let i = 0; i < queue.length; i += 1) {
    const name = queue[i];
    const root = resolveBaselineRoot(name);
    if (!(await fs.pathExists(root))) continue;
    baselineEncountered = true;
    if (!fallbackBaselineName) fallbackBaselineName = name;
    const config = await loadBaselineConfig(options, root);
    if (config.fallbackTheme && !queue.includes(config.fallbackTheme)) {
      queue.push(config.fallbackTheme);
    }
    const groups = filterGroupsByConfig(config);
    const plan = await collectCopyPlan(root, outputPath, groups, cache, mode);
    if (!plan.toCopy.length) {
      plan.skipped.forEach((rel) => tracker.skipped.add(rel));
      continue;
    }
    if (!autoApprove) {
      const proceed = await createPrompt(
        `Missing ${plan.toCopy.length} files from ${name}. Fill now? (Y/n) `,
      );
      if (!proceed) break;
    }
    const stampStart = Date.now();
    const timestamp = new Date().toISOString();
    for (const action of plan.toCopy) {
      await copyWithMetadata(action, name, timestamp);
      tracker.added.push(action.rel);
      tracker.details.push({ rel: action.rel, baseline: name });
      tracker.stats[action.group] = (tracker.stats[action.group] || 0) + 1;
    }
    plan.skipped.forEach((rel) => tracker.skipped.add(rel));
    if (forceEnabled && plan.toForce?.length) {
      for (const forceAction of plan.toForce) {
        await copyWithMetadata(forceAction, name, timestamp);
        tracker.forced = tracker.forced || [];
        tracker.forced.push(forceAction.rel);
        tracker.details.push({ rel: forceAction.rel, baseline: name, type: 'forced' });
        tracker.stats[forceAction.group] = (tracker.stats[forceAction.group] || 0) + 1;
      }
    }
    if (enrichEnabled && plan.toEnrich?.length) {
      for (const enrichAction of plan.toEnrich) {
        const changed = await enrichFile(enrichAction, name, timestamp);
        if (changed) {
          tracker.enriched.push(enrichAction.rel);
          tracker.details.push({ rel: enrichAction.rel, baseline: name, type: 'enriched' });
        }
      }
    }
    primaryBaseline = primaryBaseline || name;
    lastLogEntry = {
      timestamp,
      baseline: name,
      baselineCommit: getBaselineCommit(root),
      theme: options.themeName || path.basename(outputPath),
      added: [...tracker.added],
      skipped: Array.from(tracker.skipped.values()),
      enriched: [...tracker.enriched],
      forced: tracker.forced ? [...tracker.forced] : [],
      duration: `${((Date.now() - stampStart) / 1000).toFixed(2)}s`,
    };
    tracker.added.sort();
    if (options.diff) {
      diffPath = await writeDiffReport(outputPath, lastLogEntry.theme, name, lastLogEntry);
    }
  }

  const manifestPath = options.manifestPath || path.join(outputPath, 'reports', 'baseline-summary.json');
  const previousManifest = await loadJSONIfExists(manifestPath);
  const effectiveName = primaryBaseline || previousManifest?.baselineName || fallbackBaselineName || queue[queue.length - 1];
  const manifest = {
    baselineName: effectiveName,
    baselineRoot: primaryBaseline
      ? resolveBaselineRoot(primaryBaseline)
      : previousManifest?.baselineRoot || (fallbackBaselineName ? resolveBaselineRoot(fallbackBaselineName) : null),
    baselineCommit: lastLogEntry?.baselineCommit || previousManifest?.baselineCommit || null,
    copied: Array.from(new Set([...(previousManifest?.copied || []), ...tracker.added, ...(tracker.forced || [])])),
    stats: tracker.stats,
    timestamp: new Date().toISOString(),
  };
  await fs.ensureDir(path.dirname(manifestPath));
  await fs.writeJson(manifestPath, manifest, { spaces: 2 });

  let logPath = null;
  if (lastLogEntry) {
    await fs.ensureDir(options.logDir || LOG_DIR_DEFAULT);
    const safeTimestamp = lastLogEntry.timestamp.replace(/[:]/g, '-');
    logPath = path.join(options.logDir || LOG_DIR_DEFAULT, `${lastLogEntry.theme}-${safeTimestamp}.json`);
    await fs.writeJson(logPath, lastLogEntry, { spaces: 2 });
    const expectedRef = process.env.DEEMIND_BASELINE_REF;
    if (expectedRef && lastLogEntry.baselineCommit && lastLogEntry.baselineCommit !== expectedRef) {
      console.warn(
        `[baseline] Warning: ${lastLogEntry.baseline}@${lastLogEntry.baselineCommit} differs from expected ${expectedRef}.`,
      );
    }
  }

  return {
    baselinePresent: baselineEncountered,
    baselineName: manifest.baselineName,
    baselineRoot: manifest.baselineRoot,
    copied: manifest.copied,
    stats: tracker.stats,
    logPath,
    logEntry: lastLogEntry,
    diffPath,
    enriched: tracker.enriched,
    forced: tracker.forced || [],
    mode,
  };
}

export function getBaselineManifestPath(themePath) {
  return path.join(themePath, 'reports', 'baseline-summary.json');
}
