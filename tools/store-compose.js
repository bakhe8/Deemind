#!/usr/bin/env node
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', 'mockups', 'store');
const PARTIALS_DIR = path.join(ROOT, 'partials');
const DEMOS_DIR = path.join(ROOT, 'demos');
const CACHE_DIR = path.join(ROOT, 'cache', 'composed');

const jsonClone = (value) => JSON.parse(JSON.stringify(value));

const isObject = (value) => value && typeof value === 'object' && !Array.isArray(value);

export function deepMerge(target = {}, source = {}) {
  if (Array.isArray(target) && Array.isArray(source)) {
    return [...target, ...source];
  }
  if (isObject(target) && isObject(source)) {
    const result = { ...target };
    for (const key of Object.keys(source)) {
      if (key in target) {
        result[key] = deepMerge(target[key], source[key]);
      } else {
        result[key] = jsonClone(source[key]);
      }
    }
    return result;
  }
  return jsonClone(source);
}

async function readJsonSafe(file) {
  try {
    return await fs.readJson(file);
  } catch (error) {
    throw new Error(`Unable to read JSON at ${file}: ${error.message}`);
  }
}

function normalizePartial(value) {
  if (typeof value === 'string') {
    const at = value.lastIndexOf('@');
    const hasVersion = at > value.lastIndexOf('/');
    const id = hasVersion ? value.slice(0, at) : value;
    const version = hasVersion ? value.slice(at + 1) : undefined;
    const key = version ? `${id}@${version}` : id;
    return { id, version, key };
  }
  if (value && typeof value === 'object') {
    const id = value.id?.trim();
    const version = value.version?.trim();
    if (!id) throw new Error('Partial entries must include an id.');
    const key = version ? `${id}@${version}` : id;
    return { id, version, key };
  }
  throw new Error(`Invalid partial entry: ${value}`);
}

function resolvePartialPath(entry) {
  const suffix = entry.version ? `@${entry.version}` : '';
  const normalized = entry.id.replace(/\.json$/i, '');
  return path.join(PARTIALS_DIR, `${normalized}${suffix}.json`);
}

async function loadPartial(entry) {
  const filePath = resolvePartialPath(entry);
  if (!(await fs.pathExists(filePath))) {
    throw new Error(`Unknown partial "${entry.key}" (expected ${filePath})`);
  }
  return readJsonSafe(filePath);
}

async function loadManifest(demoId) {
  const normalized = demoId.startsWith('demo-') ? demoId : `demo-${demoId}`;
  const manifestPath = path.join(DEMOS_DIR, normalized, 'store.json');
  if (!(await fs.pathExists(manifestPath))) {
    throw new Error(`Unknown demo store "${demoId}" (missing ${manifestPath})`);
  }
  const manifest = await readJsonSafe(manifestPath);
  manifest.id = manifest.id || demoId;
  manifest.slug = manifest.slug || demoId;
  manifest.partials = manifest.partials || [];
  return manifest;
}

export async function listStoreDemos() {
  const entries = await fs
    .readdir(DEMOS_DIR, { withFileTypes: true })
    .catch(() => []);
  const demos = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const manifestPath = path.join(DEMOS_DIR, entry.name, 'store.json');
    if (!(await fs.pathExists(manifestPath))) continue;
    const manifest = await readJsonSafe(manifestPath);
    demos.push({
      id: manifest.id || entry.name.replace(/^demo-/, ''),
      name: manifest.name || entry.name,
      meta: manifest.meta || {},
      partials: manifest.partials || [],
    });
  }
  return demos;
}

export async function listStorePartials() {
  const results = [];

  async function walk(currentDir) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
        continue;
      }
      if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
      const relativePath = path
        .relative(PARTIALS_DIR, fullPath)
        .replace(/\\/g, '/');
      const withoutExt = relativePath.replace(/\.json$/i, '');
      let normalized;
      try {
        normalized = normalizePartial(withoutExt);
      } catch {
        continue;
      }
      const pathSegments = withoutExt.split('/');
      const category = pathSegments.length > 1 ? pathSegments.slice(0, -1).join('/') : null;
      let label = pathSegments[pathSegments.length - 1];
      try {
        const payload = await readJsonSafe(fullPath);
        label = payload?.meta?.name || payload?.name || payload?.title || label;
      } catch {
        // ignore read errors for label enrichment
      }
      results.push({
        id: normalized.id,
        version: normalized.version || null,
        key: normalized.key,
        label,
        category,
        path: withoutExt,
      });
    }
  }

  await walk(PARTIALS_DIR);
  return results.sort((a, b) => a.key.localeCompare(b.key));
}

export async function composeStore(demoId = 'electronics', options = {}) {
  const { overrides = {}, includeOnly, writeCache = true } = options;
  const manifest = await loadManifest(demoId);
  const partialEntries = (manifest.partials || []).map((entry) => normalizePartial(entry));

  let includeSet = null;
  if (Array.isArray(includeOnly) && includeOnly.length) {
    includeSet = new Set();
    includeOnly.forEach((value) => {
      const parsed = normalizePartial(value);
      includeSet.add(parsed.key);
      includeSet.add(parsed.id);
    });
  }

  const filtered = includeSet
    ? partialEntries.filter((entry) => includeSet.has(entry.key) || includeSet.has(entry.id))
    : partialEntries;

  if (!filtered.length) {
    throw new Error(`Demo "${demoId}" does not reference any partials.`);
  }

  let composedData = {};
  for (const partialEntry of filtered) {
    const partialData = await loadPartial(partialEntry);
    composedData = deepMerge(composedData, partialData);
  }
  composedData = deepMerge(composedData, overrides);

  const composed = {
    id: manifest.id || demoId,
    name: manifest.name || demoId,
    meta: manifest.meta || {},
    partials: filtered.map((entry) => entry.key),
    generatedAt: new Date().toISOString(),
    data: composedData,
  };

  if (writeCache) {
    await fs.ensureDir(CACHE_DIR);
    const outFile = path.join(CACHE_DIR, `store-${manifest.id || demoId}.json`);
    await fs.writeJson(outFile, composed, { spaces: 2 });
  }

  return composed;
}

async function runFromCli() {
  const [, , demoArg = 'electronics', includeArg] = process.argv;
  const includeOnly = includeArg ? includeArg.split(',').map((id) => id.trim()).filter(Boolean) : undefined;
  try {
    const result = await composeStore(demoArg, { includeOnly });
    console.log(`✅ Store composed for demo "${demoArg}". Partials: ${result.partials.join(', ')}`);
    console.log(JSON.stringify(result.data, null, 2));
  } catch (error) {
    console.error(`❌ ${error.message}`);
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runFromCli();
}
