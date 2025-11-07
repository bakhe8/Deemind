import fs from 'fs-extra';
import path from 'path';
import archiver from 'archiver';

/**
 * Zip a built theme into archives/ with a timestamped name.
 * Why: Provides deterministic packaging and a breadcrumb (last-success.txt)
 * for quick retrieval and handoff.
 */
export async function archiveTheme(outputPath) {
  const archives = path.join(process.cwd(), 'archives');
  await fs.ensureDir(archives);
  const theme = path.basename(outputPath);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = path.join(archives, `${theme}-${stamp}.zip`);
  await zipFolder(outputPath, dest, [ 'logs', '.factory-cache' ]);
  await fs.writeFile(path.join(archives, 'last-success.txt'), dest, 'utf8');
  return dest;
}

async function zipFolder(srcDir, zipPath, excludeDirs = []) {
  const output = fs.createWriteStream(zipPath);
  const archive = archiver('zip', { zlib: { level: 9 } });
  const excludes = new Set(excludeDirs.map(d => path.resolve(srcDir, d)));
  await new Promise((resolve, reject) => {
    output.on('close', resolve);
    archive.on('error', reject);
    archive.pipe(output);
    archive.glob('**/*', {
      cwd: srcDir,
      dot: false,
      ignore: Array.from(excludes).map(p => path.relative(srcDir, p) + '/**')
    });
    archive.finalize();
  });
}
