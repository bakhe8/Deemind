#!/usr/bin/env node
import fs from 'fs-extra';
import path from 'path';

async function main() {
  let pixelmatch, sharp;
  try { pixelmatch = (await import('pixelmatch')).default; } catch {}
  try { sharp = (await import('sharp')).default || (await import('sharp')); } catch {}
  if (!pixelmatch || !sharp) { console.log('pixelmatch/sharp not installed; skipping visual regression.'); return; }
  const baseDir = process.argv[2] || path.join('reports','visual','mockups');
  const outDir = process.argv[3] || path.join('reports','visual','diffs');
  await fs.ensureDir(outDir);
  const pairs = [];
  // naive: diff images with same filename in sibling dirs baseA vs baseB provided as args
  const a = path.resolve(baseDir);
  const b = path.resolve(process.argv[4] || path.join('reports','visual','output'));
  if (!(await fs.pathExists(a)) || !(await fs.pathExists(b))) { console.log('Missing baseline or target dir.'); return; }
  const listA = (await fs.readdir(a)).filter(f=>/\.png$/.test(f));
  for (const f of listA) if (await fs.pathExists(path.join(b,f))) pairs.push([path.join(a,f), path.join(b,f)]);
  let diffs = 0;
  for (const [pa,pb] of pairs) {
    const imgA = sharp(pa); const imgB = sharp(pb);
    const { width, height } = await imgA.metadata();
    const bufA = await imgA.ensureAlpha().raw().toBuffer();
    const bufB = await imgB.ensureAlpha().raw().toBuffer();
    const out = Buffer.alloc(bufA.length);
    const mismatch = pixelmatch(bufA, bufB, out, width, height, { threshold: 0.1 });
    if (mismatch > 0) {
      const outPath = path.join(outDir, path.basename(pa).replace(/\.png$/, '.diff.png'));
      await sharp(out, { raw: { width, height, channels: 4 }}).png().toFile(outPath);
      diffs++;
    }
  }
  await fs.writeJson(path.join(outDir, 'summary.json'), { pairs: pairs.length, diffs }, { spaces: 2 });
  console.log('Visual regression summary:', { pairs: pairs.length, diffs });
}

main().catch(e => { console.error(e); process.exit(1); });

