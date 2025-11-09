#!/usr/bin/env node
import fs from 'fs-extra';
import path from 'path';
import { globSync } from 'glob';
import { createHash } from 'crypto';

function detectCycle(graph) {
  const visiting = new Set();
  const visited = new Set();

  function dfs(node) {
    if (visiting.has(node)) return true;
    if (visited.has(node)) return false;
    visiting.add(node);
    const neighbors = graph[node] || [];
    for (const next of neighbors) {
      if (dfs(next)) return true;
    }
    visiting.delete(node);
    visited.add(node);
    return false;
  }

  return Object.keys(graph).some((node) => dfs(node));
}

async function hashFiles(files) {
  const hashes = {};
  for (const file of files) {
    const buf = await fs.readFile(file);
    const hash = createHash('sha256').update(buf).digest('hex');
    hashes[path.basename(file)] = hash;
  }
  return hashes;
}

async function validateBaseline(root) {
  const requiredDirs = [
    'src/views/layouts',
    'src/views/pages',
    'src/views/components',
    'src/locales',
    'src/assets',
    'public',
  ];
  const missing = requiredDirs.filter((dir) => !fs.existsSync(path.join(root, dir)));
  const twigFiles = globSync('src/**/*.twig', { cwd: root, nodir: true }).map((rel) => path.join(root, rel));
  const graph = {};
  const extendsRx = /{%\s*extends\s+['"]([^'"]+)['"]\s*%}/g;
  for (const file of twigFiles) {
    const content = await fs.readFile(file, 'utf8');
    const matches = Array.from(content.matchAll(extendsRx)).map((m) => m[1]);
    graph[file] = matches.map((tpl) => path.join(root, tpl.replace(/^\.\//, '')));
  }
  const hasCycle = detectCycle(graph);
  const cssFiles = globSync('src/**/*.css', { cwd: root, nodir: true }).map((rel) => path.join(root, rel));
  const jsFiles = globSync('src/**/*.js', { cwd: root, nodir: true }).map((rel) => path.join(root, rel));
  const hashes = {
    twig: await hashFiles(twigFiles),
    css: await hashFiles(cssFiles),
    js: await hashFiles(jsFiles),
  };
  return { missing, hasCycle, hashes };
}

async function main() {
  const baseDir = path.resolve('.baselines');
  if (!(await fs.pathExists(baseDir))) {
    console.error('No .baselines directory found.');
    process.exit(1);
  }
  const entries = await fs.readdir(baseDir, { withFileTypes: true });
  let failed = false;
  const report = {};
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const baselineRoot = path.join(baseDir, entry.name);
    const result = await validateBaseline(baselineRoot);
    report[entry.name] = result;
    if (result.missing.length) {
      failed = true;
      console.error(`Baseline ${entry.name} missing directories: ${result.missing.join(', ')}`);
    }
    if (result.hasCycle) {
      failed = true;
      console.error(`Baseline ${entry.name} has circular extends/includes.`);
    }
  }
  const reportPath = path.join('reports', 'baseline-integrity.json');
  await fs.ensureDir(path.dirname(reportPath));
  await fs.writeJson(reportPath, report, { spaces: 2 });
  if (failed) process.exit(1);
  console.log('✅ Baseline validation passed.');
}

main();
