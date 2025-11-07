import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';

/**
 * Guard against writing outside the intended output root.
 * Why: Prevents accidental path traversal when rewriting asset paths
 * or creating partials based on input content.
 */
function ensureInside(base, target) {
  const b = path.resolve(base) + path.sep;
  const t = path.resolve(target);
  if (!t.startsWith(b)) throw new Error(`Refusing to write outside output: ${t}`);
}

/**
 * Convert normalized HTML pages to Salla Twig layout/pages/partials.
 * Why: Keeps the output opinionated but predictable:
 * - lockUnchanged skips rewrites for identical inputs to speed rebuilds.
 * - partialize promotes shared components to partials to reduce duplication.
 * Asset paths are normalized conservatively; CSS url(...) is left to a later pass.
 */
export async function adaptToSalla(parsed, outputPath, { lockUnchanged = false, partialize = false } = {}) {
  const layoutDir = path.join(outputPath, 'layout');
  const pagesDir = path.join(outputPath, 'pages');
  const partialsDir = path.join(outputPath, 'partials');
  const assetsDir = path.join(outputPath, 'assets');
  await Promise.all([
    fs.ensureDir(layoutDir),
    fs.ensureDir(pagesDir),
    fs.ensureDir(partialsDir),
    fs.ensureDir(assetsDir),
  ]);

  

  // Ensure a default layout shell
  const defaultLayout = `{# Deemind default layout #}\n<!DOCTYPE html>\n<html>\n<head>\n  <meta charset="utf-8"/>\n  <title>{% block title %}Salla Theme{% endblock %}</title>\n</head>\n<body>\n  {% block content %}{% endblock %}\n</body>\n</html>\n`;
  const defaultLayoutPath = path.join(layoutDir, 'default.twig');
  ensureInside(outputPath, defaultLayoutPath);
  await fs.writeFile(defaultLayoutPath, defaultLayout, 'utf8');

  // Prepare partialization plan if enabled
  const sharedSignatures = new Set();
  const signatureToHtml = new Map();
  if (partialize && Array.isArray(parsed.layoutMap)) {
    const counts = new Map();
    for (const lm of parsed.layoutMap) {
      for (const c of (lm.components || [])) {
        counts.set(c.signature, (counts.get(c.signature) || 0) + 1);
        if (!signatureToHtml.has(c.signature) && c.html) signatureToHtml.set(c.signature, c.html);
      }
    }
    for (const [sig, n] of counts.entries()) if (n >= 2) sharedSignatures.add(sig);
  }

  function partialNameFor(signature) {
    const base = signature && signature.length ? signature : `component-${Date.now()}`;
    return base.replace(/[^a-zA-Z0-9_.-]/g, '_') + '.twig';
  }

  // Convert each HTML page to a Twig page extending the default layout
  const written = [];
  const skipped = [];
  for (const p of parsed.pages) {
    if (lockUnchanged && parsed.unchanged && parsed.unchanged.has(p.rel)) {
      skipped.push(p.rel);
      continue; // Skip rewriting unchanged Twig page
    }
    const relTwig = p.rel.replace(/\\/g, '/').replace(/\.html$/i, '.twig');
    const outFile = path.join(pagesDir, relTwig);
    ensureInside(outputPath, outFile);
    await fs.ensureDir(path.dirname(outFile));
    // Asset URL normalization: rewrite relative src/href to assets/normalized and copy
    let pageHtml = await normalizeAssetsInHtml(p.html, parsed.inputPath, path.dirname(p.rel), assetsDir, outputPath);
    // Partialize shared components
    if (partialize && sharedSignatures.size) {
      for (const sig of sharedSignatures) {
        const frag = signatureToHtml.get(sig);
        if (frag && pageHtml.includes(frag)) {
          pageHtml = pageHtml.split(frag).join(`{% include "partials/${partialNameFor(sig)}" %}`);
        }
      }
    }
    const content = `{% extends "layout/default.twig" %}\n{% block content %}\n${pageHtml}\n{% endblock %}\n`;
    await fs.writeFile(outFile, content, 'utf8');
    written.push(relTwig);
  }

  // Copy assets from input if present
  const assetsSrc = path.join(parsed.inputPath, 'assets');
  if (await fs.pathExists(assetsSrc)) {
    let max = 0;
    try {
      const s = await fs.readJson(path.resolve('configs', 'settings.json'));
      max = s.maxAssetFileBytes || 0;
    } catch (err) { void err; }
    await fs.copy(assetsSrc, assetsDir, {
      overwrite: true,
      filter: async (src, dest) => {
        try {
          const lst = await fs.lstat(src);
          if (lst.isSymbolicLink()) return false;
          if (lst.isFile()) {
            if (max && lst.size > max) return false;
          }
          ensureInside(outputPath, dest);
          return true;
        } catch {
          return false;
        }
      }
    });
  }

  // Write extracted inline JS as assets and inject tags comment (non-executing here)
  if (parsed.jsMap) {
    const jsOutDir = path.join(assetsDir, 'js');
    await fs.ensureDir(jsOutDir);
    for (const [rel, list] of Object.entries(parsed.jsMap)) {
      let idx = 0;
      for (const item of list) {
        const file = path.join(jsOutDir, `${rel.replace(/[\\/]/g,'_')}-${idx++}.js`);
        ensureInside(outputPath, file);
        await fs.writeFile(file, `/* extracted */\n${item.code}`);
      }
    }
  }

  // Cache a simple dependency graph for incremental builds
  const graph = {
    nodes: [],
    edges: [],
  };
  for (const p of parsed.pages) {
    const relTwig = p.rel.replace(/\\/g, '/').replace(/\.html$/i, '.twig');
    const pageNode = `pages/${relTwig}`;
    graph.nodes.push(pageNode);
    graph.edges.push({ from: pageNode, to: 'layout/default.twig', type: 'extends' });
    // Add include edges if partialization inserted includes
    const includes = (await extractIncludesFromPage(outputPath, pageNode)).map(t => ({ from: pageNode, to: t, type: 'include' }));
    graph.edges.push(...includes);
  }
  // Compute a topological order (best-effort) for pages -> layout/partials
  const topoOrder = topologicalOrder(graph.nodes, graph.edges);
  const cacheDir = path.join(process.cwd(), '.factory-cache');
  await fs.ensureDir(cacheDir);
  await fs.writeJson(path.join(cacheDir, 'graph.json'), { ...graph, topoOrder }, { spaces: 2 });

  // Write partial files if any
  if (partialize && sharedSignatures.size) {
    for (const sig of sharedSignatures) {
      const html = signatureToHtml.get(sig) || '';
      const name = partialNameFor(sig);
      const file = path.join(partialsDir, name);
      ensureInside(outputPath, file);
      await fs.ensureDir(path.dirname(file));
      await fs.writeFile(file, html, 'utf8');
    }
  }

  return { written, skipped };
}

