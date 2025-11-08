#!/usr/bin/env node
import fs from 'fs-extra';
import path from 'path';
import { execSync } from 'child_process';

function tryCmd(cmd) {
  try {
    const out = execSync(cmd, { encoding: 'utf8', stdio: ['ignore','pipe','pipe'] });
    return { ok: true, out };
  } catch (e) {
    return { ok: false, out: e?.stdout?.toString?.() || '', err: e?.stderr?.toString?.() || String(e) };
  }
}

async function main() {
  const reportsDir = path.join(process.cwd(), 'reports');
  await fs.ensureDir(reportsDir);

  const ver = tryCmd('npx salla --version');
  const help = tryCmd('npx salla --help');

  const versionLog = {
    detected: ver.ok,
    version: ver.ok ? (ver.out.trim()) : null,
    helpSnippet: help.ok ? help.out.split('\n').slice(0, 10).join('\n') : null
  };
  await fs.writeJson(path.join(reportsDir, 'salla-version-log.json'), versionLog, { spaces: 2 });

  // Attempt validation command; tolerate failures on older CLI
  const theme = process.argv[2] || 'demo';
  const outDir = path.join(process.cwd(), 'output', theme);
  const validate = tryCmd(`npx salla theme:validate --path "${outDir}"`);
  const zip = tryCmd(`npx salla theme:zip --path "${outDir}"`);

  const lines = [];
  lines.push('# Salla Validate Summary');
  lines.push(`CLI detected: ${versionLog.detected}`);
  lines.push(`CLI version: ${versionLog.version || 'unknown'}`);
  lines.push(`theme: ${theme}`);
  lines.push(`validate ok: ${validate.ok}`);
  if (!validate.ok) lines.push(`validate err: ${(validate.err||'').split('\n')[0]}`);
  lines.push(`zip ok: ${zip.ok}`);
  if (!zip.ok) lines.push(`zip err: ${(zip.err||'').split('\n')[0]}`);
  await fs.writeFile(path.join(reportsDir, 'salla-validate-summary.md'), lines.join('\n'));
}

main().catch(e => { console.error(e); process.exit(1); });

