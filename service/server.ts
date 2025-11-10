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
import chokidar from 'chokidar';
import { execSync, execFileSync, spawn, ChildProcess } from 'child_process';
import net from 'net';
import { Readable } from 'stream';
import crypto from 'crypto';
import { TaskRunner } from './task-runner.js';
import { makeAuthMiddleware } from './security.js';
import { ServiceLogger } from './logger.js';
import { DEFAULT_JSON_TEMPLATES, mergeJsonWithTemplate, ensureJsonFile } from './default-schemas.js';
import type { RunRequest } from '../core/contracts/api.contract.ts';
import { registerRunRoutes } from './routes/run.js';
import brandsRouter from './routes/brands.js';
import { PRESET_METADATA_FILENAME } from '../core/brand/constants.js';
import { sanitizeThemeName } from '../core/utils/sanitize.ts';
import { readJsonSafe } from '../core/utils/fs.ts';

dotenv.config();

const CONFIG_PATH = path.join(process.cwd(), 'service', 'config.json');
const composerModulePromise = import('../tools/store-compose.js');
const mockLayerModulePromise = import('../tools/mock-layer/mock-data-builder.js');
const INPUT_MANIFEST_FILENAME = '.deemind-manifest.json';
const MANIFEST_IGNORE = new Set([INPUT_MANIFEST_FILENAME, PRESET_METADATA_FILENAME]);
const MOCK_CONTEXT_DIR = path.join(process.cwd(), 'mockups', 'store', 'cache', 'context');

type StubInstance = {
  process: ChildProcess;
  theme: string;
  port: number;
  logs: string[];
};

const stubPool = new Map<string, StubInstance>();
type BuildSessionStatus = 'queued' | 'running' | 'succeeded' | 'failed';
type BuildSession = {
  id: string;
  theme: string;
  diff: boolean;
  status: BuildSessionStatus;
  startedAt: string | null;
  finishedAt: string | null;
  logs: string[];
  source: string;
  exitCode: number | null;
  metrics?: {
    errors: number;
    warnings: number;
  } | null;
};

