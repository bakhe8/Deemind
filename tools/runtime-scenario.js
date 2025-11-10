#!/usr/bin/env node
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn, spawnSync } from 'child_process';
import { setTimeout as delay } from 'timers/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
const theme = args[0] || 'demo';
const chainFlag = args.find((arg) => arg.startsWith('--chain='));
const outputFlag = args.find((arg) => arg.startsWith('--output='));
let scenarioChain = [];
if (chainFlag) {
  scenarioChain = chainFlag
    .split('=')[1]
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
} else if (args.length > 1) {
  scenarioChain = args
    .slice(1)
    .filter((arg) => !arg.startsWith('--'))
    .map((arg) => arg.toLowerCase());
}
if (!scenarioChain.length) {
  scenarioChain = ['checkout'];
}
const port = Number(process.env.RUNTIME_PORT || process.env.PREVIEW_PORT || 4100);
const sessionRoot = path.join(rootDir, 'runtime', 'sessions', theme);

const scenarioDir = path.join(rootDir, 'logs', 'runtime-scenarios');
const rawLogPath = outputFlag ? outputFlag.split('=').slice(1).join('=').trim() : process.env.SCENARIO_LOG_FILE;
const resolvedLogPath = rawLogPath
  ? path.isAbsolute(rawLogPath)
    ? rawLogPath
    : path.join(rootDir, rawLogPath)
  : null;

const flows = {
  'add-to-cart': async (ctx) => {
    const { requestStep } = ctx;
    const products = await requestStep('GET', '/api/products');
    if (!Array.isArray(products) || !products.length) {
      throw new Error('No products available for add-to-cart scenario');
    }
    const target = products[0];
    await requestStep('POST', '/api/cart/add', { id: target.id, quantity: 1 });
    await requestStep('POST', '/api/cart/add', { id: target.id, quantity: 2 });
    await requestStep('GET', '/api/cart');
  },
  checkout: async (ctx) => {
    const { requestStep } = ctx;
    const products = await requestStep('GET', '/api/products');
    if (!Array.isArray(products) || products.length < 2) {
      throw new Error('Need at least two products for checkout scenario');
    }
    const [first, second] = products;
    await requestStep('POST', '/api/cart/clear');
    await requestStep('POST', '/api/cart/add', { id: first.id, quantity: 1 });
    await requestStep('POST', '/api/cart/add', { id: second.id, quantity: 2 });
    await requestStep('POST', '/api/cart/update', { id: second.id, quantity: 3 });
    await requestStep('POST', '/api/auth/login', { email: 'scenario@deemind.local', name: 'Scenario Runner' });
    await requestStep('GET', '/api/cart');
    await requestStep('POST', '/api/auth/logout');
  },
  wishlist: async (ctx) => {
    const { requestStep } = ctx;
    const products = await requestStep('GET', '/api/products');
    if (!Array.isArray(products) || !products.length) {
      throw new Error('No products available for wishlist scenario');
    }
    await requestStep('POST', '/api/wishlist/clear');
    await requestStep('POST', '/api/wishlist/add', { id: products[0].id });
    await requestStep('POST', '/api/wishlist/toggle', { id: products[0].id });
    await requestStep('POST', '/api/wishlist/toggle', { id: products[0].id });
    await requestStep('GET', '/api/wishlist');
  },
};

const invalidScenarios = scenarioChain.filter((name) => !flows[name]);
if (invalidScenarios.length) {
  console.error(
    `❌ Unknown scenarios: ${invalidScenarios.join(', ')}. Available: ${Object.keys(flows).join(', ')}`,
  );
  process.exit(1);
}

async function pingStub() {
  try {
    const response = await fetch(`http://localhost:${port}/api/products`, { method: 'GET' });
    if (!response.ok) return false;
    await response.json();
    return true;
  } catch {
    return false;
  }
}

async function waitForStub(timeoutMs = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await pingStub()) return true;
    await delay(200);
  }
  return false;
}

async function ensureStubRunning() {
  if (await pingStub()) {
    return { process: null, started: false };
  }
  console.log(`⚙️  Starting runtime stub for ${theme} on port ${port}…`);
  const child = spawn(process.execPath, ['server/runtime-stub.js', theme], {
    cwd: rootDir,
    env: { ...process.env, PREVIEW_PORT: String(port), RUNTIME_SESSION_ROOT: sessionRoot },
    stdio: ['ignore', 'inherit', 'inherit'],
  });
  const ready = await waitForStub();
  if (!ready) {
    child.kill('SIGTERM');
    throw new Error('Runtime stub did not start in time.');
  }
  return { process: child, started: true };
}

async function runScenario() {
  await fs.ensureDir(scenarioDir);
  const seed = spawnSync(process.execPath, ['tools/preview-static.js', theme], {
    cwd: rootDir,
    stdio: 'inherit',
  });
  if (seed.status !== 0) {
    console.warn('⚠️  preview:seed failed – scenario will rely on existing snapshots.');
  }
  const session = {
    theme,
    chain: scenarioChain,
    port,
    startedAt: new Date().toISOString(),
    steps: [],
    scenarios: [],
  };

  const controller = await ensureStubRunning();

  async function requestStep(method, urlPath, body, scenarioLabel = scenarioChain[0]) {
    const entry = {
      method,
      path: urlPath,
      body: body ?? null,
      scenario: scenarioLabel,
      startedAt: new Date().toISOString(),
    };
    try {
      const response = await fetch(`http://localhost:${port}${urlPath}`, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      entry.status = response.status;
      entry.ok = response.ok;
      const json = await response.json().catch(() => null);
      entry.response = json;
      entry.finishedAt = new Date().toISOString();
      session.steps.push(entry);
      if (!response.ok) {
        throw new Error(`Request ${method} ${urlPath} failed (${response.status}).`);
      }
      return json;
    } catch (error) {
      entry.error = error instanceof Error ? error.message : String(error);
      entry.finishedAt = new Date().toISOString();
      session.steps.push(entry);
      throw error;
    }
  }

  try {
    for (const scenarioName of scenarioChain) {
      const segment = {
        name: scenarioName,
        startedAt: new Date().toISOString(),
      };
      try {
        await flows[scenarioName]({
          requestStep: (method, urlPath, body) => requestStep(method, urlPath, body, scenarioName),
        });
        segment.succeeded = true;
      } catch (error) {
        segment.succeeded = false;
        segment.error = error instanceof Error ? error.message : String(error);
        session.error = segment.error;
        session.succeeded = false;
        session.scenarios.push({ ...segment, finishedAt: new Date().toISOString() });
        throw error;
      }
      segment.finishedAt = new Date().toISOString();
      session.scenarios.push(segment);
    }
    session.succeeded = true;
  } catch (error) {
    if (!session.error) {
      session.error = error instanceof Error ? error.message : String(error);
    }
    console.error(`❌ Scenario chain failed: ${session.error}`);
  } finally {
    session.finishedAt = new Date().toISOString();
    const defaultFileName = `${theme}-${scenarioChain.join('_')}-${Date.now()}.json`;
    const targetPath = resolvedLogPath || path.join(scenarioDir, defaultFileName);
    await fs.ensureDir(path.dirname(targetPath));
    await fs.writeJson(targetPath, session, { spaces: 2 });
    console.log(`📝 Scenario log written to ${path.relative(rootDir, targetPath)}`);
    if (controller.process) {
      controller.process.kill('SIGTERM');
    }
  }

  if (!session.succeeded) {
    process.exitCode = 1;
  } else {
    console.log('✅ Scenario chain completed successfully.');
  }
}

runScenario();
