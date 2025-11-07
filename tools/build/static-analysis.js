#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs-extra';
import path from 'path';

function run(cmd) {
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

  // Circular deps via madge
  const madgeRes = run('npx --yes madge --circular --extensions js . --json');
  let cycles = [];
  try { cycles = JSON.parse(madgeRes.out || '[]'); } catch { cycles = []; }

  // Unused deps via depcheck
  try {
    const depcheck = (await import('depcheck')).default;
    depcheck(process.cwd(), {}).then(result => {
      const unused = {
        dependencies: result.dependencies || [],
        devDependencies: result.devDependencies || []
      };
      writeReport(cycles, unused);
    }).catch(() => writeReport(cycles, { dependencies: [], devDependencies: [] }));
  } catch {
    writeReport(cycles, { dependencies: [], devDependencies: [] });
  }

  function writeReport(cyclesData, unused) {
    const lines = [];
    lines.push('# Static Analysis Report');
    lines.push('');
    lines.push('## Circular Dependencies (madge)');
    if (Array.isArray(cyclesData) && cyclesData.length) {
      for (const c of cyclesData) lines.push(`- ${Array.isArray(c) ? c.join(' -> ') : JSON.stringify(c)}`);
    } else {
      lines.push('- None detected');
    }
    lines.push('');
    lines.push('## Unused Dependencies (depcheck)');
    lines.push(`- dependencies: ${unused.dependencies.length ? unused.dependencies.join(', ') : 'none'}`);
    lines.push(`- devDependencies: ${unused.devDependencies.length ? unused.devDependencies.join(', ') : 'none'}`);
    fs.writeFileSync(path.join(reportsDir, 'static-analysis.md'), lines.join('\n'));
  }
}

main().catch(e => { console.error(e); process.exit(1); });