const buildSessions: BuildSession[] = [];
const buildStreamClients = new Set<express.Response>();
const logStreamClients = new Set<express.Response>();
const sseClients = new Set<express.Response>();
let activeBuildId: string | null = null;
const MAX_BUILD_SESSIONS = 15;
const MAX_BUILD_LOGS = 400;
function parseBaselineList(value: string) {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

type ScenarioSessionStatus = 'queued' | 'running' | 'succeeded' | 'failed';
type ScenarioSession = {
  id: string;
  theme: string;
  chain: string[];
  status: ScenarioSessionStatus;
  startedAt: string | null;
  finishedAt: string | null;
  source: string;
  logFile: string | null;
  exitCode: number | null;
  durationMs?: number | null;
};

const scenarioSessions: ScenarioSession[] = [];
const scenarioStreamClients = new Set<express.Response>();
const MAX_SCENARIO_SESSIONS = 20;
let brandWatcher: chokidar.FSWatcher | null = null;
const scenarioFlows = [
  { id: 'add-to-cart', label: 'Add to Cart' },
  { id: 'checkout', label: 'Checkout Flow' },
  { id: 'wishlist', label: 'Wishlist Loop' },
];

const safeReadJson = readJsonSafe;

function resolveRuntimeStateFiles(stateDir: string, theme: string) {
  const normalized = sanitizeThemeName(theme) || theme || 'demo';
  const runtimeRoot = path.dirname(stateDir);
  const sessionFile = path.join(runtimeRoot, 'sessions', normalized, 'state', 'state.json');
  const legacyFile = path.join(stateDir, `${normalized}.json`);
  return { normalized, sessionFile, legacyFile };
}

async function readRuntimeStateFile(theme: string, stateDir: string) {
  const { sessionFile, legacyFile } = resolveRuntimeStateFiles(stateDir, theme);
  if (await fs.pathExists(sessionFile)) return fs.readJson(sessionFile);
  if (await fs.pathExists(legacyFile)) return fs.readJson(legacyFile);
  return null;
}

async function writeRuntimeState(theme: string, stateDir: string, nextState: any) {
  const { sessionFile, legacyFile } = resolveRuntimeStateFiles(stateDir, theme);
  await fs.ensureDir(path.dirname(sessionFile));
  await fs.writeJson(sessionFile, nextState, { spaces: 2 });
  await fs.ensureDir(path.dirname(legacyFile));
  await fs.writeJson(legacyFile, nextState, { spaces: 2 });
}

async function clearRuntimeState(theme: string, stateDir: string) {
  const { sessionFile, legacyFile } = resolveRuntimeStateFiles(stateDir, theme);
  await Promise.allSettled([fs.remove(sessionFile), fs.remove(legacyFile)]);
}

async function syncStateFromStub(theme: string, stateDir: string) {
  const stub = getStubState(theme);
  if (!stub) return null;
  const response = await fetch(`http://localhost:${stub.port}/api/state`);
  if (!response.ok) {
    throw new Error(`Failed to fetch runtime state from stub (${response.status})`);
  }
  const state = await response.json();
  await writeRuntimeState(theme, stateDir, state);
  return state;
}

async function mutateOfflineState(theme: string, stateDir: string, mutator: (state: any) => any) {
  const current = await readRuntimeStateFile(theme, stateDir);
  if (!current) {
    throw new Error('No runtime state found for theme');
  }
  const cloned = JSON.parse(JSON.stringify(current));
  const next = mutator(cloned);
  await writeRuntimeState(theme, stateDir, next);
  return next;
}

async function fetchStubContext(theme?: string | null) {
  const stub = getStubState(theme || undefined);
  if (!stub) return null;
  const response = await fetch(`http://localhost:${stub.port}/api/runtime/context`);
  if (!response.ok) {
    throw new Error(`Stub context request failed (${response.status})`);
  }
  return response.json();
}

async function readCachedContext(theme: string) {
  const file = path.join(MOCK_CONTEXT_DIR, `${theme}.json`);
  if (!(await fs.pathExists(file))) return null;
  return fs.readJson(file);
}

async function regenerateMockContext(theme: string, demo: string) {
  const module = await mockLayerModulePromise;
  if (!module?.buildMockContext || !module?.writeMockContext) {
    throw new Error('Mock layer module unavailable');
  }
  const context = await module.buildMockContext(demo);
  const file = await module.writeMockContext(theme, context);
  return { context, file };
}

async function loadConfig() {
  if (!(await fs.pathExists(CONFIG_PATH))) {
    throw new Error('Missing service/config.json');
  }
  return fs.readJson(CONFIG_PATH);
}

type InputManifest = {
  generatedAt: string;
  files: Record<string, string>;
};

async function generateInputManifest(dir: string): Promise<InputManifest> {
  const files = globSync('**/*', { cwd: dir, nodir: true, dot: true });
  const entries = await Promise.all(
    files
      .filter((relative) => !MANIFEST_IGNORE.has(path.basename(relative)))
      .map(async (relative) => {
        const absolute = path.join(dir, relative);
        const buffer = await fs.readFile(absolute);
        const hash = crypto.createHash('sha1').update(buffer).digest('hex');
        return [relative.replace(/\\/g, '/'), hash] as const;
      }),
  );
  const map: Record<string, string> = {};
  for (const [relative, hash] of entries) {
    map[relative] = hash;
  }
  return {
    generatedAt: new Date().toISOString(),
    files: map,
  };
}

function diffManifests(previous: Record<string, string> | null | undefined, next: Record<string, string>) {
  const prevMap = previous || {};
  const added: string[] = [];
  const removed: string[] = [];
  const changed: string[] = [];

  for (const [file, hash] of Object.entries(next)) {
    if (!(file in prevMap)) {
      added.push(file);
    } else if (prevMap[file] !== hash) {
      changed.push(file);
    }
  }
  for (const file of Object.keys(prevMap)) {
    if (!(file in next)) {
      removed.push(file);
    }
  }
  return { added, removed, changed };
}

async function applyDefaultTemplates(themeDir: string) {
  const applied: string[] = [];
  await Promise.all(
    Object.entries(DEFAULT_JSON_TEMPLATES).map(async ([relativePath, template]) => {
      const filePath = path.join(themeDir, relativePath);
      if (!(await fs.pathExists(filePath))) {
        await ensureJsonFile(filePath, template);
        applied.push(`${relativePath} (created)`);
      } else {
        const before = await fs.readJson(filePath).catch(() => ({}));
        const merged = await mergeJsonWithTemplate(filePath, template);
        if (JSON.stringify(before) !== JSON.stringify(merged)) {
          applied.push(`${relativePath} (merged)`);
        }
      }
    }),
  );
  return applied;
}

async function getThemeStateSnapshot(theme: string, stateDir: string) {
  const normalized = theme ? theme.toLowerCase() : '';
  const stubState = getStubState(normalized || undefined);
  const effectiveTheme = normalized || stubState?.theme || 'demo';
  if (stubState) {
    try {
      const res = await fetch(`http://localhost:${stubState.port}/api/state`);
      if (res.ok) {
        return await res.json();
      }
    } catch {
      void 0;
    }
  }
  const snapshot = await readRuntimeStateFile(effectiveTheme, stateDir);
  if (snapshot) {
    return snapshot;
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

function broadcastBuildEvent(event: string, payload: any) {
  for (const client of buildStreamClients) {
    client.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
  }
}

function getBuildSessionsSnapshot() {
  return buildSessions.map((session) => ({ ...session }));
}

function recordBuildSession(session: BuildSession) {
  buildSessions.unshift(session);
  if (buildSessions.length > MAX_BUILD_SESSIONS) {
    buildSessions.pop();
  }
  broadcastBuildEvent('status', session);
}

function updateBuildSession(sessionId: string, patch: Partial<BuildSession>) {
  const idx = buildSessions.findIndex((session) => session.id === sessionId);
  if (idx === -1) return null;
  buildSessions[idx] = { ...buildSessions[idx], ...patch };
  broadcastBuildEvent('status', buildSessions[idx]);
  return buildSessions[idx];
}

function appendBuildLog(sessionId: string, line: string) {
  const session = buildSessions.find((entry) => entry.id === sessionId);
  if (!session) return;
  session.logs = [...session.logs, line].slice(-MAX_BUILD_LOGS);
  broadcastBuildEvent('log', { id: sessionId, line });
}

function normalizeCart(cart: any) {
  const items = Array.isArray(cart?.items) ? cart.items : [];
  return {
    items: items.map((item) => ({
      ...item,
      quantity: Math.max(1, Number(item?.quantity) || 1),
      price: Number(item?.price) || 0,
    })),
    total: Number(cart?.total) || 0,
  };
}

function recalcCartTotals(cart: { items: Array<{ price: number; quantity: number }>; total: number }) {
  cart.total = cart.items.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 0), 0);
}

function broadcastScenarioEvent(event: string, payload: any) {
  for (const client of scenarioStreamClients) {
    client.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
  }
}

function getScenarioSessionsSnapshot() {
  return scenarioSessions.map((session) => ({ ...session }));
}

function recordScenarioSession(session: ScenarioSession) {
  scenarioSessions.unshift(session);
  if (scenarioSessions.length > MAX_SCENARIO_SESSIONS) {
    scenarioSessions.pop();
  }
  broadcastScenarioEvent('status', session);
}

function updateScenarioSession(sessionId: string, patch: Partial<ScenarioSession>) {
  const idx = scenarioSessions.findIndex((session) => session.id === sessionId);
  if (idx === -1) return null;
  const current = scenarioSessions[idx];
  const next = { ...current, ...patch };
  if (next.startedAt && next.finishedAt && typeof next.durationMs !== 'number') {
    const start = new Date(next.startedAt).getTime();
    const end = new Date(next.finishedAt).getTime();
    if (!Number.isNaN(start) && !Number.isNaN(end) && end >= start) {
      next.durationMs = end - start;
    }
  }
  scenarioSessions[idx] = next;
  broadcastScenarioEvent('status', scenarioSessions[idx]);
  return scenarioSessions[idx];
}

function broadcastSse(event: string, payload: any) {
  if (!sseClients.size) return;
  const message = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const client of sseClients) {
    client.write(message);
  }
}

