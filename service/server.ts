import express from 'express';
import cors, { CorsOptions } from 'cors';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import multer from 'multer';
import extract from 'extract-zip';
import { v4 as uuid } from 'uuid';
import dotenv from 'dotenv';
import { globSync } from 'glob';
import { execSync, spawn, ChildProcess } from 'child_process';
import { Readable } from 'stream';
import { TaskRunner } from './task-runner.js';
import { makeAuthMiddleware } from './security.js';
import { ServiceLogger } from './logger.js';

dotenv.config();

const CONFIG_PATH = path.join(process.cwd(), 'service', 'config.json');
const composerModulePromise = import('../tools/store-compose.js');

async function loadConfig() {
  if (!(await fs.pathExists(CONFIG_PATH))) {
    throw new Error('Missing service/config.json');
  }
  return fs.readJson(CONFIG_PATH);
}

async function safeReadJson(file) {
  try {
    return await fs.readJson(file);
  } catch (err) {
    return null;
  }
}
async function getThemeStateSnapshot(theme: string, stubState: any, stateDir: string) {
  const targetTheme = theme || stubState?.theme || 'demo';
  if (stubState?.process && targetTheme === stubState.theme) {
    try {
      const res = await fetch(`http://localhost:${stubState.port}/api/state`);
      if (res.ok) {
        return await res.json();
      }
    } catch {
      void 0;
    }
  }
  const filePath = path.join(stateDir, `${targetTheme}.json`);
  if (await fs.pathExists(filePath)) {
    return fs.readJson(filePath);
  }
  return null;
}

function summarizeSnapshot(snapshot: any) {
  const products = Array.isArray(snapshot?.products) ? snapshot.products : [];
  return {
    preset: snapshot?.preset || null,
    store: {
      name: snapshot?.store?.name || '',
      language: snapshot?.store?.language || '',
      currency: snapshot?.store?.currency || '',
    },
    productCount: products.length,
    products: products.slice(0, 5).map((p: any) => ({
      id: p.id,
      name: p.name,
      price: p.price,
    })),
  };
}

function diffPartials(current: string[] = [], next: string[] = []) {
  const currentSet = new Set(current);
  const nextSet = new Set(next);
  const added = next.filter((id) => !currentSet.has(id));
  const removed = current.filter((id) => !nextSet.has(id));
  return { current, next, added, removed };
}

