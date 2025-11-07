import fs from 'fs-extra';
import path from 'path';
import { globSync } from 'glob';

export async function prunePartials(themePath, { force = false, dryRun = false, archive = true } = {}) {
  const pagesDir = path.join(themePath, 'pages');
  const partialsDir = path.join(themePath, 'partials');
  if (!(await fs.pathExists(partialsDir))) return { removed: [], kept: [] };

  const pageFiles = globSync('**/*.twig', { cwd: pagesDir, nodir: true }).map(f => path.join(pagesDir, f));
  const used = new Set();
  for (const f of pageFiles) {
    const content = await fs.readFile(f, 'utf8');
    for (const m of content.matchAll(/{%\s*include\s*['"]partials\/([^'"]+)['"]\s*%}/g)) {
      used.add(m[1]);
    }
  }

  const partialFiles = globSync('**/*.twig', { cwd: partialsDir, nodir: true });
  const removed = [], kept = [];
  const archiveDir = path.join(themePath, '.orphaned_partials');
  if (archive && !dryRun) await fs.ensureDir(archiveDir);

  for (const rel of partialFiles) {
    if (!used.has(rel.replace(/\\/g,'/'))) {
      const abs = path.join(partialsDir, rel);
      removed.push(rel);
      if (dryRun) continue;
      if (archive && !force) {
        const dest = path.join(archiveDir, rel);
        await fs.ensureDir(path.dirname(dest));
        await fs.move(abs, dest, { overwrite: true });
      } else {
        await fs.remove(abs);
      }
    } else {
      kept.push(rel);
    }
  }
  return { removed, kept };
}

// CLI
if (process.argv[1] && process.argv[1].endsWith('partials-prune.js')) {
  const theme = process.argv[2] || 'demo';
  const force = process.argv.includes('--force');
  const dryRun = process.argv.includes('--dry-run');
  const archive = !process.argv.includes('--no-archive');
  const themePath = path.join(process.cwd(), 'output', theme);
  prunePartials(themePath, { force, dryRun, archive }).then(res => {
    console.log(`Pruned partials in ${themePath}`);
    console.log(`Removed: ${res.removed.length}`);
    if (res.removed.length) console.log(' - ' + res.removed.join('\n - '));
  }).catch(e => { console.error(e); process.exit(1); });
}

