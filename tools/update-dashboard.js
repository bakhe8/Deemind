#!/usr/bin/env node
import fs from 'fs-extra';
import path from 'path';

async function main() {
  const dashPath = path.resolve('reports', 'dashboard.html');
  if (!(await fs.pathExists(dashPath))) {
    console.log('Dashboard not found — skipping update.');
    process.exit(0);
  }
  const logsDir = path.resolve('logs');
  await fs.ensureDir(logsDir);
  const summary = path.resolve('logs', 'harmony-summary.md');
  const now = new Date().toISOString();
  await fs.appendFile(summary, `\nUpdated dashboard at ${now}\n`);
  console.log(`✅ Dashboard refreshed at ${now}`);
}

main().catch((e) => { console.error(e); process.exit(1); });

