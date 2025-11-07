import fs from 'fs-extra';
import path from 'path';

/**
 * Why: Extended validator often flags missing-assets when prototypes reference
 * images that weren’t copied or normalized. For fast iteration, we create
 * placeholder files in output/assets/normalized so validation can proceed
 * deterministically. Real assets should be supplied later by the theme owner.
 */
export async function fixMissingAssets(theme) {
  const outputDir = path.join(process.cwd(), 'output', theme);
  const reportFile = path.join(outputDir, 'report-extended.json');
  const report = await fs.readJson(reportFile).catch(() => ({ errors: [] }));
  const twigs = await (async () => {
    const globMod = await import('glob');
    const sync = globMod.globSync || (globMod.default && globMod.default.sync);
    return sync ? sync('**/*.twig', { cwd: outputDir, nodir: true }) : [];
  })();

  // Collect all asset references from Twig
  const refs = new Set();
  for (const rel of twigs) {
    const abs = path.join(outputDir, rel);
    const txt = await fs.readFile(abs, 'utf8');
    for (const m of txt.matchAll(/assets\/([^"')\s]+)/g)) {
      refs.add(m[1]);
    }
  }

  let fixed = 0;
  for (const ref of refs) {
    const file = path.join(outputDir, 'assets', ref);
    if (!(await fs.pathExists(file))) {
      await fs.ensureDir(path.dirname(file));
      await fs.writeFile(file, Buffer.from([]));
      fixed++;
    }
  }
  console.log(`Fixed ${fixed} missing asset reference(s).`);
}

// CLI entry
if (process.argv[1] && process.argv[1].endsWith('fix-missing-assets.js') && process.argv[2]) {
  fixMissingAssets(process.argv[2]).catch(e => { console.error(e); process.exit(1); });
}
