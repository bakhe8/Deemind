import fs from 'fs-extra';
import path from 'path';

function ensureInside(base, target) {
  const b = path.resolve(base) + path.sep;
  const t = path.resolve(target);
  if (!t.startsWith(b)) throw new Error(`Refusing to write outside output: ${t}`);
}

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
    graph.nodes.push(`pages/${relTwig}`);
    graph.edges.push({ from: `pages/${relTwig}`, to: 'layout/default.twig', type: 'extends' });
  }
  const cacheDir = path.join(process.cwd(), '.factory-cache');
  await fs.ensureDir(cacheDir);
  await fs.writeJson(path.join(cacheDir, 'graph.json'), graph, { spaces: 2 });

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
    const targetRel = path.join('normalized', ref.url.replace(/^\.+\//, ''));
    const dest = path.join(assetsDir, targetRel);
    try {
      const stat = await fs.stat(absSrc);
      if (stat.isFile()) {
        await fs.ensureDir(path.dirname(dest));
        ensureInside(outputPath, dest);
        await fs.copy(absSrc, dest, { overwrite: true });
        const re = new RegExp(`${ref.attr}=["']${escapeRegExp(ref.url)}["']`, 'g');
        out = out.replace(re, `${ref.attr}="assets/${targetRel.replace(/\\/g,'/')}"`);
      }
    } catch (err) { void err; }
  }
  return out;
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
