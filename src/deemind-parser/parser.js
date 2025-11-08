/**
 * @domain DeemindCore
 * Purpose: Base HTML folder parser to normalized page/component structure.
 */
import fs from 'fs-extra';
import path from 'path';
import { glob } from 'glob';
import pLimit from 'p-limit';
import * as cheerio from 'cheerio';

function withTimeout(promise, ms, onTimeout) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      if (onTimeout) {
        try { onTimeout(); } catch (err) { void err; }
      }
      reject(new Error(`Parse timed out after ${ms}ms`));
    }, ms);
    promise.then(v => { clearTimeout(t); resolve(v); }).catch(err => { clearTimeout(t); reject(err); });
  });
}

/**
 * Parse an input folder of HTML files into normalized page objects.
 * Why: We standardize encoding/line endings up front and enforce a
 * timeout and maxBytes quarantine so a single bad file cannot crash
 * the pipeline; quarantined files are copied to _failed/ for review.
 */
export async function parseFolder(inputPath) {
  const htmlFiles = await glob('**/*.html', { cwd: inputPath, dot: false, nodir: true });
  const pages = [];
  const failed = [];
  // Load settings (optional)
  let maxBytes = 0;
  try {
    const s = await fs.readJson(path.resolve('configs', 'settings.json'));
    maxBytes = s.maxInputFileBytes || 0;
  } catch (err) { void err; }

  const limit = pLimit(8);
  await Promise.all(htmlFiles.map(rel => limit(async () => {
    const abs = path.join(inputPath, rel);
    try {
      const stat = await fs.stat(abs);
      if (maxBytes && stat.size > maxBytes) {
        failed.push(rel);
        return;
      }
      const html = await withTimeout(fs.readFile(abs, 'utf8'), 5000);
      const $ = cheerio.load(html, { decodeEntities: false });
      const normalized = $.html().replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
      pages.push({ rel, html: normalized });
    } catch (e) {
      const quarantine = path.join(inputPath, '_failed', rel);
      await fs.ensureDir(path.dirname(quarantine));
      await fs.copy(abs, quarantine).catch(() => {});
      failed.push(rel);
    }
  })));
  return { inputPath, pages, failed };
}
/**
 * @domain DeemindCore
 * Purpose: Base HTML folder parser to normalized page/component structure.
 */
