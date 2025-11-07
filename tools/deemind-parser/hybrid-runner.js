import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';
import { parseFolder } from './parser.js';
import { detectConflicts } from './conflict-detector.js';
import { extractCssMap } from './css-parser.js';
import { extractInlineJs } from './js-extractor.js';

function md5(text) {
  return crypto.createHash('md5').update(text, 'utf8').digest('hex');
}

/**
 * Run the hybrid parser pipeline (scan → template hints → conflicts → maps).
 * Why: This staging trades a small amount of complexity for resilience.
 * - Stage 1 gives a fast, deterministic baseline.
 * - Stage 2 adds pattern confidence without hard dependencies on a platform.
 * - Stage 3 surfaces conflicts early so we fail predictably rather than silently.
 * We also persist per‑file checksums to short‑circuit unchanged inputs on rebuild.
 */
export async function runHybridParser(inputPath, { logDir = path.join(process.cwd(), 'logs') } = {}) {
  await fs.ensureDir(logDir);

  // Load previous run for change detection
  const lastRunFile = path.join(logDir, 'last-run.json');
  let prev = null;
  if (await fs.pathExists(lastRunFile)) {
    try { prev = await fs.readJson(lastRunFile); } catch (e) { prev = null; }
  }

  // Stage 1: quick structural scan (reuse parseFolder)
  const stage1 = await parseFolder(inputPath);

  // Stage 2: template-based analysis (stub: detect simple keywords)
  const templateHints = stage1.pages.map(p => ({
    rel: p.rel,
    hints: [
      /product/i.test(p.html) ? 'product' : null,
      /hero/i.test(p.html) ? 'hero' : null,
      /footer/i.test(p.html) ? 'footer' : null,
      /header/i.test(p.html) ? 'header' : null,
    ].filter(Boolean),
  }));

  // Stage 3: conflict detection (existing logic)
  const conflicts = detectConflicts(stage1.pages);

  // CSS and JS extraction maps
  const cssMap = await extractCssMap(inputPath, stage1.pages);
  const jsMap = extractInlineJs(stage1.pages);

  // Checksums + confidence
  const checksums = {};
  for (const p of stage1.pages) {
    checksums[p.rel] = md5(p.html);
  }
  const total = stage1.pages.length || 1;
  const confidentFiles = templateHints.filter(h => h.hints.length > 0).length;
  const confidence = Number((confidentFiles / total).toFixed(2));

  // Persist run logs
  const lastRun = {
    timestamp: new Date().toISOString(),
    files: stage1.pages.map(p => ({ rel: p.rel, checksum: checksums[p.rel] })),
    confidence,
    conflicts,
    templateHints,
    cssMapSample: Object.keys(cssMap).slice(0,1).reduce((acc,k)=>{acc[k]=cssMap[k];return acc;},{}),
    jsInlineCounts: Object.fromEntries(Object.entries(jsMap).map(([k,v])=>[k,v.length])),
    failed: stage1.failed,
  };
  await fs.writeJson(lastRunFile, lastRun, { spaces: 2 });

  // Conflict summary markdown
  const lines = [
    '# Deemind Conflict Summary',
    `Date: ${new Date().toISOString()}`,
    `Confidence: ${confidence}`,
    '',
    conflicts.length ? '## Conflicts' : '## No Conflicts',
  ];
  for (const c of conflicts) {
    if (c.type === 'duplicate-basename') {
      lines.push(`- Duplicate basename: ${c.files.join(' vs ')}`);
    } else if (c.type === 'empty-file') {
      lines.push(`- Empty file: ${c.file}`);
    } else {
      lines.push(`- ${c.type}`);
    }
  }
  await fs.writeFile(path.join(logDir, 'conflict-summary.md'), lines.join('\n'), 'utf8');

  // Build a simple layout map (sections by order)
  // Why: downstream stages (adapter, reports) rely on a stable component list
  // even if the HTML is messy; using signature + order is a practical compromise.
  const layoutMap = stage1.pages.map(p => ({
    page: p.rel,
    order: 0,
    components: collectComponents(p.html).map((c, idx) => ({ ...c, id: stableId(p.rel, idx), order: idx }))
  }));

  const reuseCount = new Map();
  for (const lm of layoutMap) for (const c of lm.components) reuseCount.set(c.signature, (reuseCount.get(c.signature)||0)+1);
  for (const lm of layoutMap) for (const c of lm.components) c.shared = reuseCount.get(c.signature) >= 2;

  const unchanged = new Set();
  if (prev && Array.isArray(prev.files)) {
    const mapPrev = new Map(prev.files.map(f => [f.rel, f.checksum]));
    for (const rel of Object.keys(checksums)) {
      if (mapPrev.get(rel) === checksums[rel]) unchanged.add(rel);
    }
  }

  // Persist layout map for transparency
  await fs.writeJson(path.join(logDir, 'layout-map.json'), layoutMap, { spaces: 2 });

  return { inputPath, pages: stage1.pages, conflicts, confidence, templateHints, cssMap, jsMap, layoutMap, unchanged, failed: stage1.failed };
}

/**
 * Extracts section components with a stable signature.
 * Why: Using a class‑set signature lets us approximate reuse across pages
 * without requiring strict HTML equality (robust to attribute ordering).
 */
function collectComponents(html) {
  const out = [];
  const sectionRe = /<section([^>]*)>([\\s\\S]*?)<\/section>/gi;
  let m;
  while ((m = sectionRe.exec(html))) {
    const attrs = m[1] || '';
    const classes = (attrs.match(/class="([^"]*)"/)||[])[1] || '';
    const signature = classes.split(/\s+/).filter(Boolean).sort().join('.');
    const full = m[0];
    out.push({ selector: 'section', classes, signature, html: full });
  }
  return out;
}

/**
 * Stable short id per page component.
 * Why: IDs persist across rebuilds for the same rel+index, useful in
 * per‑page reports and for mapping any manual annotations.
 */
function stableId(rel, idx) {
  return crypto.createHash('md5').update(`${rel}:${idx}`).digest('hex').slice(0,8);
}



