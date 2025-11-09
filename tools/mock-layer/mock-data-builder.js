#!/usr/bin/env node
/**
 * Aggregates core mock datasets and demo compositions into a single context JSON.
 */
import fs from "fs-extra";
import path from "path";
import { pathToFileURL } from "url";
import { composeStore } from "../store-compose.js";

const ROOT = process.cwd();
const CACHE_DIR = path.join(ROOT, "mockups", "store", "cache", "context");
const CORE_MOCK_DIR = path.join(ROOT, "core", "mock");

const CORE_FILES = ["store.json", "products.json", "categories.json", "cart.json", "user.json"];

async function readCoreMocks() {
  const data = {};
  for (const file of CORE_FILES) {
    const abs = path.join(CORE_MOCK_DIR, file);
    if (!(await fs.pathExists(abs))) continue;
    const payload = await fs.readJson(abs);
    data[path.basename(file, ".json")] = payload;
  }
  return data;
}

export async function buildMockContext(demo = "electronics") {
  const coreMocks = await readCoreMocks();
  let composed;
  try {
    composed = await composeStore(demo, { writeCache: false });
  } catch (error) {
    if (demo !== "electronics") {
      composed = await composeStore("electronics", { writeCache: false });
    } else {
      throw error;
    }
  }
  return {
    store: coreMocks.store || composed.data.store || {},
    products: coreMocks.products?.products || composed.data.products || [],
    categories: coreMocks.categories?.categories || [],
    cart: coreMocks.cart?.cart || composed.data.cart || { items: [], total: 0 },
    user: coreMocks.user?.user || null,
    locales: composed.data.locales || {},
    hero: composed.data.hero || {},
    navigation: composed.data.navigation || {},
    wishlist: composed.data.wishlist || { items: [] },
    inventory: composed.data.inventory || [],
    brands: composed.data.brands || [],
    blog: composed.data.blog || [],
    orders: composed.data.orders || [],
    data: composed.data,
    meta: {
      demo,
      generatedAt: new Date().toISOString(),
    },
  };
}

export async function writeMockContext(theme, context) {
  await fs.ensureDir(CACHE_DIR);
  const file = path.join(CACHE_DIR, `${theme}.json`);
  await fs.writeJson(file, context, { spaces: 2 });
  return file;
}

async function main() {
  const theme = process.argv[2] || "demo";
  const demo = process.argv[3] || theme || "electronics";
  const context = await buildMockContext(demo);
  const outFile = await writeMockContext(theme, context);
  console.log(`✅ Mock data built for ${theme} (demo preset: ${demo}) → ${path.relative(ROOT, outFile)}`);
}

const invokedDirectly =
  process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;

if (invokedDirectly) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
