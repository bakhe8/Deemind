import fs from 'fs-extra';
import path from 'path';
import { glob } from 'glob';

export async function validateTheme(outputPath) {
  const layoutDir = path.join(outputPath, 'layout');
  const pagesDir = path.join(outputPath, 'pages');
  const reportPath = path.join(outputPath, 'report.json');

  const issues = [];
  const exists = async (p) => (await fs.pathExists(p));

  if (!(await exists(layoutDir))) issues.push({ type: 'missing-dir', dir: 'layout' });
  if (!(await exists(pagesDir))) issues.push({ type: 'missing-dir', dir: 'pages' });

  let pageCount = 0;
  if (await exists(pagesDir)) {
    const files = await glob('**/*.twig', { cwd: pagesDir, nodir: true });
    pageCount = files.length;
    if (pageCount === 0) issues.push({ type: 'no-pages' });
  }

  const report = {
    status: issues.length ? 'warn' : 'ok',
    issues,
    stats: { pages: pageCount }
  };
  await fs.writeJson(reportPath, report, { spaces: 2 });
  return report;
}

// no-op helper retained for potential future expansion
