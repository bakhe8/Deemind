import fs from 'fs-extra';
import path from 'path';

async function main() {
  const telemetryPath = path.join('logs', 'telemetry.json');
  let telemetry = null;
  try { telemetry = await fs.readJson(telemetryPath); } catch {}
  const out = [];
  out.push('# Deemind — Weekly Status');
  out.push(`Generated: ${new Date().toISOString()}`);
  out.push('');
  if (telemetry) {
    out.push('## Telemetry');
    out.push(`- Builds: ${telemetry.builds}`);
    out.push(`- Passes: ${telemetry.passes}`);
    out.push(`- Success rate: ${telemetry.builds ? Math.round((telemetry.passes/telemetry.builds)*100) : 0}%`);
    out.push(`- Avg build time: ${telemetry.avgBuildTimeSec || 0}s`);
    out.push('');
  }
  // Summarize current output warnings/errors
  const outRoot = path.join(process.cwd(), 'output');
  const lines = [];
  if (await fs.pathExists(outRoot)) {
    const themes = (await fs.readdir(outRoot, { withFileTypes: true })).filter(e => e.isDirectory()).map(e => e.name);
    for (const t of themes) {
      const rep = path.join(outRoot, t, 'report-extended.json');
      if (!(await fs.pathExists(rep))) continue;
      const r = await fs.readJson(rep);
      lines.push(`- ${t}: errors=${r.summary?.errors||0}, warnings=${r.summary?.warnings||0}`);
    }
  }
  if (lines.length) {
    out.push('## Current Output Summary');
    out.push(...lines);
  }
  await fs.ensureDir('docs');
  await fs.writeFile(path.join('docs', 'status.md'), out.join('\n'));
  console.log('Wrote docs/status.md');
}

main().catch(e => { console.error(e); process.exit(1); });

