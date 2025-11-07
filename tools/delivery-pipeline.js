// Placeholder zip/archival to archives/ (install 'archiver' later for real zips)
import fs from 'fs-extra';
import path from 'path';

export async function archiveTheme(outputPath) {
  const archives = path.join(process.cwd(), 'archives');
  await fs.ensureDir(archives);
  const theme = path.basename(outputPath);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = path.join(archives, `${theme}-${stamp}.zip`);
  // Not creating a real zip in MVP; write a note instead
  await fs.writeFile(dest + '.NOTE', `Zip skipped in MVP. Archive ${outputPath} manually.`);
  return dest + '.NOTE';
}

