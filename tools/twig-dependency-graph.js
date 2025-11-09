#!/usr/bin/env node
/**
 * @domain DeemindTools
 * Purpose: Build Twig include/extends dependency graph for ordering + diagnostics.
 */
import fs from 'fs-extra';
import path from 'path';
import { glob } from 'glob';

const INCLUDE_RE = /{%\s*(include|extends|embed)\s+['"]([^'"]+)['"]/g;

function normalizeTwigPath(rel) {
  if (!rel) return '';
  const cleaned = rel.replace(/\\/g, '/');
  return cleaned.endsWith('.twig') ? cleaned : `${cleaned}.twig`;
}

export async function buildTwigDependencyGraph(themeDir) {
  const files = await glob('**/*.twig', { cwd: themeDir, nodir: true });
  const graph = {};
  for (const rel of files) {
    const abs = path.join(themeDir, rel);
    let content = '';
    try {
      content = await fs.readFile(abs, 'utf8');
    } catch (err) {
      void err;
      continue;
    }
    const deps = new Set();
    let match;
    while ((match = INCLUDE_RE.exec(content))) {
      deps.add(normalizeTwigPath(match[2]));
    }
    graph[normalizeTwigPath(rel)] = Array.from(deps);
  }
  const topo = topologicalSort(graph);
  const cycles = detectCycles(graph);
  return { graph, topo, cycles, fileCount: Object.keys(graph).length };
}

export async function writeTwigDependencyReport(themeName, result) {
  const reportsDir = path.join(process.cwd(), 'reports');
  await fs.ensureDir(reportsDir);
  const jsonPath = path.join(reportsDir, `twig-dependency-${themeName}.json`);
  await fs.writeJson(jsonPath, result, { spaces: 2 });
  const mdPath = path.join(reportsDir, `twig-dependency-${themeName}.md`);
  const lines = [
    `# Twig Dependency Graph — ${themeName}`,
    '',
    `Files scanned: ${result.fileCount}`,
    `Edges: ${Object.values(result.graph).reduce((acc, arr) => acc + arr.length, 0)}`,
    '',
  ];
  if (result.cycles.length) {
    lines.push('## Cycles detected');
    result.cycles.forEach((cycle, idx) => {
      lines.push(`${idx + 1}. ${cycle.join(' → ')}`);
    });
  } else {
    lines.push('## Cycles detected');
    lines.push('- None');
  }
  lines.push('');
  lines.push('## Topological order (first 25)');
  lines.push('- ' + result.topo.slice(0, 25).join('\n- '));
  await fs.writeFile(mdPath, lines.join('\n'), 'utf8');
  return { jsonPath, mdPath };
}

function detectCycles(graph) {
  const visiting = new Set();
  const visited = new Set();
  const stack = [];
  const cycles = [];
  function dfs(node) {
    if (visiting.has(node)) {
      const idx = stack.indexOf(node);
      if (idx >= 0) {
        cycles.push([...stack.slice(idx), node]);
      } else {
        cycles.push([node]);
      }
      return;
    }
    if (visited.has(node)) return;
    visiting.add(node);
    stack.push(node);
    for (const dep of graph[node] || []) {
      dfs(dep);
    }
    stack.pop();
    visiting.delete(node);
    visited.add(node);
  }
  Object.keys(graph).forEach(dfs);
  return cycles;
}

function topologicalSort(graph) {
  const inDegree = new Map();
  const nodes = new Set(Object.keys(graph));
  for (const deps of Object.values(graph)) {
    deps.forEach((dep) => nodes.add(dep));
  }
  nodes.forEach((node) => inDegree.set(node, 0));
  for (const deps of Object.values(graph)) {
    for (const dep of deps) {
      inDegree.set(dep, (inDegree.get(dep) || 0) + 1);
    }
  }
  const queue = [];
  for (const [node, deg] of inDegree.entries()) {
    if (deg === 0) queue.push(node);
  }
  const order = [];
  while (queue.length) {
    const node = queue.shift();
    order.push(node);
    for (const dep of graph[node] || []) {
      inDegree.set(dep, (inDegree.get(dep) || 0) - 1);
      if (inDegree.get(dep) === 0) queue.push(dep);
    }
  }
  return order;
}
