#!/usr/bin/env node
import fs from 'fs-extra';
import path from 'path';
import { imageSize } from 'image-size';

export async function validateSallaAssets(theme) {
  const root = path.join(process.cwd(), 'output', theme);
  const themeJsonPath = path.join(root, 'theme.json');
  const assetsDir = path.join(root, 'assets');
  const report = { errors: [], warnings: [], checks: {} };
  if (!(await fs.pathExists(themeJsonPath))) {
    report.errors.push({ type: 'theme-json-missing', file: 'theme.json' });
    return report;
  }
  const t = await fs.readJson(themeJsonPath).catch(() => ({}));
  // icon
  const iconRel = (t.icon || 'assets/icon.png').replace(/^\/+/, '');
  const iconAbs = path.join(root, iconRel);
  report.checks.icon = await fs.pathExists(iconAbs);
  if (!report.checks.icon) {
    report.warnings.push({ type: 'icon-missing', expected: iconRel });
  }
  // suggested icon sizes
  const suggestedSizes = [64, 128, 256];
  const iconDir = path.join(assetsDir, 'icons');
  for (const sz of suggestedSizes) {
    const cand = path.join(iconDir, `${sz}.png`);
    if (await fs.pathExists(cand)) {
      try {
        const dim = imageSize(cand);
        if (!(dim && dim.width === sz && dim.height === sz)) {
          report.warnings.push({ type: 'icon-size-mismatch', file: `assets/icons/${sz}.png`, actual: `${dim?.width}x${dim?.height}`, expected: `${sz}x${sz}` });
        }
      } catch (e) {
        report.warnings.push({ type: 'icon-unreadable', file: `assets/icons/${sz}.png`, error: String(e.message||e) });
      }
    } else {
      report.warnings.push({ type: 'icon-size-missing', size: `${sz}.png`, dir: 'assets/icons' });
    }
  }
  // fonts present
  const fonts = Array.isArray(t.fonts) ? t.fonts : [];
  const fontsDir = path.join(assetsDir, 'fonts');
  if (fonts.length) {
    const hasFontsDir = await fs.pathExists(fontsDir);
    report.checks.fontsDir = hasFontsDir;
    if (!hasFontsDir) {
      report.warnings.push({ type: 'fonts-dir-missing', dir: 'assets/fonts' });
    }
    if (hasFontsDir) {
      const entries = (await fs.readdir(fontsDir).catch(()=>[])).map(n=>n.toLowerCase());
      for (const f of fonts) {
        const name = String(f).toLowerCase();
        const ok = entries.some(e => e.includes(name) && (e.endsWith('.woff') || e.endsWith('.woff2')));
        if (!ok) report.warnings.push({ type: 'font-files-missing', font: f, dir: 'assets/fonts' });
      }
    }
  }
  // categories present
  if (!Array.isArray(t.categories) || !t.categories.length) {
    report.warnings.push({ type: 'categories-missing' });
  }
  // write report
  const repDir = path.join(root, 'reports');
  await fs.ensureDir(repDir);
  await fs.writeJson(path.join(repDir, 'salla-assets.json'), report, { spaces: 2 });
  return report;
}

async function main() {
  const theme = process.argv[2] || 'demo';
  const rep = await validateSallaAssets(theme);
  const hasErrors = (rep.errors||[]).length > 0;
  console.log(`Salla assets check for ${theme}: errors=${(rep.errors||[]).length}, warnings=${(rep.warnings||[]).length}`);
  if (hasErrors) process.exit(1);
}

if (import.meta.url === new URL('file://' + process.argv[1]).href) {
  main().catch(e => { console.error(e); process.exit(1); });
}
