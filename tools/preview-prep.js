import fs from 'fs-extra';
import path from 'path';
import { globSync } from 'glob';

export async function preparePreview(themeName, options = {}) {
  const outputRoot = options.outputPath || path.resolve('output');
  const basePort = options.port || 3000;
  const themeDir = path.resolve(outputRoot, themeName);
  const pagesDir = path.join(themeDir, 'pages');
  const previewPath = path.join(themeDir, '.preview.json');

  const previewInfo = {
    theme: themeName,
    pages: [],
    port: basePort,
    url: `http://localhost:${basePort}/`,
    status: 'missing-pages',
    timestamp: new Date().toISOString(),
  };

  if (await fs.pathExists(pagesDir)) {
    const htmlPages = globSync('**/*.html', { cwd: pagesDir, nodir: true }).map((p) =>
      p.replace(/\\/g, '/').replace(/\.html$/, ''),
    );
    const twigPages = globSync('**/*.twig', { cwd: pagesDir, nodir: true }).map((p) =>
      p.replace(/\\/g, '/').replace(/\.twig$/, ''),
    );
    const pages = Array.from(new Set([...htmlPages, ...twigPages]));
    previewInfo.pages = pages;
    previewInfo.status = pages.length ? 'ready' : 'missing-pages';
  }

  await fs.ensureDir(path.dirname(previewPath));
  await fs.writeJson(previewPath, previewInfo, { spaces: 2 });
  return previewInfo;
}
