// @reuse-from: fs-extra, glob
// @description: Scans JS files to prevent duplicate function declarations.
import fs from 'fs-extra';
import { globSync } from 'glob';

const files = globSync(
  '{service/routes/brands.ts,service/lib/**/*.ts,dashboard/src/views/BrandWizard.tsx,dashboard/src/lib/api-brand.ts,tools/brand-*.js,tools/check-duplicates.js}',
  { ignore: ['node_modules/**', 'dist/**', 'output/**'], nodir: true },
).filter((file) => /\.(ts|tsx|js)$/.test(file));
const seen = new Map();
const dupes = [];

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const regex = /function\s+([A-Za-z0-9_]+)/g;
  let match;
  while ((match = regex.exec(content))) {
    const fn = match[1];
    if (seen.has(fn) && !file.includes('test') && !file.includes('types')) {
      dupes.push({ fn, prev: seen.get(fn), now: file });
    } else {
      seen.set(fn, file);
    }
  }
}

if (dupes.length) {
  console.error('❌ Duplicate function definitions found:');
  dupes.forEach((d) => console.error(` - ${d.fn}: ${d.prev} ↔ ${d.now}`));
  process.exit(1);
}

console.log('✅ No duplicate functions detected');
