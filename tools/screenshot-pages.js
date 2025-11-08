#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';

const themes = process.argv.length > 2 ? process.argv.slice(2) : ['demo','gimni','modern','salla-new-theme','animal'];
const baseOutput = path.resolve('reports', 'visual');

async function capture(theme) {
  const outDir = path.join(baseOutput, theme);
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  const previewPath = path.resolve(`output/${theme}/index.html`);
  if (!fs.existsSync(previewPath)) {
    console.warn(`⚠️  Skip ${theme}: preview file not found (${previewPath})`);
    await browser.close();
    return;
  }
  try {
    await page.goto('file://' + previewPath, { waitUntil: 'networkidle0' });
    await page.screenshot({ path: path.join(outDir, 'latest.png'), fullPage: true });
    console.log(`📸 Captured ${theme}`);
  } catch (err) {
    console.error(`Screenshot failed for ${theme}:`, err?.message || err);
  } finally {
    await browser.close();
  }
}

(async () => {
  for (const theme of themes) {
    await capture(theme);
  }
})(); 
