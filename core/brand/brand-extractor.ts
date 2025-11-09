import fs from 'fs-extra';
import path from 'path';
import { extractCSSVariables } from './css-extractor.js';
import { detectFonts } from './font-detector.js';
import type { BrandPreset } from './types.js';

function deriveName(htmlPath: string, html: string) {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) return titleMatch[1].trim();
  const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  if (h1Match) return h1Match[1].trim();
  return path.parse(htmlPath).name;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'brand';
}

export async function extractBrandPreset(htmlPath: string) {
  const html = await fs.readFile(htmlPath, 'utf8');
  const colors = await extractCSSVariables(htmlPath, html);
  const fonts = await detectFonts(htmlPath, html);
  const name = deriveName(htmlPath, html);
  const preset: BrandPreset = {
    slug: slugify(name),
    name,
    colors,
    fonts,
    source: {
      html: path.relative(process.cwd(), htmlPath),
      extractedAt: new Date().toISOString(),
    },
  };
  return preset;
}