async function normalizeAssetsInHtml(html, inputRoot, pageDirRel, assetsDir, outputPath) {
  const assetRefs = [];
  const attrRe = /(src|href)=["']([^"']+)["']/gi;
  let m;
  while ((m = attrRe.exec(html))) {
    const url = m[2];
    if (/^https?:\/\//i.test(url) || url.startsWith('//') || url.startsWith('assets/')) continue;
    assetRefs.push({ attr: m[1], url });
  }
  let out = html;
  for (const ref of assetRefs) {
    const absSrc = path.resolve(inputRoot, pageDirRel, ref.url);
    const originalRel = ref.url.replace(/^\.+\//, '');
    const baseRel = path.join('normalized', originalRel).replace(/\\/g,'/');
    try {
      const stat = await fs.stat(absSrc);
      if (stat.isFile()) {
        const buf = await fs.readFile(absSrc);
        const hash = crypto.createHash('md5').update(buf).digest('hex').slice(0,8);
        const ext = path.extname(baseRel);
        const nameNoExt = baseRel.slice(0, -ext.length);
        const fingerRel = `${nameNoExt}.${hash}${ext}`;
        const dest = path.join(assetsDir, fingerRel);
        await fs.ensureDir(path.dirname(dest));
        ensureInside(outputPath, dest);
        await fs.writeFile(dest, buf);
        const re = new RegExp(`${ref.attr}=["']${escapeRegExp(ref.url)}["']`, 'g');
        out = out.replace(re, `${ref.attr}="assets/${fingerRel.replace(/\\/g,'/')}"`);
      }
    } catch (err) { void err; }
  }
  return out;
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function extractIncludesFromPage(outputRoot, pageNode) {
  try {
    const pagePath = path.join(outputRoot, pageNode);
    const text = await fs.readFile(pagePath, 'utf8');
    const matches = Array.from(text.matchAll(/\{%\s*include\s*["']([^"']+)["']\s*%\}/g));
    return matches.map(m => m[1]);
  } catch { return []; }
}

function topologicalOrder(nodes, edges) {
  const inDeg = new Map(nodes.map(n => [n, 0]));
  const adj = new Map(nodes.map(n => [n, []]));
  for (const e of edges) {
    if (!adj.has(e.from)) adj.set(e.from, []);
    if (!adj.has(e.to)) adj.set(e.to, []);
    adj.get(e.from).push(e.to);
    inDeg.set(e.to, (inDeg.get(e.to) || 0) + 1);
  }
  const q = [];
  for (const [n, d] of inDeg.entries()) if (d === 0) q.push(n);
  const order = [];
  while (q.length) {
    const n = q.shift();
    order.push(n);
    for (const v of adj.get(n) || []) {
      const d = (inDeg.get(v) || 0) - 1;
      inDeg.set(v, d);
      if (d === 0) q.push(v);
    }
  }
  return order;
}
