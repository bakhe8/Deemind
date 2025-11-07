import fs from 'fs-extra';
import path from 'path';
import { glob } from 'glob';
import * as cheerio from 'cheerio';
import { detectConflicts } from './conflict-detector.js';

export async function parseFolder(inputPath) {
  const htmlFiles = await glob('**/*.html', { cwd: inputPath, dot: false, nodir: true });
  const pages = [];
  for (const rel of htmlFiles) {
    const abs = path.join(inputPath, rel);
    const html = await fs.readFile(abs, 'utf8');
    // Load via cheerio for structural sanity (no heavy parsing here yet)
    const $ = cheerio.load(html, { decodeEntities: false });
    // Normalize newlines & trim BOM
    const normalized = $.html().replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
    pages.push({ rel, html: normalized });
  }

  const conflicts = detectConflicts(pages);
  return { inputPath, pages, conflicts };
}
