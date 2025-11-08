#!/usr/bin/env node
import fs from 'fs-extra';
import path from 'path';

const root = process.cwd();
const dashRoot = path.resolve(root, 'reports', 'dashboard');
const dashIndex = path.join(dashRoot, 'index.html');
const dataDir = path.join(dashRoot, 'data');
const uiRoot = path.resolve(root, 'reports', 'ui');
const uiDataDir = path.join(uiRoot, 'data');

async function readJson(relPath) {
  try {
    return await fs.readJson(path.resolve(root, relPath));
  } catch {
    return null;
  }
}

async function readLines(filePath, tail = 30) {
  if (!(await fs.pathExists(filePath))) return '';
  const txt = await fs.readFile(filePath, 'utf8');
  const lines = txt.trim().split(/\r?\n/);
  return lines.slice(-tail).join('\n');
}

function summarizeDocs(files) {
  const mdFiles = files.filter((file) => file.endsWith('.md'));
  return mdFiles.length;
}

async function listDir(relPath) {
  const target = path.resolve(root, relPath);
  if (!(await fs.pathExists(target))) return [];
  const entries = await fs.readdir(target);
  return entries;
}

async function listFiles(relPath, filter = () => true) {
  const target = path.resolve(root, relPath);
  if (!(await fs.pathExists(target))) return [];
  const entries = await fs.readdir(target);
  const files = [];
  for (const name of entries) {
    const full = path.join(target, name);
    const stat = await fs.stat(full);
    if (stat.isFile() && filter(name, full)) {
      files.push({ name, fullPath: full, relPath: path.join(relPath, name) });
    }
  }
  return files;
}

