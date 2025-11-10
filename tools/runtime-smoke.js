#!/usr/bin/env node
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn, spawnSync } from 'child_process';
import { setTimeout as delay } from 'timers/promises';
import { composeStore } from './store-compose.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const [themeArg, demoArg] = process.argv.slice(2);
const theme = themeArg || 'demo';
const demo = demoArg || 'electronics';
const port = Number(process.env.RUNTIME_SMOKE_PORT || process.env.PREVIEW_PORT || 4195);
const sessionRoot = path.join(rootDir, 'runtime', 'sessions', theme);

const RESULT_BADGE = {
  pass: (label) => console.log(`✅ ${label}`),
  fail: (label, error) => console.error(`❌ ${label}: ${error}`),
};

async function pingStub() {
  try {
    const res = await fetch(`http://localhost:${port}/api/state`, { method: 'GET' });
    if (!res.ok) return false;
    await res.json();
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

async function ensureStub() {
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

async function request(method, urlPath, body) {
  const response = await fetch(`http://localhost:${port}${urlPath}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`${method} ${urlPath} failed (${response.status}) ${JSON.stringify(data)}`);
  }
  return data;
}

async function run() {
  console.log(`🧪 Runtime smoke test → theme="${theme}" demo="${demo}"`);
  const seed = spawnSync(process.execPath, ['tools/preview-static.js', theme], {
    cwd: rootDir,
    stdio: 'inherit',
  });
  if (seed.status !== 0) {
    throw new Error('preview-static seed failed.');
  }

  const stubController = await ensureStub();
  try {
    const composed = await composeStore(demo, { writeCache: false });
    RESULT_BADGE.pass(`Composed store "${demo}" with ${composed.partials.length} partials`);

    await request('POST', '/api/store/preset', { demo, includeOnly: composed.partials });
    RESULT_BADGE.pass('Applied preset via stub API');

    const snapshot = await request('GET', '/api/state');
    if (!snapshot?.store?.name) {
      throw new Error('State snapshot missing store information.');
    }
    RESULT_BADGE.pass(`Snapshot state loaded (${snapshot.store.name})`);

    const products = snapshot.products || composed.data.products || [];
    if (!products.length) {
      throw new Error('No products available to exercise cart APIs.');
    }
    const targetProduct = products[0];

    await request('POST', '/api/cart/add', { id: targetProduct.id, quantity: 2 });
    const cart = await request('GET', '/api/cart');
    if (!cart.items?.length) {
      throw new Error('Cart did not capture add-to-cart request.');
    }
    RESULT_BADGE.pass('Cart API add/get cycle');

    await request('POST', '/api/auth/login', { email: 'smoke@deemind.local', name: 'Smoke Tester' });
    const session = await request('GET', '/api/auth/me');
    if (!session?.user?.email) {
      throw new Error('Auth session missing user payload.');
    }
    RESULT_BADGE.pass('Auth login/me endpoints');

    await request('POST', '/api/wishlist/toggle', { id: targetProduct.id });
    const wishlist = await request('GET', '/api/wishlist');
    if (!wishlist.items || wishlist.items.length === 0) {
      throw new Error('Wishlist toggle did not add item.');
    }
    RESULT_BADGE.pass('Wishlist toggle endpoint');

    await request('POST', '/api/cart/clear');
    RESULT_BADGE.pass('Cart clear endpoint');

    console.log('🎉 Runtime smoke test finished successfully.');
  } finally {
    if (stubController.process) {
      stubController.process.kill('SIGTERM');
    }
  }
}

run().catch((error) => {
  RESULT_BADGE.fail('Runtime smoke test failed', error?.message || error);
  process.exitCode = 1;
});
