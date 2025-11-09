#!/usr/bin/env ts-node
/**
 * Synchronise Salla public definitions (schema/filters/partials) into core/salla/.
 * Falls back to bundled minimal samples whenever remote sources are unreachable.
 */
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

type ResourceId = "schema" | "filters" | "partials";

interface ResourceConfig {
  id: ResourceId;
  filename: string;
  env: string;
  defaultUrl?: string;
}

interface MetaEntry {
  id: ResourceId;
  target: string;
  url?: string;
  source: "remote" | "fallback";
  hash: string;
  syncedAt: string;
  error?: string;
}

const ROOT = process.cwd();
const SALLA_DIR = path.join(ROOT, "core", "salla");

const RESOURCES: ResourceConfig[] = [
  {
    id: "schema",
    filename: "schema.json",
    env: "SALLA_SCHEMA_URL",
    defaultUrl: "https://docs.salla.dev/api/schema.json",
  },
  {
    id: "filters",
    filename: "filters.json",
    env: "SALLA_FILTERS_URL",
    defaultUrl: "https://docs.salla.dev/api/filters.json",
  },
  {
    id: "partials",
    filename: "partials.json",
    env: "SALLA_PARTIALS_URL",
    defaultUrl: "https://docs.salla.dev/api/partials.json",
  },
];

const FALLBACKS: Record<ResourceId, unknown> = {
  schema: {
    version: "fallback-1.0",
    description: "Minimal Salla schema fallback used when remote sync is unavailable.",
    theme: {
      required: ["name", "slug"],
      properties: {
        name: { type: "string" },
        slug: { type: "string" },
        description: { type: "string" },
      },
    },
  },
  filters: {
    filters: [
      {
        name: "money_format",
        description: "Formats a number into the active store currency.",
        signature: "money_format(value, currencyCode = 'SAR')",
      },
      {
        name: "t",
        description: "Translation helper.",
        signature: "t(key)",
      },
      {
        name: "escape",
        description: "Escapes HTML output.",
        signature: "escape(value)",
      },
    ],
  },
  partials: {
    webComponents: [
      "salla-product-card",
      "salla-product-grid",
      "salla-quick-order",
      "salla-cart-widget",
      "salla-login-modal",
      "salla-offer-modal",
    ],
    layouts: {
      "layout.master": {
        description: "Base layout reference.",
        slots: ["head", "content", "scripts"],
      },
      "layout.customer": {
        description: "Customer area layout.",
        slots: ["head", "content", "scripts"],
      },
    },
  },
};

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

async function fetchResource(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }
  return await response.text();
}

async function writeJson(target: string, contents: string) {
  await fs.writeFile(target, `${contents.trim()}\n`, "utf8");
}

function hashContents(contents: string) {
  return crypto.createHash("sha256").update(contents).digest("hex");
}

async function syncResource(config: ResourceConfig): Promise<MetaEntry> {
  const resolvedUrl = process.env[config.env] || config.defaultUrl;
  const target = path.join(SALLA_DIR, config.filename);
  let contents: string;
  let source: MetaEntry["source"] = "remote";
  let error: string | undefined;

  if (!resolvedUrl) {
    source = "fallback";
    contents = JSON.stringify(FALLBACKS[config.id], null, 2);
  } else {
    try {
      contents = await fetchResource(resolvedUrl);
      JSON.parse(contents);
    } catch (err) {
      source = "fallback";
      error = err instanceof Error ? err.message : String(err);
      contents = JSON.stringify(FALLBACKS[config.id], null, 2);
    }
  }

  const hash = hashContents(contents);
  await writeJson(target, contents);

  return {
    id: config.id,
    target: path.relative(ROOT, target),
    url: resolvedUrl,
    source,
    hash,
    syncedAt: new Date().toISOString(),
    error,
  };
}

async function main() {
  await ensureDir(SALLA_DIR);
  const meta: { syncedAt: string; resources: MetaEntry[] } = {
    syncedAt: new Date().toISOString(),
    resources: [],
  };

  for (const resource of RESOURCES) {
    const entry = await syncResource(resource);
    meta.resources.push(entry);
    const status =
      entry.source === "remote"
        ? `fetched ${resource.id}`
        : `fallback for ${resource.id}`;
    console.log(`• ${status} (sha256=${entry.hash.slice(0, 8)})`);
    if (entry.error) {
      console.warn(`  ↳ reason: ${entry.error}`);
    }
  }

  const metaPath = path.join(SALLA_DIR, "meta.json");
  await writeJson(metaPath, JSON.stringify(meta, null, 2));
  console.log(`✅ Salla definitions synced (${meta.resources.length} files).`);
}

main().catch((error) => {
  console.error("Salla sync failed:", error);
  process.exitCode = 1;
});