async function collectMarkdownMeta(relPath) {
  const files = await listFiles(relPath, (name) => name.endsWith('.md'));
  const meta = [];
  for (const file of files) {
    const content = await fs.readFile(file.fullPath, 'utf8');
    const headingMatch = content.match(/^#\s+(.+)$/m);
    meta.push({
      name: file.name,
      title: headingMatch ? headingMatch[1].trim() : file.name.replace(/[-_]/g, ' ').replace('.md', ''),
      relPath: file.relPath.replace(/\\/g, '/'),
    });
  }
  return meta;
}

async function collectDirectives() {
  const dir = path.join(root, 'codex-directives');
  if (!(await fs.pathExists(dir))) return [];
  const entries = await fs.readdir(dir);
  const directives = [];
  for (const file of entries.filter((name) => name.endsWith('.md'))) {
    const full = path.join(dir, file);
    const content = await fs.readFile(full, 'utf8');
    const headingMatch = content.match(/^#\s+(.+)$/m);
    directives.push({
      name: file,
      title: headingMatch ? headingMatch[1].trim() : file.replace(/[-_]/g, ' ').replace('.md', ''),
      summary: (content.match(/\n\n([^#].{0,180})/m) || [null, ''])[1].trim(),
      path: `../../codex-directives/${file}`,
    });
  }
  return directives;
}

async function collectThemes(harmony) {
  const baseThemes = ['demo', 'gimni', 'modern'];
  const scores = harmony?.scores || {};
  const themeNames = Object.keys(scores).length ? Object.keys(scores) : baseThemes;
  return themeNames.map((name) => {
    const entry = scores[name] || {};
    return {
      name,
      score: entry.score ?? 0,
      notes: entry.notes || 'Waiting for run',
      preview: `../visual/${name}/latest.png`,
      buildReport: `../build-${name}.md`,
      validateReport: `../validate-${name}.md`,
      visualDir: `../visual/${name}/`,
      themeJson: `../../output/${name}/theme.json`,
    };
  });
}

async function collectCustomRequests() {
  const data = await readJson('logs/customization-requests.json');
  if (!Array.isArray(data)) return [];
  return data.map((item) => ({
    id: item.id || item.title,
    title: item.title || 'Untitled request',
    status: item.status || 'pending',
    target: item.theme || item.target || '—',
    updated: item.updated || item.time || '',
  }));
}

async function collectTaskLog() {
  const data = await readJson('logs/codex-tasks.json');
  if (!Array.isArray(data)) return [];
  return data.slice(-10).map((task) => ({
    task: task.task || 'task',
    status: task.status || 'pending',
    target: task.target || '',
    time: task.time || '',
  }));
}

async function collectLighthouse() {
  const dir = path.resolve(root, 'reports', 'lighthouse');
  if (!(await fs.pathExists(dir))) return [];
  const entries = await fs.readdir(dir);
  const reports = [];
  for (const file of entries.filter((name) => name.endsWith('.json'))) {
    try {
      const data = await fs.readJson(path.join(dir, file));
      const score = data.categories?.performance?.score
        ? Math.round(data.categories.performance.score * 100)
        : data.score ?? '—';
      reports.push({
        name: file.replace('.json', ''),
        score,
        updated: data.fetchTime || data.generatedTime || '',
      });
    } catch {
      // ignore malformed file
    }
  }
  return reports;
}

async function collectVisualReports() {
  const dir = path.resolve(root, 'reports', 'visual');
  if (!(await fs.pathExists(dir))) return [];
  const entries = await fs.readdir(dir);
  return entries.map((name) => ({
    name,
    path: `../visual/${name}/`,
  }));
}

function deriveSchemaDrift(systemStatus, themes) {
  if (Array.isArray(systemStatus?.schemaDrift) && systemStatus.schemaDrift.length) {
    return systemStatus.schemaDrift;
  }
  return themes
    .filter((theme) => theme.score && theme.score < 95)
    .map((theme) => ({
      title: `${theme.name} harmony`,
      detail: `Score ${theme.score} below 95 — review assets`,
      level: theme.score < 85 ? 'high' : 'medium',
    }));
}

async function collectDocStats() {
  const docsDir = path.resolve(root, 'docs');
  const docFiles = (await fs.pathExists(docsDir)) ? await fs.readdir(docsDir) : [];
  const count = summarizeDocs(docFiles);
  const directives = await collectDirectives();
  const reportsDir = path.resolve(root, 'reports');
  const reportFiles = (await fs.pathExists(reportsDir)) ? await fs.readdir(reportsDir) : [];
  const reports = summarizeDocs(reportFiles);
  const required = ['docs/CI_CD.md', 'docs/architecture.md', 'README.md'];
  const missing = [];
  for (const file of required) {
    if (!(await fs.pathExists(path.resolve(root, file)))) {
      missing.push(file);
    }
  }
  return { count, directives: directives.length, reports, missing, directiveEntries: directives };
}

function deriveDocCoverage(stats) {
  const total = stats.count + stats.missing.length || 1;
  return Math.min(100, Math.round((stats.count / total) * 100));
}

async function collectBridgeData({ now, customRequests, taskLog, systemLog }) {
  const pkg = (await readJson('package.json')) || {};
  const scripts = Object.entries(pkg.scripts || {}).map(([name, command]) => ({
    name,
    command,
  }));
  const toolFiles = await listFiles('tools', (name) => /\.(c?m)?js$/.test(name));
  const tools = toolFiles.map((file) => ({
    name: file.name.replace(/\.(c?m)?js$/, ''),
    path: `../../${file.relPath.replace(/\\/g, '/')}`,
  }));
  const configFiles = await listFiles('configs', (name) => /\.(json|js)$/.test(name));
  const configs = configFiles.map((file) => ({
    name: file.name,
    path: `../../${file.relPath.replace(/\\/g, '/')}`,
  }));
  const docsMeta = await collectMarkdownMeta('docs');
  const schema = (await readJson('configs/salla-schema.json')) || {};
  const schemaFields = Object.keys(schema?.properties || schema?.fields || schema || {});
  const settings = (await readJson('configs/settings.json')) || {};
  const docIndex = docsMeta.map((meta) => ({
    name: meta.title,
    path: `../../${meta.relPath}`,
  }));
  const features = [
    `${scripts.length} npm scripts`,
    `${tools.length} tooling modules`,
    `${configs.length} config files`,
    `${schemaFields.length} schema fields`,
    `${docIndex.length} docs`,
  ];
  return {
    generatedAt: now,
    scripts,
    tools,
    configs,
    docs: docIndex,
    schemaFields,
    settingsKeys: Object.keys(settings),
    customRequests,
    taskLog,
    systemLog,
    features,
  };
}

async function main() {
  if (!(await fs.pathExists(dashIndex))) {
    console.log('Dashboard not found — skipping update.');
    return;
  }

  const now = new Date().toISOString();
  const harmony = await readJson('reports/harmony-summary.json');
  const themes = await collectThemes(harmony);
  const systemStatus = await readJson('reports/system-status.json');
  const docStats = await collectDocStats();
  const docsCoverage = deriveDocCoverage(docStats);
  const schemaDrift = deriveSchemaDrift(systemStatus, themes);
  const customRequests = await collectCustomRequests();
  const taskLog = await collectTaskLog();
  const lighthouse = await collectLighthouse();
  const visualReports = await collectVisualReports();
  const systemLog = await readLines(path.resolve(root, 'logs', 'system-status.log'));

  const healthScore = (() => {
    const harmonyAverage =
      themes.length > 0
        ? themes.reduce((sum, item) => sum + (item.score || 0), 0) / themes.length
        : 0;
    const baseline = systemStatus?.overallHealth ?? 90;
    return Math.round((harmonyAverage * 0.4 + docsCoverage * 0.3 + baseline * 0.3) * 10) / 10;
  })();

  const payload = {
    generatedAt: now,
    harmonyAverage:
      themes.length > 0
        ? Math.round(
            (themes.reduce((sum, item) => sum + (item.score || 0), 0) / themes.length) * 10,
          ) / 10
        : 0,
    docsCoverage,
    docStats,
    themes,
    schemaDrift,
    customRequests,
    taskLog,
    lighthouse,
    visualReports,
    systemLog,
    ciSummary: systemStatus?.ci?.lastRun || 'Awaiting run',
    healthScore: Number.isFinite(healthScore) ? healthScore : 0,
    uiVersion: '1.0.0',
  };

  await fs.ensureDir(dataDir);
  await fs.writeJson(path.join(dataDir, 'observatory.json'), payload, { spaces: 2 });

  // Bridge data for interactive UI
  await fs.ensureDir(uiDataDir);
  const bridgeData = await collectBridgeData({ now, customRequests, taskLog, systemLog });
  await fs.writeJson(path.join(uiDataDir, 'bridge.json'), bridgeData, { spaces: 2 });
  await fs.writeJson(
    path.join(uiRoot, 'version.json'),
    {
      ui_version: 'auto',
      last_sync: now,
      features: bridgeData.features,
    },
    { spaces: 2 },
  );

  const logsDir = path.resolve(root, 'logs');
  await fs.ensureDir(logsDir);
  const summaryLog = path.join(logsDir, 'dashboard-history.log');
  await fs.appendFile(summaryLog, `[${now}] Dashboard data refreshed\n`);

  console.log(`✅ Dashboard data refreshed at ${now}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
