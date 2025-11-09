#!/usr/bin/env tsx
import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { extractBrandPreset } from '../core/brand/brand-extractor.js';
import { saveBrandPreset } from '../core/brand/presets.js';

async function main() {
  const target = process.argv[2];
  if (!target) {
    console.error(chalk.red('Usage: npm run brand:extract <path-to-html>'));
    process.exit(1);
  }

  const htmlPath = path.isAbsolute(target) ? target : path.join(process.cwd(), target);
  if (!(await fs.pathExists(htmlPath))) {
    console.error(chalk.red(`File not found: ${htmlPath}`));
    process.exit(1);
  }

  const preset = await extractBrandPreset(htmlPath);
  await saveBrandPreset(preset);
  console.log(chalk.green(`🎨 Extracted brand preset: ${preset.slug}`));
}

main().catch((error) => {
  console.error(chalk.red(error instanceof Error ? error.message : String(error)));
  process.exit(1);
});
