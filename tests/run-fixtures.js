// tests/run-fixtures.js
import fs from 'fs-extra';
import path from 'path';
import { validateExtended } from '../tools/validator-extended.js';

async function run() {
  const outputDir = path.join(process.cwd(), 'output');
  if (!(await fs.pathExists(outputDir))) {
    console.log('No output directory; nothing to validate.');
    return;
  }
  const entries = await fs.readdir(outputDir, { withFileTypes: true });
  const dirs = entries.filter(e => e.isDirectory()).map(e => e.name);
  for (const theme of dirs) {
    const themePath = path.join(outputDir, theme);
    console.log(`\n🧩 Running Extended Validation on: ${theme}`);
    await validateExtended(themePath);
  }
  console.log('\nDeemind fixtures validation completed.');
}

await run();
