/**
 * @domain DeemindCore
 * Purpose: Serialize parser output into the canonical ThemeContract shape.
 */
import fs from 'fs-extra';
import path from 'path';

const DEFAULT_VALIDATED = () => ({ status: 'pending', warnings: [], errors: [] });
const DEFAULT_ADAPTED = () => ({ twig: [], metadata: {} });

function normalizeSections(layoutMap = [], unchanged = new Set()) {
  return layoutMap.map((entry) => ({
    page: entry.page,
    componentCount: Array.isArray(entry.components) ? entry.components.length : 0,
    sharedComponents: Array.isArray(entry.components)
      ? entry.components.filter((c) => c.shared).map((c) => c.id)
      : [],
    unchanged: unchanged instanceof Set ? unchanged.has(entry.page) : false,
  }));
}

function normalizeComponents(layoutMap = []) {
  const rows = [];
  for (const entry of layoutMap) {
    if (!Array.isArray(entry.components)) continue;
    for (const comp of entry.components) {
      rows.push({
        id: comp.id,
        selector: comp.selector,
        signature: comp.signature,
        page: entry.page,
        shared: Boolean(comp.shared),
        order: typeof comp.order === 'number' ? comp.order : undefined,
        classes: comp.classes || '',
      });
    }
  }
  return rows;
}

function collectAssetReferences(pages = []) {
  const assets = new Set();
  for (const page of pages) {
    const html = page.html || '';
    const linkRe = /<link[^>]+href=["']([^"']+)["']/gi;
    const scriptRe = /<script[^>]+src=["']([^"']+)["']/gi;
    const imgRe = /<img[^>]+src=["']([^"']+)["']/gi;
    let match;
    while ((match = linkRe.exec(html))) assets.add(match[1]);
    while ((match = scriptRe.exec(html))) assets.add(match[1]);
    while ((match = imgRe.exec(html))) assets.add(match[1]);
  }
  return Array.from(assets);
}

function collectTemplateHints(hints = []) {
  return hints.map((hint) => ({
    page: hint.rel || hint.page || '',
    hints: Array.isArray(hint.hints) ? hint.hints : [],
  }));
}

export function buildCanonicalModel(themeName, parsedResult) {
  const layoutMap = parsedResult.layoutMap || [];
  const sections = normalizeSections(layoutMap, parsedResult.unchanged || new Set());
  const components = normalizeComponents(layoutMap);
  const assets = collectAssetReferences(parsedResult.pages);
  const canonical = {
    input: {
      folder: themeName,
      assets,
    },
    parsed: {
      sections,
      components,
      conflicts: parsedResult.conflicts || [],
      assets,
      cssMapSample: parsedResult.cssMap || {},
      templateHints: collectTemplateHints(parsedResult.templateHints || []),
      confidence: typeof parsedResult.confidence === 'number' ? parsedResult.confidence : null,
    },
    adapted: DEFAULT_ADAPTED(),
    validated: DEFAULT_VALIDATED(),
  };
  return canonical;
}

export async function persistCanonicalModel(themeName, parsedResult) {
  const canonical = buildCanonicalModel(themeName, parsedResult);
  const canonicalDir = path.join(process.cwd(), 'canonical', themeName);
  await fs.ensureDir(canonicalDir);
  const filePath = path.join(canonicalDir, 'theme.json');
  await fs.writeJson(filePath, canonical, { spaces: 2 });
  return { canonical, filePath };
}

function createEmptyCanonical(themeName) {
  return {
    input: { folder: themeName, assets: [] },
    parsed: { sections: [], components: [], conflicts: [], assets: [] },
    adapted: DEFAULT_ADAPTED(),
    validated: DEFAULT_VALIDATED(),
  };
}

export async function updateCanonicalModel(themeName, mutator) {
  const canonicalDir = path.join(process.cwd(), 'canonical', themeName);
  await fs.ensureDir(canonicalDir);
  const filePath = path.join(canonicalDir, 'theme.json');
  let current = createEmptyCanonical(themeName);
  if (await fs.pathExists(filePath)) {
    try {
      current = await fs.readJson(filePath);
    } catch (err) {
      void err;
    }
  }
  const next = await mutator({ ...current });
  await fs.writeJson(filePath, next, { spaces: 2 });
  return { canonical: next, filePath };
}
