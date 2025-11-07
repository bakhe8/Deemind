import fs from 'fs-extra';
import path from 'path';
import { globSync } from 'glob';

export function loadBaselineSet() {
  const set = new Set();
  const baseDir = path.resolve('baseline', 'raed', 'partials');
  if (fs.existsSync(baseDir)) {
    for (const f of globSync('**/*.twig', { cwd: baseDir, nodir: true })) {
      set.add(normalizeKey('partials/' + f));
    }
  }
  const cfg = path.resolve('configs', 'standard-components.json');
  if (fs.existsSync(cfg)) {
    try {
      const arr = JSON.parse(fs.readFileSync(cfg, 'utf8')) || [];
      for (const k of arr) set.add(normalizeKey(k));
    } catch (err) { void err; }
  }
  return set;
}

export function computeComponentUsage(themePath, baselineSet) {
  const pagesDir = path.join(themePath, 'pages');
  const includes = globSync('**/*.twig', { cwd: pagesDir, nodir: true })
    .map(f => path.join(pagesDir, f));
  const usage = new Map();
  for (const file of includes) {
    const content = fs.readFileSync(file, 'utf8');
    for (const m of content.matchAll(/{%\s*include\s*['"](partials\/[^'"]+)['"]\s*%}/g)) {
      const key = normalizeKey(m[1]);
      if (!usage.has(key)) usage.set(key, { count: 0, pages: new Set(), type: baselineSet.has(key) ? 'standard' : 'custom' });
      const u = usage.get(key);
      u.count++;
      u.pages.add(path.relative(themePath, file).replace(/\\/g,'/'));
    }
  }
  const out = [];
  for (const [k, v] of usage.entries()) out.push({ component: k, count: v.count, usedOn: Array.from(v.pages), type: v.type });
  return out;
}

function normalizeKey(s) { return s.toLowerCase().replace(/\\/g,'/'); }
