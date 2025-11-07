import fs from 'fs-extra';
import path from 'path';
import { execSync } from 'child_process';

function run(cmd, opts = {}) {
  return execSync(cmd, { stdio: 'inherit', ...opts });
}

async function readJsonSafe(p, fallback = null) {
  try { return await fs.readJson(p); } catch { return fallback; }
}

async function listThemes(root) {
  if (!(await fs.pathExists(root))) return [];
  const dirs = await fs.readdir(root, { withFileTypes: true });
  return dirs.filter(d => d.isDirectory()).map(d => d.name);
}

async function hasErrors(themeOutDir) {
  const rep = path.join(themeOutDir, 'report-extended.json');
  const r = await readJsonSafe(rep, { summary: { errors: 0 } });
  return (r?.summary?.errors || 0) > 0;
}

async function doctorTheme(theme) {
  const cwd = process.cwd();
  const inputPath = path.join(cwd, 'input', theme);
  const outputPath = path.join(cwd, 'output', theme);
  const before = await hasErrors(outputPath).catch(()=>false);

  try {
    // Attempt quick autofixers
    try {
      const { fixMissingAssets } = await import('./fix-missing-assets.js');
      await fixMissingAssets(theme);
    } catch {}

    try {
      const { normalizeCssAssets } = await import('./normalize-css-assets.js');
      await normalizeCssAssets({ outputPath, inputPath });
    } catch {}

    // Rebuild with autofix flags
    run(`node cli.js ${theme} --sanitize --i18n --autofix`);
  } catch (e) {
    // keep going to gather after-state
    // eslint-disable-next-line no-console
    console.error('Doctor rebuild failed:', e?.message || e);
  }

  const after = await hasErrors(outputPath).catch(()=>false);
  return { theme, before, after };
}

async function main() {
  const outRoot = path.join(process.cwd(), 'output');
  const themes = await listThemes(outRoot);
  const results = [];
  for (const t of themes) {
    const themeOut = path.join(outRoot, t);
    if (!(await hasErrors(themeOut))) continue; // skip healthy
    const res = await doctorTheme(t);
    results.push(res);
  }
  await fs.ensureDir('logs');
  await fs.writeJson(path.join('logs', 'doctor-report.json'), { ranAt: new Date().toISOString(), results }, { spaces: 2 });
  const remaining = results.filter(r => r.after).map(r => r.theme);
  if (remaining.length) {
    console.error('Doctor could not fully fix themes:', remaining.join(', '));
    process.exitCode = 1; // let CI surface remaining issues
  } else {
    console.log('Doctor finished.');
  }
}

main().catch(e => { console.error(e); process.exit(1); });

