#!/usr/bin/env node
/**
 * Scans Twig/HTML templates to infer the context object needed for mock previews.
 * Outputs JSON files under mockups/store/cache/context/<theme>.json.
 */
import fs from "fs-extra";
import path from "path";
import { glob } from "glob";
import { fileURLToPath, pathToFileURL } from "url";

const VARIABLE_RE = /\{\{\s*([a-zA-Z_][\w.\[\]]+)/g;

function mergeDeep(target, value) {
  if (Array.isArray(target) && Array.isArray(value)) {
    return target.concat(value);
  }
  if (isObject(target) && isObject(value)) {
    const next = { ...target };
    for (const [key, nested] of Object.entries(value)) {
      next[key] = key in next ? mergeDeep(next[key], nested) : nested;
    }
    return next;
  }
  return value;
}

function isObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function assignPath(root, pathStr) {
  const segments = pathStr.replace(/\[(\d+)\]/g, ".$1").split(".").filter(Boolean);
  let current = root;
  for (let i = 0; i < segments.length; i++) {
    const key = segments[i];
    const isLast = i === segments.length - 1;
    if (!(key in current)) {
      current[key] = isLast ? `{{ ${pathStr} }}` : {};
    }
    if (!isLast) {
      if (typeof current[key] !== "object") current[key] = {};
      current = current[key];
    }
  }
}

export async function buildContext(theme) {
  const outputDir = path.resolve("output", theme, "pages");
  const files = await glob("**/*.twig", { cwd: outputDir, nodir: true });
  const context = {};
  for (const file of files) {
    const abs = path.join(outputDir, file);
    const text = await fs.readFile(abs, "utf8");
    let match;
    while ((match = VARIABLE_RE.exec(text))) {
      assignPath(context, match[1]);
    }
  }
  return context;
}

export async function writeContext(theme, data) {
  const outDir = path.resolve("mockups", "store", "cache", "context");
  await fs.ensureDir(outDir);
  const file = path.join(outDir, `${theme}-structure.json`);
  await fs.writeJson(file, data, { spaces: 2 });
  return file;
}

async function main() {
  const theme = process.argv[2] || "demo";
  const context = await buildContext(theme);
  const outFile = await writeContext(theme, context);
  console.log(`✅ Mock context generated for ${theme}: ${path.relative(process.cwd(), outFile)}`);
}

const invokedDirectly =
  process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;

if (invokedDirectly) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