async function readRuntimeAnalytics(logPath: string, limit = 50) {
  if (!(await fs.pathExists(logPath))) return [];
  const content = await fs.readFile(logPath, 'utf8');
  const lines = content.split(/\r?\n/).filter(Boolean);
  return lines
    .slice(-limit)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function computeCompleteness(structure) {
  const expected = 4; // layouts, pages, components, locales
  const present = ['layouts', 'pages', 'components', 'locales'].reduce((acc, key) => (structure[key]?.length ? acc + 1 : acc), 0);
  return Math.round((present / expected) * 100);
}

async function listThemes(inputDir, outputDir) {
  const inputExists = (await fs.pathExists(inputDir)) ? await fs.readdir(inputDir) : [];
  const outputExists = (await fs.pathExists(outputDir)) ? await fs.readdir(outputDir) : [];
  const names = Array.from(new Set([...inputExists, ...outputExists])).filter((name) => !name.startsWith('.'));
  const themes = await Promise.all(
    names.map(async (name) => {
      const manifestPath = path.join(outputDir, name, 'manifest.json');
      const manifest = await safeReadJson(manifestPath);
      let status = 'new';
      if (manifest) status = 'built';
      return {
        name,
        status,
        updated: manifest?.timestamp || null,
      };
    }),
  );
  return themes;
}

async function readThemeStructure(themeName, inputDir) {
  const themePath = path.join(inputDir, themeName);
  if (!(await fs.pathExists(themePath))) {
    return null;
  }
  const layouts = globSync('layout/**/*.twig', { cwd: themePath, nodir: true });
  const pages = globSync('pages/**/*.twig', { cwd: themePath, nodir: true });
  const components = globSync('partials/**/*.twig', { cwd: themePath, nodir: true });
  const assets = globSync('assets/**/*', { cwd: themePath, nodir: true });
  const locales = globSync('locales/**/*.json', { cwd: themePath, nodir: true });
  const completeness = computeCompleteness({ layouts, pages, components, locales });
  return {
    theme: themeName,
    layouts,
    pages,
    components,
    assets,
    locales,
    completeness,
  };
}

async function getBaselineLogs(logDir) {
  if (!(await fs.pathExists(logDir))) return [];
  const files = await fs.readdir(logDir);
  const detailed = await Promise.all(
    files
      .filter((f) => f.endsWith('.json'))
      .map(async (name) => {
        const full = path.join(logDir, name);
        const data = await safeReadJson(full);
        return data ? { name, ...data } : null;
      }),
  );
  return detailed.filter(Boolean).sort((a, b) => (a!.timestamp > b!.timestamp ? -1 : 1));
}

async function readBaselineMetrics(metricsPath) {
  if (!(await fs.pathExists(metricsPath))) return [];
  const content = await fs.readFile(metricsPath, 'utf8');
  const lines = content.trim().split('\n').slice(2); // skip header
  return lines
    .map((line) => {
      const cells = line.split('|').map((c) => c.trim());
      if (cells.length < 7) return null;
      return {
        theme: cells[1],
        added: Number(cells[2]) || 0,
        skipped: Number(cells[3]) || 0,
        duration: cells[4],
        errors: Number(cells[5]) || 0,
        warnings: Number(cells[6]) || 0,
      };
    })
    .filter(Boolean);
}

function buildRunCommand(themeName, extraArgs = []) {
  const args = ['cli.js', themeName, '--auto'];
  if (extraArgs.includes('--diff')) args.push('--diff');
  return { command: 'node', args };
}

const upload = multer({ dest: path.join(os.tmpdir(), 'deemind_uploads') });

function sanitizeThemeName(raw?: string) {
  if (!raw) return '';
  return raw.toLowerCase().replace(/[^a-z0-9-_]/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

async function maybeFlattenTheme(dir: string) {
  const entries = (await fs.readdir(dir)).filter((name) => !name.startsWith('__MACOSX'));
  if (entries.length !== 1) return;
  const candidate = path.join(dir, entries[0]);
  const stat = await fs.stat(candidate);
  if (!stat.isDirectory()) return;
  const nested = await fs.readdir(candidate);
  if (!nested.length) return;
  for (const entry of nested) {
    await fs.move(path.join(candidate, entry), path.join(dir, entry), { overwrite: true });
  }
  await fs.remove(candidate);
}

async function main() {
  const config = await loadConfig();
  const app = express();
  const rootDir = process.env.DEEMIND_ROOT || config.root || process.cwd();
  const inputDir = path.join(rootDir, config.inputDir || 'input');
  const outputDir = path.join(rootDir, config.outputDir || 'output');
  const reportsDir = path.join(rootDir, config.reportsDir || 'reports');
  const logsDir = path.join(rootDir, 'logs');
  const baselineLogsDir = path.join(logsDir, 'baseline');
  const stateDir = path.join(rootDir, 'runtime', 'state');
  const twilightConfigFile = path.join(rootDir, 'runtime', 'twilight', 'config.json');
  const stubState: {
    process: ChildProcess | null;
    theme: string | null;
    port: number;
    logs: string[];
  } = {
    process: null,
    theme: null,
    port: Number(process.env.PREVIEW_STUB_PORT || 4100),
    logs: [],
  };

  function recordStubLog(line: string) {
    stubState.logs.push(line);
    if (stubState.logs.length > 200) stubState.logs.shift();
  }

  function stopStubProcess() {
    if (stubState.process) {
      try {
        stubState.process.kill();
      } catch (err) {
        recordStubLog(`stub error: ${(err as Error).message}`);
      }
      stubState.process = null;
      stubState.theme = null;
      recordStubLog('stub stopped');
    }
  }
  const logger = new ServiceLogger(rootDir);
  const runner = new TaskRunner();
  const token = process.env.DEEMIND_SERVICE_TOKEN || config.token || '';
  const auth = makeAuthMiddleware(token);

  const allowedOriginsEnv = process.env.DASHBOARD_ORIGIN
    ? process.env.DASHBOARD_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean)
    : undefined;
  const configuredOrigins = allowedOriginsEnv || config.allowedOrigins;

  const corsOptions: CorsOptions = {
    origin: (_origin, callback) => {
      if (!configuredOrigins || configuredOrigins === '*' || configuredOrigins === '*') {
        return callback(null, true);
      }
      const list = Array.isArray(configuredOrigins) ? configuredOrigins : [configuredOrigins];
      if (!_origin || list.includes(_origin)) {
        return callback(null, true);
      }
      return callback(new Error('Origin not allowed'), false);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Deemind-Token'],
  };
  app.use(cors(corsOptions));
  app.use(express.json({ limit: '10mb' }));

  runner.on('task-started', (task) => logger.write(`Task started: ${task?.label}`));
  runner.on('task-finished', ({ id, code }) => logger.write(`Task finished: ${id} exit=${code}`));
  runner.on('log', (line) => logger.write(line.trim()));

  // Task runner endpoint
  app.post('/api/run', auth, (req, res) => {
    const { task = 'build-all' } = req.body || {};
    const def = config.tasks?.[task];
    if (!def) {
      return res.status(400).json({ error: `Unknown task: ${task}` });
    }
    const id = uuid();
    runner.enqueue({
      id,
      label: task,
      command: def.command,
      args: def.args || [],
      cwd: rootDir,
    });
    res.json({ enqueued: true, id });
  });

  app.get('/api/status', auth, (_req, res) => {
    res.json({
      current: runner.getCurrent(),
      queue: runner.getQueue(),
    });
  });

  // Theme routes
  app.get('/api/themes', auth, async (_req, res) => {
    const themes = await listThemes(inputDir, outputDir);
    res.json({ themes });
  });

  app.get('/api/themes/:theme/structure', auth, async (req, res) => {
    const data = await readThemeStructure(req.params.theme, inputDir);
    if (!data) return res.status(404).json({ error: 'Theme not found' });
    res.json(data);
  });

  app.get('/api/themes/:theme/metadata', auth, async (req, res) => {
    const file = path.join(inputDir, req.params.theme, 'theme.json');
    const data = (await safeReadJson(file)) || {};
    res.json(data);
  });

  app.post('/api/themes/:theme/metadata', auth, async (req, res) => {
    const file = path.join(inputDir, req.params.theme, 'theme.json');
    await fs.ensureDir(path.dirname(file));
    await fs.writeJson(file, req.body || {}, { spaces: 2 });
    res.json({ saved: true });
  });

  app.post('/api/themes/:theme/run', auth, async (req, res) => {
    const theme = req.params.theme;
    const { diff = false } = req.body || {};
    const { command, args } = buildRunCommand(theme, diff ? ['--diff'] : []);
    const id = uuid();
    runner.enqueue({ id, label: `build:${theme}`, command, args, cwd: rootDir });
    res.json({ enqueued: true, id });
  });

  app.get('/api/themes/:theme/reports', auth, async (req, res) => {
    const theme = req.params.theme;
    const basePath = path.join(outputDir, theme);
    const manifest = await safeReadJson(path.join(basePath, 'manifest.json'));
    const extended = await safeReadJson(path.join(basePath, 'report-extended.json'));
    const baseline = await safeReadJson(path.join(basePath, 'reports', 'baseline-summary.json'));
    const diffPath = path.join(basePath, 'reports', 'baseline-diff.md');
    const diff = (await fs.pathExists(diffPath)) ? await fs.readFile(diffPath, 'utf8') : null;
    res.json({ manifest, extended, baseline, diff });
  });

  app.get('/api/preview/stub', auth, (_req, res) => {
    res.json({ running: Boolean(stubState.process), theme: stubState.theme, port: stubState.port });
  });

  app.get('/api/preview/stub/logs', auth, (_req, res) => {
    res.json({ logs: stubState.logs });
  });

  async function readTwilightConfig() {
    if (!(await fs.pathExists(twilightConfigFile))) {
      await fs.ensureDir(path.dirname(twilightConfigFile));
      await fs.writeJson(twilightConfigFile, { enabled: true }, { spaces: 2 });
    }
    const data = await fs.readJson(twilightConfigFile).catch(() => ({ enabled: true }));
    return { enabled: Boolean(data?.enabled ?? true) };
  }

  async function writeTwilightConfig(next: { enabled: boolean }) {
    await fs.ensureDir(path.dirname(twilightConfigFile));
    await fs.writeJson(twilightConfigFile, next, { spaces: 2 });
    return next;
  }

  app.post('/api/preview/stub', auth, async (req, res) => {
    if (stubState.process) {
      return res.status(409).json({ error: 'Stub already running', port: stubState.port, theme: stubState.theme });
    }
    const { theme: requestedTheme } = req.body || {};
    const theme = sanitizeThemeName(requestedTheme) || 'demo';
    try {
      execSync(`${process.execPath} tools/preview-static.js ${theme}`, { cwd: rootDir, stdio: 'inherit' });
    } catch (err) {
      recordStubLog(`preview:seed failed ${err instanceof Error ? err.message : String(err)}`);
      return res.status(500).json({ error: 'Failed to seed preview snapshots.' });
    }
    recordStubLog(`starting stub for theme ${theme}`);
    const child = spawn(process.execPath, ['server/runtime-stub.js', theme], {
      cwd: rootDir,
      env: { ...process.env, PREVIEW_PORT: String(stubState.port) },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    stubState.process = child;
    stubState.theme = theme;
    child.stdout?.on('data', (buf) => recordStubLog(buf.toString().trim()));
    child.stderr?.on('data', (buf) => recordStubLog(buf.toString().trim()));
    child.on('exit', (code) => {
      recordStubLog(`stub exited with code ${code}`);
      stubState.process = null;
      stubState.theme = null;
    });
    res.json({ running: true, port: stubState.port, theme });
  });

  app.delete('/api/preview/stub', auth, (_req, res) => {
    stopStubProcess();
    res.json({ running: false });
  });

  app.post('/api/preview/stub/reset', auth, async (req, res) => {
    const requestedTheme = sanitizeThemeName(req.body?.theme as string);
    const targetTheme = requestedTheme || stubState.theme;
    if (!targetTheme) {
      return res.status(400).json({ error: 'Theme required to reset stub state.' });
    }
    await fs.ensureDir(stateDir);
    const stateFile = path.join(stateDir, `${targetTheme}.json`);
    let resetInProcess = false;
    if (stubState.process && stubState.theme === targetTheme) {
      try {
        const response = await fetch(`http://localhost:${stubState.port}/api/state/reset`, { method: 'POST' });
        if (!response.ok) {
          throw new Error(`Stub responded with ${response.status}`);
        }
        resetInProcess = true;
        recordStubLog(`state reset via stub API for theme ${targetTheme}`);
      } catch (error) {
        recordStubLog(`state reset via stub API failed for ${targetTheme}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    if (!resetInProcess) {
      await fs.remove(stateFile);
      recordStubLog(`state file cleared for theme ${targetTheme}`);
    }
    res.json({ success: true, theme: targetTheme, inPlace: resetInProcess });
  });

  app.get('/api/store/demos', auth, async (_req, res) => {
    try {
      const { listStoreDemos } = await composerModulePromise;
      const demos = await listStoreDemos();
      res.json({ demos });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.get('/api/store/compose', auth, async (req, res) => {
    try {
      const demo = String(req.query.demo || 'electronics');
      const parts = req.query.parts
        ? String(req.query.parts)
            .split(',')
            .map((p) => p.trim())
            .filter(Boolean)
        : undefined;
      const { composeStore } = await composerModulePromise;
      const composed = await composeStore(demo, { includeOnly: parts, writeCache: false });
      res.json(composed);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post('/api/store/preset', auth, async (req, res) => {
    const { demo = 'electronics', overrides = {}, parts, theme: requestedTheme } = req.body || {};
    const includeOnly = Array.isArray(parts) ? parts : undefined;
    try {
      const { composeStore } = await composerModulePromise;
      const composed = await composeStore(demo, { overrides, includeOnly, writeCache: true });
      const targetTheme = sanitizeThemeName(requestedTheme) || stubState.theme || 'demo';
      await fs.ensureDir(stateDir);
  const stateFile = path.join(stateDir, `${targetTheme}.json`);
  const snapshot = {
    preset: {
      demo: composed.id,
      name: composed.name,
      partials: composed.partials,
      meta: composed.meta,
      generatedAt: composed.generatedAt,
    },
    store: composed.data.store || {},
    products: composed.data.products || [],
    cart: composed.data.cart || { items: [], total: 0 },
    wishlist: composed.data.wishlist || { items: [] },
    session: { user: null, token: null },
  };
      await fs.writeJson(stateFile, snapshot, { spaces: 2 });

      if (stubState.process && stubState.theme === targetTheme) {
        try {
          await fetch(`http://localhost:${stubState.port}/api/store/preset`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ demo, overrides, includeOnly }),
          });
          recordStubLog(`store preset applied live for theme ${targetTheme} using demo ${demo}`);
        } catch (error) {
          recordStubLog(`store preset live sync failed: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      res.json({ success: true, demo, theme: targetTheme, meta: composed.meta, partials: composed.partials });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.get('/api/twilight', auth, async (_req, res) => {
    const config = await readTwilightConfig();
    res.json(config);
  });

  app.post('/api/twilight', auth, async (req, res) => {
    const desired = { enabled: Boolean(req.body?.enabled ?? true) };
    await writeTwilightConfig(desired);
    if (stubState.process) {
      try {
        await fetch(`http://localhost:${stubState.port}/api/twilight`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(desired),
        });
        recordStubLog(`twilight mode set to ${desired.enabled ? 'enabled' : 'disabled'}`);
      } catch (error) {
        recordStubLog(`failed to sync twilight mode: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    res.json(desired);
  });

  app.get('/api/runtime/analytics', auth, async (req, res) => {
    const limit = Number(req.query.limit) || 50;
    const entries = await readRuntimeAnalytics(analyticsLogPath, limit);
    res.json({ entries });
  });

  app.get('/api/store/diff', auth, async (req, res) => {
    const demo = String(req.query.demo || 'electronics');
    const theme = sanitizeThemeName(String(req.query.theme || 'demo'));
    const parts = req.query.parts
      ? String(req.query.parts)
          .split(',')
          .map((p) => p.trim())
          .filter(Boolean)
      : undefined;
    try {
      const { composeStore } = await composerModulePromise;
      const composed = await composeStore(demo, { includeOnly: parts, writeCache: false });
      const currentSnapshot = (await getThemeStateSnapshot(theme, stubState, stateDir)) || {};
      const currentSummary = summarizeSnapshot(currentSnapshot);
      const nextSummary = summarizeSnapshot({
        preset: {
          demo: composed.id,
          name: composed.name,
          partials: composed.partials,
        },
        store: composed.data.store,
        products: composed.data.products,
      });
      const partialDiff = diffPartials(currentSummary.preset?.partials || [], composed.partials);
      res.json({
        demo,
        theme,
        partialDiff,
        current: currentSummary,
        next: nextSummary,
      });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.get('/api/preview/events', auth, async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    if (!stubState.process || !stubState.theme) {
      res.write(`event: status\ndata: ${JSON.stringify({ running: false })}\n\n`);
      return res.end();
    }

    const controller = new AbortController();
    const endStream = () => {
      controller.abort();
      res.end();
    };
    req.on('close', endStream);

    try {
      const upstream = await fetch(`http://localhost:${stubState.port}/events`, { signal: controller.signal });
      if (!upstream.body) {
        res.write(`event: status\ndata: ${JSON.stringify({ running: false, error: 'no upstream stream' })}\n\n`);
        return endStream();
      }
      res.write(
        `event: status\ndata: ${JSON.stringify({ running: true, theme: stubState.theme, port: stubState.port })}\n\n`,
      );
      const relay = Readable.fromWeb(upstream.body as any);
      relay.on('data', (chunk) => res.write(chunk));
      relay.on('end', () => endStream());
      relay.on('error', () => endStream());
    } catch (error) {
      res.write(
        `event: status\ndata: ${JSON.stringify({
          running: false,
          error: error instanceof Error ? error.message : String(error),
        })}\n\n`,
      );
      endStream();
    }
  });

  app.post('/api/themes/upload', auth, upload.single('bundle'), async (req, res) => {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'bundle field is required' });
    }
    const requestedName = sanitizeThemeName((req.body?.themeName as string) || path.parse(file.originalname).name);
    const theme = requestedName || `theme-${Date.now()}`;
    const targetDir = path.join(inputDir, theme);
    await fs.ensureDir(targetDir);
    await fs.emptyDir(targetDir);

    const cleanup = async () => {
      try {
        await fs.remove(file.path);
      } catch {
        void 0;
      }
    };

    try {
      const isZip = path.extname(file.originalname).toLowerCase() === '.zip' || (file.mimetype?.includes('zip') ?? false);
      if (isZip) {
        await extract(file.path, { dir: targetDir });
        await maybeFlattenTheme(targetDir);
      } else {
        await fs.move(file.path, path.join(targetDir, file.originalname), { overwrite: true });
      }
      await cleanup();
      return res.json({ theme, inputPath: targetDir });
    } catch (err) {
      await cleanup();
      await fs.remove(targetDir);
      res.status(500).json({ error: err instanceof Error ? err.message : 'failed to unpack theme' });
    }
  });

  app.get('/api/themes/:theme/preview', auth, async (req, res) => {
    const theme = req.params.theme;
    const basePath = path.join(outputDir, theme);
    if (!(await fs.pathExists(basePath))) {
      return res.status(404).json({ error: 'theme not found in output' });
    }
    const previewFile = path.join(basePath, '.preview.json');
    const htmlPages = globSync('pages/**/*.html', { cwd: basePath, nodir: true });
    const twigPages = globSync('pages/**/*.twig', { cwd: basePath, nodir: true });
    const pageList = Array.from(
      new Set(
        [...htmlPages, ...twigPages].map((p) => p.replace(/\\/g, '/').replace(/\.html$|\.twig$/i, '')),
      ),
    );
    const previewMeta = (await safeReadJson(previewFile)) || {};
    res.json({
      status: previewMeta.status || (pageList.length ? 'ready' : 'missing-pages'),
      url: previewMeta.url || null,
      port: previewMeta.port || null,
      pages: previewMeta.pages || pageList,
      timestamp: previewMeta.timestamp || null,
    });
  });

  // Reports list (existing behavior)
  app.get('/api/reports', auth, async (_req, res) => {
    if (!(await fs.pathExists(reportsDir))) {
      return res.json([]);
    }
    const entries = await fs.readdir(reportsDir);
    const detailed = await Promise.all(
      entries.map(async (name) => {
        const full = path.join(reportsDir, name);
        const stat = await fs.stat(full);
        if (!stat.isFile()) return null;
        return {
          name,
          size: stat.size,
          modified: stat.mtime.toISOString(),
          url: `/reports/${encodeURIComponent(name)}`,
        };
      }),
    );
    res.json(detailed.filter(Boolean).sort((a, b) => (a!.name < b!.name ? 1 : -1)));
  });

  app.get('/api/outputs', auth, async (_req, res) => {
    if (!(await fs.pathExists(outputDir))) {
      return res.json([]);
    }
    const entries = await fs.readdir(outputDir);
    const detailed = await Promise.all(
      entries.map(async (name) => {
        const full = path.join(outputDir, name);
        const stat = await fs.stat(full);
        const isDir = stat.isDirectory();
        const encoded = encodeURIComponent(name);
        const manifestPath = path.join(full, 'manifest.json');
        const reportPath = path.join(full, 'report-extended.json');
        const manifestExists = isDir && (await fs.pathExists(manifestPath));
        const reportExists = isDir && (await fs.pathExists(reportPath));
        return {
          name,
          type: isDir ? 'theme' : 'file',
          size: stat.size,
          modified: stat.mtime.toISOString(),
          manifestUrl: manifestExists ? `/output/${encoded}/manifest.json` : null,
          reportUrl: reportExists ? `/output/${encoded}/report-extended.json` : null,
          browseUrl: `/output/${encoded}`,
        };
      }),
    );
    res.json(detailed.filter(Boolean).sort((a, b) => (a!.modified < b!.modified ? 1 : -1)));
  });

  // Baseline logs & metrics
  app.get('/api/baseline/logs', auth, async (_req, res) => {
    const logs = await getBaselineLogs(baselineLogsDir);
    res.json({ logs });
  });

  app.get('/api/baseline/metrics', auth, async (_req, res) => {
    const metrics = await readBaselineMetrics(path.join(reportsDir, 'baseline-metrics.md'));
    res.json({ metrics });
  });

  app.get('/api/settings', auth, (_req, res) => {
    res.json({
      inputDir,
      outputDir,
      reportsDir,
      logsDir,
      baselines: parseBaselineList(process.env.DEEMIND_BASELINE || 'theme-raed'),
      tokenSet: Boolean(token),
    });
  });

  app.put('/api/settings/baseline', auth, async (req, res) => {
    const { baselines } = req.body || {};
    if (!Array.isArray(baselines) || !baselines.length) {
      return res.status(400).json({ error: 'baselines array required' });
    }
    process.env.DEEMIND_BASELINE = baselines.join(',');
    res.json({ saved: true, baselines });
  });

  app.get('/api/log/history', auth, async (_req, res) => {
    const lines = await logger.tail(200);
    res.json(lines);
  });

  app.get('/api/log/stream', auth, (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const listener = (line: string) => {
      res.write(`data: ${line}\n\n`);
    };
    runner.on('log', listener);

    req.on('close', () => {
      runner.off('log', listener);
    });
  });

  app.use('/reports', auth, express.static(reportsDir));
  app.use('/output', auth, express.static(outputDir));
  app.use('/logs', auth, express.static(logsDir));

  const shutdown = () => {
    stopStubProcess();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  const port = Number(process.env.SERVICE_PORT || config.port || 5757);
  app.listen(port, () => logger.write(`Service listening on http://localhost:${port}`));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
