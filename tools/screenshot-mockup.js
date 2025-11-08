#!/usr/bin/env node
import fs from 'fs-extra';
import path from 'path';

async function main() {
  let puppeteer;
  try { puppeteer = (await import('puppeteer')).default; } catch { console.log('Puppeteer not installed; skipping mockup screenshots.'); return; }
  const theme = process.argv[2] || 'modern-blue';
  const root = path.join(process.cwd(), 'mockups', theme);
  const preview = path.join(root, 'preview.html');
  if (!(await fs.pathExists(preview))) { console.log('No mockup preview for theme', theme); return; }
  const outDir = path.join(process.cwd(), 'reports', 'visual', 'mockups', theme);
  await fs.ensureDir(outDir);
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  const url = 'file://' + preview;
  await page.goto(url);
  await page.screenshot({ path: path.join(outDir, 'preview.png') });
  await browser.close();
  console.log('Mockup screenshot saved to', outDir);
}

main().catch(e => { console.error(e); process.exit(1); });