function sanitizeScenarioId(raw?: string) {
  if (!raw) return '';
  return raw.toLowerCase().replace(/[^a-z0-9-_]/gi, '');
}

async function readRuntimeAnalytics(logPath: string, limit = 50, theme?: string) {
  if (!(await fs.pathExists(logPath))) return [];
  const content = await fs.readFile(logPath, 'utf8');
  const lines = content.split(/\r?\n/).filter(Boolean);
  let entries = lines
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
  if (theme) {
    entries = entries.filter((entry: any) => entry?.theme === theme);
  }
  return entries.slice(-limit);
}

async function readScenarioRuns(dir: string, limit = 10) {
  if (!(await fs.pathExists(dir))) return [];
  const files = await fs.readdir(dir);
  const enriched = await Promise.all(
    files
      .filter((name) => name.endsWith('.json'))
      .map(async (name) => {
        const full = path.join(dir, name);
        const stat = await fs.stat(full).catch(() => null);
        return stat ? { name, full, mtime: stat.mtimeMs } : null;
      }),
  );
  const selected = enriched
    .filter(Boolean)
    .sort((a, b) => (b!.mtime || 0) - (a!.mtime || 0))
    .slice(0, limit) as Array<{ name: string; full: string; mtime: number }>;

  const runs = [];
  for (const item of selected) {
    const data = await safeReadJson(item.full);
    if (!data) continue;
    runs.push({
      file: item.name,
      theme: data.theme,
      chain: data.chain || (data.scenario ? [data.scenario] : []),
      scenarios: data.scenarios || [],
      steps: Array.isArray(data.steps) ? data.steps.length : 0,
      startedAt: data.startedAt,
      finishedAt: data.finishedAt,
      succeeded: Boolean(data.succeeded),
      error: data.error || null,
    });
  }
  return runs;
}

const PORT_SCAN_BASE = 4100;
const PORT_SCAN_LENGTH = 40;

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function isPortFree(port: number) {
  return new Promise<boolean>((resolve) => {
    const tester = net
      .createServer()
      .once('error', () => resolve(false))
      .once('listening', () => tester.close(() => resolve(true)))
      .listen(port, '127.0.0.1');
  });
}

async function findAvailablePort(preferred?: number) {
  const usedPorts = new Set(Array.from(stubPool.values()).map((state) => state.port));
  const candidates: number[] = [];
  if (typeof preferred === 'number' && preferred > 0) candidates.push(preferred);
  for (let offset = 0; offset < PORT_SCAN_LENGTH; offset += 1) {
    candidates.push(PORT_SCAN_BASE + offset);
  }
  for (const port of candidates) {
    if (usedPorts.has(port)) continue;
    if (await isPortFree(port)) return port;
    await wait(200);
  }
  let fallback = PORT_SCAN_BASE + candidates.length;
  while (usedPorts.has(fallback) || !(await isPortFree(fallback))) {
    fallback += 1;
    await wait(100);
  }
  return fallback;
}

function getStubState(theme?: string) {
  if (theme) return stubPool.get(theme) || null;
  const first = stubPool.values().next();
  return first.done ? null : first.value;
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
        manifest: manifest || null,
      };
    }),
  );
  return themes;
}

