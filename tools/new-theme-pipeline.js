#!/usr/bin/env node
import fs from 'fs-extra';
import path from 'path';
import { execSync } from 'child_process';

const ROOT = process.cwd();
const INPUT = path.join(ROOT, 'input');
const OUTPUT = path.join(ROOT, 'output');
const SNAP_CFG = path.join(ROOT, 'tests', 'snapshots', 'snapshot.config.json');

function run(cmd) { execSync(cmd, { stdio: 'inherit' }); }

function getThemesFromInput() {
  if (!fs.existsSync(INPUT)) return [];
  return fs.readdirSync(INPUT).filter(d => fs.statSync(path.join(INPUT, d)).isDirectory());
}

function readSnapshotConfig() {
  if (!fs.existsSync(SNAP_CFG)) return { cases: [], compare: { includeExtensions: ['.twig','.html','.json','.css','.js'], ignorePaths: ["**/.DS_Store","**/*.map","**/theme.json","theme.json"], ignoreJsonKeys: ["timestamp","buildDate","commit","checksum","environment","elapsedSec"], normalizeWhitespace: true } };
  return fs.readJsonSync(SNAP_CFG);
}

function writeSnapshotConfig(cfg) { fs.writeJsonSync(SNAP_CFG, cfg, { spaces: 2 }); }

function ensureCase(cfg, theme) {
  const exists = (cfg.cases || []).some(c => c.name === theme);
  if (exists) return cfg;
  cfg.cases = cfg.cases || [];
  cfg.cases.push({ name: theme, input: `input/fixtures/${theme}`, expected: `output/snapshots_expected/${theme}`, buildCommand: `npm run deemind:build ${theme}` });
  return cfg;
}

async function copyExpected(theme) {
  const src = path.join(OUTPUT, theme);
  const dst = path.join(OUTPUT, 'snapshots_expected', theme);
  await fs.ensureDir(path.dirname(dst));
  await fs.remove(dst);
  await fs.copy(src, dst, { overwrite: true });
}

function sallaValidate(theme) {
  try { run(`node tools/salla-cli.js validate ${theme}`); } catch { /* optional */ }
  try { run(`node tools/salla-cli.js zip ${theme}`); } catch { /* optional */ }
}

async function buildTheme(theme) {
  run(`node cli.js ${theme} --sanitize --i18n --autofix`);
}

async function processTheme(theme) {
  console.log(`\n🧩 New theme pipeline: ${theme}`);
  await buildTheme(theme);
  // Attempt to reduce i18n warnings to zero by wrapping visible text in output pages
  try { run(`node tools/fix-i18n-output.js ${theme}`); } catch {}
  try { run(`npm run -s deemind:validate`); } catch {}
  await copyExpected(theme);
  sallaValidate(theme);
  let cfg = readSnapshotConfig();
  cfg = ensureCase(cfg, theme);
  writeSnapshotConfig(cfg);
  console.log(`✅ New theme '${theme}' snapshot captured and Salla validation attempted.`);
}

async function main() {
  const args = process.argv.slice(2);
  let themes = args.filter(a => !a.startsWith('--'));
  const detect = args.includes('--detect');
  if (detect || themes.length === 0) {
    const cfg = readSnapshotConfig();
    const known = new Set((cfg.cases||[]).map(c=>c.name));
    themes = getThemesFromInput().filter(t => !known.has(t));
  }
  if (!themes.length) { console.log('No new themes detected.'); return; }
  for (const t of themes) await processTheme(t);
}

main().catch(e => { console.error(e); process.exit(1); });
