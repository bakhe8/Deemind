import fs from 'fs-extra';
import path from 'path';
import { BRAND_PRESET_DIR } from './constants.js';
import type { BrandPreset } from './types.js';

export function getPresetPath(slug: string, dir = BRAND_PRESET_DIR) {
  return path.join(dir, `${slug}.json`);
}

export async function saveBrandPreset(preset: BrandPreset, dir = BRAND_PRESET_DIR) {
  await fs.ensureDir(dir);
  const filePath = getPresetPath(preset.slug, dir);
  await fs.writeJson(filePath, preset, { spaces: 2 });
  return filePath;
}

export async function readBrandPreset(slug: string, dir = BRAND_PRESET_DIR) {
  const filePath = getPresetPath(slug, dir);
  if (!(await fs.pathExists(filePath))) {
    throw new Error(`Brand preset "${slug}" not found.`);
  }
  return fs.readJson(filePath) as Promise<BrandPreset>;
}

export async function listBrandPresets(dir = BRAND_PRESET_DIR) {
  if (!(await fs.pathExists(dir))) {
    return [] as BrandPreset[];
  }
  const entries = await fs.readdir(dir);
  const presets: BrandPreset[] = [];
  for (const file of entries) {
    if (!file.endsWith('.json')) continue;
    const full = path.join(dir, file);
    try {
      const preset = (await fs.readJson(full)) as BrandPreset;
      if (!preset.slug) {
        preset.slug = path.parse(file).name;
      }
      presets.push(preset);
    } catch (error) {
      void error;
    }
  }
  return presets;
}
