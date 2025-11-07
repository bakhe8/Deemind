import fs from 'fs-extra';
import path from 'path';

export async function adaptToSalla(parsed, outputPath) {
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
  await fs.writeFile(path.join(layoutDir, 'default.twig'), defaultLayout, 'utf8');

  // Convert each HTML page to a Twig page extending the default layout
  for (const p of parsed.pages) {
    const relTwig = p.rel.replace(/\\/g, '/').replace(/\.html$/i, '.twig');
    const outFile = path.join(pagesDir, relTwig);
    await fs.ensureDir(path.dirname(outFile));
    const content = `{% extends "layout/default.twig" %}\n{% block content %}\n${p.html}\n{% endblock %}\n`;
    await fs.writeFile(outFile, content, 'utf8');
  }

  // Copy assets from input if present
  const assetsSrc = path.join(parsed.inputPath, 'assets');
  if (await fs.pathExists(assetsSrc)) {
    await fs.copy(assetsSrc, assetsDir, { overwrite: true });
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
}
