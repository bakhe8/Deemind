import fs from 'fs-extra';

export type DefaultTemplate = Record<string, any>;

export const DEFAULT_JSON_TEMPLATES: Record<string, DefaultTemplate> = {
  'theme.json': {
    name: '',
    slug: '',
    description: '',
    author: '',
    version: '1.0.0',
    license: 'UNLICENSED',
  },
  'assets/config.json': {
    colors: {
      primary: '#000000',
      secondary: '#ffffff',
    },
    fonts: {
      base: 'Arial, sans-serif',
      heading: 'Arial, sans-serif',
    },
  },
  'locales/en.json': {
    strings: {
      common: {},
    },
  },
};

export async function ensureJsonFile(filePath: string, template: DefaultTemplate) {
  await fs.ensureDir(fs.dirname(filePath));
  await fs.writeJson(filePath, template, { spaces: 2 });
}

export async function mergeJsonWithTemplate(filePath: string, template: DefaultTemplate) {
  await fs.ensureDir(fs.dirname(filePath));
  const existing = (await fs.readJson(filePath).catch(() => ({}))) || {};
  const merged = deepMerge(template, existing);
  await fs.writeJson(filePath, merged, { spaces: 2 });
  return merged;
}

function deepMerge(base: DefaultTemplate, overrides: DefaultTemplate): DefaultTemplate {
  if (Array.isArray(base)) return [...overrides];
  const result: DefaultTemplate = { ...base };
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) continue;
    if (isPlainObject(value) && isPlainObject(base[key])) {
      result[key] = deepMerge(base[key], value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

function isPlainObject(value: any): value is DefaultTemplate {
  return value && typeof value === 'object' && !Array.isArray(value);
}
