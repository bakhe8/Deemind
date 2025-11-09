import fs from 'fs-extra';
import path from 'path';
import type { BrandPreset } from './types.js';
import { readBrandPreset } from './presets.js';
import { PRESET_METADATA_FILENAME } from './constants.js';

type ApplyOptions = {
  rootDir: string;
  presetDir?: string;
};

function ensureThemeMetadata(themeDir: string, preset: BrandPreset) {
  return (async () => {
    if (!(await fs.pathExists(themeDir))) {
      return;
    }
    const filePath = path.join(themeDir, PRESET_METADATA_FILENAME);
    let existing: Record<string, any> = {};
    if (await fs.pathExists(filePath)) {
      existing = (await fs.readJson(filePath).catch(() => ({}))) || {};
    }
    const next = {
      ...existing,
      brand: {
        slug: preset.slug,
        name: preset.name,
        colors: preset.colors,
        fonts: preset.fonts,
        updatedAt: new Date().toISOString(),
      },
      updatedAt: new Date().toISOString(),
    };
    await fs.ensureDir(path.dirname(filePath));
    await fs.writeJson(filePath, next, { spaces: 2 });
  })();
}

export async function applyBrandPreset(theme: string, slug: string, options: ApplyOptions) {
  const rootDir = options.rootDir;
  const presetDir = options.presetDir;
  const preset = await readBrandPreset(slug, presetDir);
  const inputDir = path.join(rootDir, 'input', theme);
  const outputDir = path.join(rootDir, 'output', theme);
  await Promise.all([ensureThemeMetadata(inputDir, preset), ensureThemeMetadata(outputDir, preset)]);
  return preset;
}
