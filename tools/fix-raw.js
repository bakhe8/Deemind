import fs from 'fs-extra';
import { globSync } from 'glob';

const DEFAULT_TARGETS = [
  'canonical/**/*.twig',
  'src/**/*.twig',
  'preview-static/**/*.twig'
];

async function sanitizeRawFilters(globPattern) {
  const files = globSync(globPattern, { nodir: true, dot: false });
  let touched = 0;
  for (const file of files) {
    const original = await fs.readFile(file, 'utf8');
    const updated = original.replace(/\|\s*raw\b/g, "| e('html')");
    if (updated !== original) {
      await fs.writeFile(file, updated);
      touched += 1;
    }
  }
  return touched;
}

async function run() {
  const targets = process.argv.slice(2);
  const globs = targets.length ? targets : DEFAULT_TARGETS;
  let total = 0;
  for (const pattern of globs) {
    total += await sanitizeRawFilters(pattern);
  }
  console.log(`✅ Sanitized raw filters in ${total} file(s) across ${globs.length} glob(s).`);
}

run().catch((err) => {
  console.error('fix-raw failed:', err);
  process.exitCode = 1;
});
