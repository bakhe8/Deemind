import fs from 'fs-extra';
import path from 'path';

async function main() {
  const outDir = path.join(process.cwd(), 'output');
  if (!(await fs.pathExists(outDir))) return;
  const themes = (await fs.readdir(outDir, { withFileTypes: true }))
    .filter(e => e.isDirectory()).map(e => e.name);

  let telemetry = { builds: 0, passes: 0, totalBuildTimeSec: 0, avgBuildTimeSec: 0, last: {} };
  const telemetryPath = path.join('logs', 'telemetry.json');
  try { telemetry = await fs.readJson(telemetryPath); } catch (e) { /* initialize fresh */ }

  for (const theme of themes) {
    const themePath = path.join(outDir, theme);
    const manifestPath = path.join(themePath, 'manifest.json');
    const reportExtPath = path.join(themePath, 'report-extended.json');
    if (!(await fs.pathExists(manifestPath))) continue;
    const manifest = await fs.readJson(manifestPath);
    const report = (await fs.pathExists(reportExtPath)) ? await fs.readJson(reportExtPath) : { summary: { errors: 0 } };

    telemetry.builds += 1;
    telemetry.totalBuildTimeSec += Number(manifest.elapsedSec || 0);
    telemetry.passes += (report.summary?.errors === 0 ? 1 : 0);
    telemetry.avgBuildTimeSec = telemetry.builds ? Number((telemetry.totalBuildTimeSec / telemetry.builds).toFixed(2)) : 0;
    telemetry.last = {
      theme,
      timestamp: new Date().toISOString(),
      elapsedSec: manifest.elapsedSec,
      errors: report.summary?.errors || 0,
      warnings: report.summary?.warnings || 0
    };
  }

  await fs.ensureDir('logs');
  await fs.writeJson(telemetryPath, telemetry, { spaces: 2 });
  console.log('Updated telemetry:', telemetry);
}

main().catch((e) => { console.error(e); process.exit(1); });
