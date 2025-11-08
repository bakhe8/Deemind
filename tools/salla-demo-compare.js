#!/usr/bin/env node
import fs from 'fs-extra';
import path from 'path';

function mapTheme(root) {
  const layout = listFiles(path.join(root,'layout'), '.twig');
  const pages = listFiles(path.join(root,'pages'), '.twig');
  const partials = listFiles(path.join(root,'partials'), '.twig');
  const assets = listFiles(path.join(root,'assets'));
  const themeJson = fs.pathExistsSync(path.join(root,'theme.json')) ? fs.readJsonSync(path.join(root,'theme.json')) : {};
  return { layout, pages, partials, assets, themeJson };
}

function listFiles(dir, ext) {
  const out = [];
  const walk = d => {
    if (!fs.existsSync(d)) return;
    for (const n of fs.readdirSync(d)) {
      const p = path.join(d, n);
      const st = fs.statSync(p);
      if (st.isDirectory()) walk(p); else if (!ext || p.endsWith(ext)) out.push(path.relative(dir, p).replace(/\\/g,'/'));
    }
  };
  walk(dir);
  return out.sort();
}

function diffArrays(a,b) {
  const A = new Set(a), B = new Set(b);
  return {
    onlyInA: a.filter(x=>!B.has(x)),
    onlyInB: b.filter(x=>!A.has(x))
  };
}

async function main() {
  const [baselineName='raed', themeName='demo'] = process.argv.slice(2);
  const baselineRoot = path.resolve('.baselines', `theme-${baselineName}`);
  const outputRoot = path.resolve('output', themeName);
  const reportsDir = path.resolve('reports');
  await fs.ensureDir(reportsDir);

  const baseExists = await fs.pathExists(baselineRoot);
  const baseMap = baseExists ? mapTheme(baselineRoot) : { layout:[], pages:[], partials:[], assets:[], themeJson:{} };
  const outMap = mapTheme(outputRoot);

  const mapOut = {
    baseline: { name: baselineName, counts: { layout: baseMap.layout.length, pages: baseMap.pages.length, partials: baseMap.partials.length, assets: baseMap.assets.length } },
    output: { name: themeName, counts: { layout: outMap.layout.length, pages: outMap.pages.length, partials: outMap.partials.length, assets: outMap.assets.length } }
  };
  await fs.writeJson(path.join(reportsDir,`salla-demo-map.${baselineName}.json`), mapOut, { spaces: 2 });

  const lines = [];
  lines.push(`# Salla Demo Diff — ${baselineName}`);
  if (!baseExists) {
    lines.push('Baseline not found; skipping diff.');
    await fs.writeFile(path.join(reportsDir,`salla-demo-diff.${baselineName}.md`), lines.join('\n'));
    return;
  }
  const d1 = diffArrays(baseMap.pages, outMap.pages);
  const d2 = diffArrays(baseMap.partials, outMap.partials);
  lines.push('## Pages');
  lines.push(`- Only in baseline: ${d1.onlyInA.join(', ')||'none'}`);
  lines.push(`- Only in output: ${d1.onlyInB.join(', ')||'none'}`);
  lines.push('## Partials');
  lines.push(`- Only in baseline: ${d2.onlyInA.join(', ')||'none'}`);
  lines.push(`- Only in output: ${d2.onlyInB.join(', ')||'none'}`);
  await fs.writeFile(path.join(reportsDir,`salla-demo-diff.${baselineName}.md`), lines.join('\n'));
}

main().catch(e => { console.error(e); process.exit(1); });
