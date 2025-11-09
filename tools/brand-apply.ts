#!/usr/bin/env tsx
import path from 'path';
import chalk from 'chalk';
import { applyBrandPreset } from '../core/brand/apply-brand.js';
import { BRAND_PRESET_DIR } from '../core/brand/constants.js';

async function main() {
  const theme = process.argv[2];
  const brand = process.argv[3];
  if (!theme || !brand) {
    console.error(chalk.red('Usage: npm run brand:apply <theme> <brand-slug>'));
    process.exit(1);
  }

  const rootDir = process.cwd();
  await applyBrandPreset(theme, brand, { rootDir, presetDir: BRAND_PRESET_DIR });
  console.log(chalk.green(`✅ Applied brand "${brand}" to theme "${theme}".`));
}

main().catch((error) => {
  console.error(chalk.red(error instanceof Error ? error.message : String(error)));
  process.exit(1);
});