async function readPreviewSnapshot(themeName: string, outputDir: string) {
  const basePath = path.join(outputDir, themeName);
  if (!(await fs.pathExists(basePath))) {
    return null;
  }
  const previewFile = path.join(basePath, '.preview.json');
  const htmlPages = globSync('pages/**/*.html', { cwd: basePath, nodir: true });
  const twigPages = globSync('pages/**/*.twig', { cwd: basePath, nodir: true });
  const pageList = Array.from(
    new Set(
      [...htmlPages, ...twigPages].map((p) =>
        p
          .replace(/\\/g, '/')
          .replace(/\.html$|\.twig$/i, ''),
      ),
    ),
  );
  const previewMeta = (await safeReadJson(previewFile)) || {};
  return {
    status: previewMeta.status || (pageList.length ? 'ready' : 'missing-pages'),
    url: previewMeta.url || null,
    port: previewMeta.port || null,
    pages: previewMeta.pages || pageList,
    timestamp: previewMeta.timestamp || null,
  };
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
  const analyticsLogPath = path.join(rootDir, 'logs', 'runtime-analytics.jsonl');
  const scenarioLogDir = path.join(logsDir, 'runtime-scenarios');
  const brandPresetDir = path.join(rootDir, 'core', 'brands');
  await fs.ensureDir(brandPresetDir);
  function listStubStates() {
    return Array.from(stubPool.values()).map((state) => ({
      theme: state.theme,
      port: state.port,
      running: Boolean(state.process),
      logs: state.logs.slice(-50),
    }));
  }

  function recordStubLog(theme: string, line: string) {
    const state = stubPool.get(theme);
    if (!state) return;
    state.logs.push(line);
    if (state.logs.length > 200) state.logs.shift();
  }

  function stopStubProcess(theme?: string) {
    if (!theme) {
      Array.from(stubPool.keys()).forEach((key) => stopStubProcess(key));
      return;
    }
    const instance = stubPool.get(theme);
    if (!instance) return;
    try {
      instance.process.kill();
    } catch (err) {
      recordStubLog(theme, `stub error: ${(err as Error).message}`);
    }
    stubPool.delete(theme);
    recordStubLog(theme, 'stub stopped');
  }

  const emitBrandEvent = (event: string, filePath: string) => {
    const slug = path.parse(filePath).name;
    broadcastSse(event, { slug, file: path.relative(rootDir, filePath) });
  };

  brandWatcher = chokidar.watch(path.join(brandPresetDir, '*.json'), { ignoreInitial: true });
  brandWatcher.on('add', (filePath) => emitBrandEvent('brand-added', filePath));
  brandWatcher.on('change', (filePath) => emitBrandEvent('brand-updated', filePath));
  brandWatcher.on('unlink', (filePath) => emitBrandEvent('brand-removed', filePath));
const logger = new ServiceLogger(rootDir);
const runner = new TaskRunner();
const token = process.env.DEEMIND_SERVICE_TOKEN || config.token || '';
const auth = makeAuthMiddleware(token);

  logger.on('entry', (entry) => {
    const payload = `data: ${JSON.stringify(entry)}\n\n`;
    for (const client of logStreamClients) {
      client.write(payload);
    }
  });
  function enqueueBuild(themeName: string, options: { diff?: boolean; source?: string } = {}) {
    const diff = Boolean(options.diff);
    const source = options.source || 'api';
    const session: BuildSession = {
      id: uuid(),
      theme: themeName,
      diff,
      status: 'queued',
      startedAt: null,
      finishedAt: null,
      logs: [],
      source,
      exitCode: null,
    };
    recordBuildSession(session);
    const { command, args } = buildRunCommand(themeName, diff ? ['--diff'] : []);
    runner.enqueue({
      id: session.id,
      label: `build:${themeName}`,
      command,
      args,
      cwd: rootDir,
      meta: { buildId: session.id, theme: themeName },
    });
    return session;
  }

  function enqueueScenario(themeName: string, chain: string[], options: { source?: string } = {}) {
    const source = options.source || 'api';
    const cleanedChain = chain.filter((item) => item && typeof item === 'string').map((item) => item.toLowerCase());
    const session: ScenarioSession = {
      id: uuid(),
      theme: themeName,
      chain: cleanedChain.length ? cleanedChain : ['checkout'],
      status: 'queued',
      startedAt: null,
      finishedAt: null,
      source,
      logFile: null,
      exitCode: null,
    };
    recordScenarioSession(session);
    const logFile = path.join(scenarioLogDir, `${session.id}.json`);
    const args = ['tools/runtime-scenario.js', themeName];
    if (session.chain.length) {
      args.push(`--chain=${session.chain.join(',')}`);
    }
    runner.enqueue({
      id: session.id,
      label: `scenario:${themeName}`,
      command: 'node',
      args,
      cwd: rootDir,
      meta: { scenarioId: session.id, scenarioLogFile: logFile },
      env: { SCENARIO_LOG_FILE: logFile },
    });
    return session;
  }

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
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Deemind-Token', 'X-Deemind-Mode'],
  };
  app.use(cors(corsOptions));
  app.use(express.json({ limit: '10mb' }));
  app.use((req, _res, next) => {
    const headerSource = req.headers['x-deemind-source'];
    const headerMode = req.headers['x-deemind-mode'];
    const querySource = typeof req.query?.source === 'string' ? req.query.source : undefined;
    const queryMode = typeof req.query?.mode === 'string' ? req.query.mode : undefined;
    const source = (typeof headerSource === 'string' && headerSource) || querySource || 'api';
    const mode = (typeof headerMode === 'string' && headerMode) || queryMode || 'friendly';
    if (source === 'dashboard') {
      logger.write(`dashboard request ${req.method} ${req.path}`, {
        category: 'http',
        meta: { source, mode, route: req.path },
      });
    }
    next();
  });
  const enableBrands =
    process.env.ENABLE_BRANDS === undefined
      ? true
      : String(process.env.ENABLE_BRANDS).toLowerCase() === 'true';
  if (enableBrands) {
    app.use('/api/brands', auth, brandsRouter);
  }

  registerRunRoutes({ app, auth, config, runner, rootDir, logger });

  async function captureBuildMetrics(themeName: string) {
    const reportPath = path.join(outputDir, themeName, 'report-extended.json');
    if (!(await fs.pathExists(reportPath))) return null;
    const report = await safeReadJson(reportPath);
    if (!report) return null;
    const errors = Array.isArray(report.errors) ? report.errors.length : Number(report.errorCount) || 0;
    const warnings = Array.isArray(report.warnings) ? report.warnings.length : Number(report.warningCount) || 0;
    return { errors, warnings };
  }

  runner.on('task-started', (task) => {
    logger.write(`Task started: ${task?.label}`, {
      category: 'runner',
      theme: task?.meta?.theme,
      sessionId: task?.meta?.buildId || task?.meta?.scenarioId || task?.id,
      meta: {
        label: task?.label,
        id: task?.id,
      },
    });
    if (task?.meta?.buildId) {
      activeBuildId = task.meta.buildId;
      updateBuildSession(task.meta.buildId, { status: 'running', startedAt: new Date().toISOString() });
    }
    if (task?.meta?.scenarioId) {
      updateScenarioSession(task.meta.scenarioId, { status: 'running', startedAt: new Date().toISOString() });
    }
  });
  runner.on('task-finished', ({ id, code, meta }) => {
    logger.write(`Task finished: ${id} exit=${code}`, {
      category: 'runner',
      level: code === 0 ? 'info' : 'warn',
      theme: meta?.theme,
      sessionId: meta?.buildId || meta?.scenarioId || id,
      meta: { id, exitCode: code },
    });
    if (meta?.buildId) {
      const status: BuildSessionStatus = code === 0 ? 'succeeded' : 'failed';
      (async () => {
        let metrics = null;
        if (status === 'succeeded' && typeof meta.theme === 'string' && meta.theme) {
          metrics = await captureBuildMetrics(meta.theme);
        }
        updateBuildSession(meta.buildId, {
          status,
          finishedAt: new Date().toISOString(),
          exitCode: typeof code === 'number' ? code : null,
          metrics,
        });
        if (activeBuildId === meta.buildId) {
          activeBuildId = null;
        }
      })().catch((err) =>
        logger.write(`build metrics error: ${err instanceof Error ? err.message : String(err)}`, {
          level: 'error',
          category: 'runner',
          meta: { buildId: meta?.buildId },
        }),
      );
    }
    if (meta?.jobId) {
    }
    if (meta?.scenarioId) {
      const status: ScenarioSessionStatus = code === 0 ? 'succeeded' : 'failed';
      const patch: Partial<ScenarioSession> = {
        status,
        finishedAt: new Date().toISOString(),
        exitCode: typeof code === 'number' ? code : null,
      };
      if (meta.scenarioLogFile) {
        patch.logFile = path.relative(rootDir, meta.scenarioLogFile);
      }
      updateScenarioSession(meta.scenarioId, patch);
    }
  });
  runner.on('log', (line) => {
    const text = line.toString().trim();
    logger.write(text, { level: 'debug', category: 'runner-output' });
    if (activeBuildId) {
      appendBuildLog(activeBuildId, text);
    }
  });

  app.post('/api/build/start', auth, (req, res) => {
    const theme = sanitizeThemeName(String(req.body?.theme || ''));
    if (!theme) {
      return res.status(400).json({ error: 'theme is required' });
    }
    const diff = Boolean(req.body?.diff);
    const session = enqueueBuild(theme, { diff, source: 'build-start' });
    res.json({ enqueued: true, session });
  });

  app.get('/api/build/sessions', auth, (_req, res) => {
    res.json({ sessions: getBuildSessionsSnapshot() });
  });

  app.get('/api/build/stream', auth, (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();
    res.write(`event: snapshot\ndata: ${JSON.stringify({ sessions: getBuildSessionsSnapshot() })}\n\n`);
    buildStreamClients.add(res);
    req.on('close', () => {
      buildStreamClients.delete(res);
    });
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

  app.get('/api/themes/:theme/preset', auth, async (req, res) => {
    const file = path.join(inputDir, req.params.theme, PRESET_METADATA_FILENAME);
    const data = (await safeReadJson(file)) || {};
    res.json(data);
  });

  app.post('/api/themes/:theme/preset', auth, async (req, res) => {
    const themeDir = path.join(inputDir, req.params.theme);
    const file = path.join(themeDir, PRESET_METADATA_FILENAME);
    await fs.ensureDir(themeDir);
    await fs.writeJson(file, req.body || {}, { spaces: 2 });
    res.json({ saved: true });
  });

  app.post('/api/themes/:theme/defaults', auth, async (req, res) => {
    const themeDir = path.join(inputDir, req.params.theme);
    if (!(await fs.pathExists(themeDir))) {
      return res.status(404).json({ error: 'theme not found in input/' });
    }
    try {
      const applied = await applyDefaultTemplates(themeDir);
      res.json({ success: true, applied });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post('/api/themes/:theme/run', auth, (req, res) => {
    const theme = sanitizeThemeName(req.params.theme);
    if (!theme) {
      return res.status(400).json({ error: 'theme is required' });
    }
    const { diff = false } = req.body || {};
    const session = enqueueBuild(theme, { diff, source: 'theme-route' });
    res.json({ enqueued: true, id: session.id, session });
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

  app.get('/api/reports/:theme/extended', auth, async (req, res) => {
    const theme = sanitizeThemeName(req.params.theme);
    if (!theme) {
      return res.status(400).json({ error: 'theme is required' });
    }
    const filePath = path.join(outputDir, theme, 'report-extended.json');
    const payload = await safeReadJson(filePath);
    if (!payload) {
      return res.status(404).json({ error: 'report not found' });
    }
    res.json(payload);
  });

  app.get('/api/preview/stub', auth, (req, res) => {
    const requestedTheme = sanitizeThemeName(String(req.query.theme || ''));
    const state = getStubState(requestedTheme || undefined);
    if (!state) {
      return res.json({ running: false, theme: requestedTheme || null, port: null });
    }
    res.json({ running: true, theme: state.theme, port: state.port });
  });

  app.get('/api/preview/stub/logs', auth, (req, res) => {
    const requestedTheme = sanitizeThemeName(String(req.query.theme || ''));
    const state = getStubState(requestedTheme || undefined);
    res.json({
      theme: state?.theme || requestedTheme || null,
      logs: state?.logs || [],
    });
  });

  app.get('/api/preview/stubs', auth, (_req, res) => {
    res.json({ stubs: listStubStates() });
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
    const requestedTheme = sanitizeThemeName(req.body?.theme as string);
    if (!requestedTheme) {
      return res.status(400).json({ error: 'Theme is required.' });
    }
    if (stubPool.has(requestedTheme)) {
      const existing = stubPool.get(requestedTheme)!;
      return res.status(409).json({ error: 'Stub already running for theme', port: existing.port, theme: requestedTheme });
    }
    const preferredPort = req.body?.port ? Number(req.body.port) : undefined;
    const port = await findAvailablePort(preferredPort);
    try {
      execFileSync(process.execPath, ['tools/preview-static.js', requestedTheme], { cwd: rootDir, stdio: 'inherit' });
    } catch (err) {
      console.warn(`preview:seed failed for ${requestedTheme}: ${err instanceof Error ? err.message : String(err)}`);
    }
    const sessionRoot = path.join(rootDir, 'runtime', 'sessions', requestedTheme);
    const child = spawn(process.execPath, ['server/runtime-stub.js', requestedTheme], {
      cwd: rootDir,
      env: { ...process.env, PREVIEW_PORT: String(port), RUNTIME_SESSION_ROOT: sessionRoot },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const instance: StubInstance = { process: child, theme: requestedTheme, port, logs: [] };
    stubPool.set(requestedTheme, instance);
    recordStubLog(requestedTheme, `stub starting on port ${port}`);
    child.stdout?.on('data', (buf) => recordStubLog(requestedTheme, buf.toString().trim()));
    child.stderr?.on('data', (buf) => recordStubLog(requestedTheme, buf.toString().trim()));
    child.on('exit', (code) => {
      recordStubLog(requestedTheme, `stub exited with code ${code}`);
      stubPool.delete(requestedTheme);
    });
    res.json({ running: true, port, theme: requestedTheme });
  });

  app.delete('/api/preview/stub', auth, (req, res) => {
    const requestedTheme = sanitizeThemeName(String(req.body?.theme || req.query.theme || ''));
    if (requestedTheme) {
      stopStubProcess(requestedTheme);
      return res.json({ theme: requestedTheme, running: false });
    }
    stopStubProcess();
    res.json({ running: false });
  });

  app.post('/api/preview/stub/reset', auth, async (req, res) => {
    const targetTheme = sanitizeThemeName(req.body?.theme as string);
    if (!targetTheme) {
      return res.status(400).json({ error: 'Theme required to reset stub state.' });
    }
    let resetInProcess = false;
    const runningStub = stubPool.get(targetTheme);
    if (runningStub) {
      try {
        const response = await fetch(`http://localhost:${runningStub.port}/api/state/reset`, { method: 'POST' });
        if (!response.ok) {
          throw new Error(`Stub responded with ${response.status}`);
        }
        resetInProcess = true;
        recordStubLog(targetTheme, 'state reset via stub API');
      } catch (error) {
        recordStubLog(targetTheme, `state reset via stub API failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    if (!resetInProcess) {
      await clearRuntimeState(targetTheme, stateDir);
      recordStubLog(targetTheme, 'state file cleared');
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

  app.get('/api/store/partials', auth, async (_req, res) => {
    try {
      const { listStorePartials } = await composerModulePromise;
      const partials = await listStorePartials();
      res.json({ partials });
    } catch (error) {
      res
        .status(500)
        .json({ error: error instanceof Error ? error.message : String(error) });
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

  app.get('/api/runtime/context', auth, async (req, res) => {
    const theme = sanitizeThemeName(String(req.query?.theme || '')) || 'demo';
    try {
      const stubContext = await fetchStubContext(theme);
      if (stubContext) {
        return res.json({ theme, source: 'stub', context: stubContext });
      }
    } catch (error) {
      logger.write(`runtime context via stub failed: ${error instanceof Error ? error.message : String(error)}`, {
        level: 'warn',
        category: 'runtime',
        theme,
      });
    }
    try {
      const cached = await readCachedContext(theme);
      if (cached) {
        return res.json({ theme, source: 'cache', context: cached });
      }
      res.status(404).json({ error: `No cached context for theme "${theme}". Run npm run mock:data ${theme} <demo>.` });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post('/api/runtime/context', auth, async (req, res) => {
    const normalizedTheme = sanitizeThemeName(String(req.body?.theme || '')) || 'demo';
    const demo = String(req.body?.demo || normalizedTheme || 'electronics');
    try {
      const { context, file } = await regenerateMockContext(normalizedTheme, demo);
      const stub = getStubState(normalizedTheme);
      if (stub) {
        try {
          await fetch(`http://localhost:${stub.port}/api/runtime/context/regenerate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ demo }),
          });
          recordStubLog(normalizedTheme, `runtime context regenerated via demo ${demo}`);
        } catch (error) {
          recordStubLog(
            normalizedTheme,
            `runtime context live sync failed: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
      res.json({
        success: true,
        theme: normalizedTheme,
        demo,
        file: path.relative(process.cwd(), file),
        context,
      });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post('/api/store/preset', auth, async (req, res) => {
    const { demo = 'electronics', overrides = {}, parts, theme: requestedTheme } = req.body || {};
    const includeOnly = Array.isArray(parts) ? parts : undefined;
    try {
      const { composeStore } = await composerModulePromise;
      const composed = await composeStore(demo, { overrides, includeOnly, writeCache: true });
      const normalizedTheme = sanitizeThemeName(requestedTheme);
      const targetStub = getStubState(normalizedTheme || undefined);
      const targetTheme = normalizedTheme || targetStub?.theme || 'demo';

      try {
        const { buildMockContext, writeMockContext } = await mockLayerModulePromise;
        if (buildMockContext && writeMockContext) {
          const mockContext = await buildMockContext(demo);
          await writeMockContext(normalizedTheme || targetTheme, mockContext);
        }
      } catch (mockError) {
        logger.write(
          `mock context update failed: ${mockError instanceof Error ? mockError.message : String(mockError)}`,
          { level: 'warn', category: 'runtime', theme: normalizedTheme || targetTheme },
        );
      }

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
      await writeRuntimeState(targetTheme, stateDir, snapshot);

      if (targetStub && targetStub.theme === targetTheme) {
        try {
          await fetch(`http://localhost:${targetStub.port}/api/store/preset`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ demo, overrides, includeOnly }),
          });
          recordStubLog(targetTheme, `store preset applied live using demo ${demo}`);
        } catch (error) {
          recordStubLog(
            targetTheme,
            `store preset live sync failed: ${error instanceof Error ? error.message : String(error)}`,
          );
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
    await Promise.all(
      Array.from(stubPool.values()).map(async (state) => {
        try {
          await fetch(`http://localhost:${state.port}/api/twilight`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(desired),
          });
          recordStubLog(state.theme, `twilight mode set to ${desired.enabled ? 'enabled' : 'disabled'}`);
        } catch (error) {
          recordStubLog(state.theme, `failed to sync twilight mode: ${error instanceof Error ? error.message : String(error)}`);
        }
      }),
    );
    res.json(desired);
  });

  app.get('/api/runtime/analytics', auth, async (req, res) => {
    const limit = Number(req.query.limit) || 50;
    const themeFilter = sanitizeThemeName(String(req.query.theme || ''));
    const entries = await readRuntimeAnalytics(analyticsLogPath, limit, themeFilter || undefined);
    res.json({ entries });
  });

  app.post('/api/runtime/scenario', auth, (req, res) => {
    const requestedTheme = sanitizeThemeName(String(req.body?.theme || ''));
    if (!requestedTheme) {
      return res.status(400).json({ error: 'theme is required' });
    }
    const chainInput = Array.isArray(req.body?.chain) ? req.body.chain : [];
    const session = enqueueScenario(requestedTheme, chainInput, { source: 'dashboard' });
    res.json({ enqueued: true, session });
  });

  app.get('/api/runtime/scenarios', auth, async (req, res) => {
    const limit = Number(req.query.limit) || 10;
    const runs = await readScenarioRuns(scenarioLogDir, limit);
    res.json({ runs });
  });

  app.get('/api/runtime/scenario/flows', auth, (_req, res) => {
    res.json({ flows: scenarioFlows });
  });

  app.get('/api/runtime/scenario/sessions', auth, (_req, res) => {
    res.json({ sessions: getScenarioSessionsSnapshot() });
  });

  app.get('/api/runtime/scenario/stream', auth, (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();
    res.write(`event: snapshot\ndata: ${JSON.stringify({ sessions: getScenarioSessionsSnapshot() })}\n\n`);
    scenarioStreamClients.add(res);
    req.on('close', () => {
      scenarioStreamClients.delete(res);
    });
  });

  app.get('/api/runtime/scenarios/:id', auth, async (req, res) => {
    const id = sanitizeScenarioId(req.params.id);
    if (!id) {
      return res.status(400).json({ error: 'scenario id is required' });
    }
    const filePath = path.join(scenarioLogDir, `${id}.json`);
    if (!(await fs.pathExists(filePath))) {
      return res.status(404).json({ error: 'Scenario log not found', id });
    }
    const log = await safeReadJson(filePath);
    const session = scenarioSessions.find((entry) => entry.id === id) || null;
    res.json({ id, session, log });
  });

  registerRuntimeStateRoutes(app, auth, stateDir);

  app.get('/api/store/diff', auth, async (req, res) => {
    const demo = String(req.query.demo || 'electronics');
    const theme = sanitizeThemeName(String(req.query.theme || ''));
    const parts = req.query.parts
      ? String(req.query.parts)
          .split(',')
          .map((p) => p.trim())
          .filter(Boolean)
      : undefined;
    try {
      const { composeStore } = await composerModulePromise;
      const composed = await composeStore(demo, { includeOnly: parts, writeCache: false });
      const currentSnapshot = (await getThemeStateSnapshot(theme, stateDir)) || {};
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
    const requestedTheme = sanitizeThemeName(String(req.query.theme || ''));
    const targetStub = getStubState(requestedTheme || undefined);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    if (!targetStub) {
      res.write(
        `event: status\ndata: ${JSON.stringify({
          running: false,
          theme: requestedTheme || null,
        })}\n\n`,
      );
      return res.end();
    }

    const controller = new AbortController();
    const endStream = () => {
      controller.abort();
      res.end();
    };
    req.on('close', endStream);

    try {
      const upstream = await fetch(`http://localhost:${targetStub.port}/events`, { signal: controller.signal });
      if (!upstream.body) {
        res.write(`event: status\ndata: ${JSON.stringify({ running: false, error: 'no upstream stream' })}\n\n`);
        return endStream();
      }
      res.write(
        `event: status\ndata: ${JSON.stringify({
          running: true,
          theme: targetStub.theme,
          port: targetStub.port,
        })}\n\n`,
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
      const defaultsApplied = await applyDefaultTemplates(targetDir);
      const manifestPath = path.join(targetDir, INPUT_MANIFEST_FILENAME);
      const previousManifest = (await safeReadJson(manifestPath)) as InputManifest | null;
      const newManifest = await generateInputManifest(targetDir);
      await fs.writeJson(manifestPath, newManifest, { spaces: 2 });
      const manifestDiff = diffManifests(previousManifest?.files, newManifest.files);

      let presetMetadata: Record<string, any> | null = null;
      const presetPath = path.join(targetDir, PRESET_METADATA_FILENAME);
      if (await fs.pathExists(presetPath)) {
        try {
          const parsed = await fs.readJson(presetPath);
          if (parsed && typeof parsed === 'object') {
            presetMetadata = parsed;
            const metadataPath = path.join(targetDir, 'theme.json');
            let merged = parsed;
            if (await fs.pathExists(metadataPath)) {
              const existingMeta = (await fs.readJson(metadataPath).catch(() => ({}))) || {};
              merged = { ...existingMeta, ...parsed };
            }
            await fs.writeJson(metadataPath, merged, { spaces: 2 });
          }
        } catch {
          presetMetadata = null;
        }
      }

      await cleanup();
      return res.json({ theme, inputPath: targetDir, diff: manifestDiff, preset: presetMetadata, defaultsApplied });
    } catch (err) {
      await cleanup();
      await fs.remove(targetDir);
      res.status(500).json({ error: err instanceof Error ? err.message : 'failed to unpack theme' });
    }
  });

  app.get('/api/themes/:theme/preview', auth, async (req, res) => {
    const theme = req.params.theme;
    const snapshot = await readPreviewSnapshot(theme, outputDir);
    if (!snapshot) {
      return res.status(404).json({ error: 'theme not found in output' });
    }
    res.json(snapshot);
  });

  app.get('/api/themes/previews', auth, async (_req, res) => {
    const themes = await listThemes(inputDir, outputDir);
    const previews = await Promise.all(
      themes.map(async (theme) => {
        const snapshot = await readPreviewSnapshot(theme.name, outputDir);
        return {
          theme: theme.name,
          status: snapshot?.status || 'missing',
          url: snapshot?.url || null,
          port: snapshot?.port || null,
          pages: snapshot?.pages || [],
          timestamp: snapshot?.timestamp || null,
          missing: !snapshot,
        };
      }),
    );
    res.json({ previews });
  });

  app.post('/api/themes/:theme/preview', auth, async (req, res) => {
    const theme = sanitizeThemeName(req.params.theme);
    if (!theme) {
      return res.status(400).json({ error: 'theme is required' });
    }
    try {
      execFileSync(process.execPath, ['tools/preview-static.js', theme], { cwd: rootDir, stdio: 'inherit' });
    } catch (error) {
      return res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
    const basePath = path.join(outputDir, theme);
    const previewFile = path.join(basePath, '.preview.json');
    const previewMeta = (await safeReadJson(previewFile)) || {};
    res.json({ success: true, preview: previewMeta });
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

  app.get('/api/log/stream', auth, async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();
    const history = await logger.tail(50);
    history.forEach((entry) => res.write(`data: ${JSON.stringify(entry)}\n\n`));
    logStreamClients.add(res);
    req.on('close', () => {
      logStreamClients.delete(res);
    });
  });

  app.get('/api/sse', auth, (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();
    sseClients.add(res);
    req.on('close', () => {
      sseClients.delete(res);
    });
  });

  app.use('/reports', auth, express.static(reportsDir));
  app.use('/output', auth, express.static(outputDir));
  app.use('/logs', auth, express.static(logsDir));

  const shutdown = () => {
    stopStubProcess();
    brandWatcher?.close().catch(() => void 0);
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  const port = Number(process.env.SERVICE_PORT || config.port || 5757);
  app.listen(port, () => logger.write(`Service listening on http://localhost:${port}`, { category: 'service' }));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
function registerRuntimeStateRoutes(app: express.Express, auth: express.RequestHandler, stateDir: string) {
  app.get('/api/runtime/state', auth, async (req, res) => {
    const theme = sanitizeThemeName(String(req.query.theme || ''));
    if (!theme) {
      return res.status(400).json({ error: 'theme is required' });
    }
    const state = await getThemeStateSnapshot(theme, stateDir);
    if (!state) {
      return res.status(404).json({ error: 'No runtime state found for theme', theme });
    }
    res.json({ theme, state });
  });

  app.post('/api/runtime/locale', auth, async (req, res) => {
    const theme = sanitizeThemeName(String(req.body?.theme || ''));
    const language = String(req.body?.language || '').trim();
    if (!theme || !language) {
      return res.status(400).json({ error: 'theme and language are required' });
    }
    const targetStub = getStubState(theme);
    if (targetStub) {
      try {
        await fetch(`http://localhost:${targetStub.port}/api/store/locale`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ language }),
        });
        const snapshot = await getThemeStateSnapshot(theme, stateDir);
        if (snapshot) {
          await writeRuntimeState(theme, stateDir, snapshot);
        }
        return res.json({ success: true, theme, language, state: snapshot || null, live: true });
      } catch (error) {
        return res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
      }
    }
    const current = await readRuntimeStateFile(theme, stateDir);
    if (!current) {
      return res.status(404).json({ error: 'No runtime state found for theme' });
    }
    current.store = current.store || {};
    current.store.language = language;
    await writeRuntimeState(theme, stateDir, current);
    res.json({ success: true, theme, language, state: current, live: false });
  });

  const handleStubMutation = async (
    theme: string,
    pathSuffix: string,
    body: any,
    fallback: () => Promise<any>,
  ) => {
    const stub = getStubState(theme);
    if (stub) {
      const response = await fetch(`http://localhost:${stub.port}${pathSuffix}`, {
        method: 'POST',
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!response.ok) {
        throw new Error(`Stub responded with ${response.status}`);
      }
      const state = await syncStateFromStub(theme, stateDir);
      if (!state) {
        throw new Error('Failed to synchronize runtime state from stub.');
      }
      return { state, live: true };
    }
    const state = await fallback();
    return { state, live: false };
  };

  app.post('/api/runtime/cart/clear', auth, async (req, res) => {
    const theme = sanitizeThemeName(String(req.body?.theme || ''));
    if (!theme) return res.status(400).json({ error: 'theme is required' });
    try {
      const result = await handleStubMutation(
        theme,
        '/api/cart/clear',
        null,
        () =>
          mutateOfflineState(theme, stateDir, (state) => {
            const cart = normalizeCart(state.cart);
            cart.items = [];
            cart.total = 0;
            state.cart = cart;
            return state;
          }),
      );
      res.json({ success: true, ...result });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post('/api/runtime/cart/remove', auth, async (req, res) => {
    const theme = sanitizeThemeName(String(req.body?.theme || ''));
    const id = Number(req.body?.id);
    if (!theme) return res.status(400).json({ error: 'theme is required' });
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'valid id is required' });
    try {
      const result = await handleStubMutation(
        theme,
        '/api/cart/remove',
        { id },
        () =>
          mutateOfflineState(theme, stateDir, (state) => {
            const cart = normalizeCart(state.cart);
            cart.items = cart.items.filter((item) => Number(item.id) !== id);
            recalcCartTotals(cart);
            state.cart = cart;
            return state;
          }),
      );
      res.json({ success: true, ...result });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post('/api/runtime/wishlist/clear', auth, async (req, res) => {
    const theme = sanitizeThemeName(String(req.body?.theme || ''));
    if (!theme) return res.status(400).json({ error: 'theme is required' });
    try {
      const result = await handleStubMutation(
        theme,
        '/api/wishlist/clear',
        null,
        () =>
          mutateOfflineState(theme, stateDir, (state) => {
            state.wishlist = { items: [] };
            return state;
          }),
      );
      res.json({ success: true, ...result });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post('/api/runtime/wishlist/remove', auth, async (req, res) => {
    const theme = sanitizeThemeName(String(req.body?.theme || ''));
    const id = Number(req.body?.id);
    if (!theme) return res.status(400).json({ error: 'theme is required' });
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'valid id is required' });
    try {
      const result = await handleStubMutation(
        theme,
        '/api/wishlist/remove',
        { id },
        () =>
          mutateOfflineState(theme, stateDir, (state) => {
            const wishlist = Array.isArray(state?.wishlist?.items) ? state.wishlist.items : [];
            state.wishlist = { items: wishlist.filter((item) => Number(item.id) !== id) };
            return state;
          }),
      );
      res.json({ success: true, ...result });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post('/api/runtime/session/logout', auth, async (req, res) => {
    const theme = sanitizeThemeName(String(req.body?.theme || ''));
    if (!theme) return res.status(400).json({ error: 'theme is required' });
    try {
      const result = await handleStubMutation(
        theme,
        '/api/auth/logout',
        null,
        () =>
          mutateOfflineState(theme, stateDir, (state) => {
            state.session = { user: null, token: null };
            return state;
          }),
      );
      res.json({ success: true, ...result });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });
}
