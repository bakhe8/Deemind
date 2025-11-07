import fs from 'fs-extra';
import path from 'path';

async function main() {
  const outRoot = path.join(process.cwd(), 'output');
  if (!(await fs.pathExists(outRoot))) return;
  const themes = (await fs.readdir(outRoot, { withFileTypes: true })).filter(e => e.isDirectory()).map(e => e.name);
  const freq = new Map();
  const byType = new Map();
  for (const t of themes) {
    const rep = path.join(outRoot, t, 'report-extended.json');
    if (!(await fs.pathExists(rep))) continue;
    let report = {};
    try { report = await fs.readJson(rep); } catch { continue; }
    const all = [].concat(report.errors || [], report.warnings || []);
    for (const item of all) {
      const key = item.type || 'unknown';
      freq.set(key, (freq.get(key) || 0) + 1);
      const arr = byType.get(key) || [];
      arr.push({ theme: t, file: item.file, message: item.message });
      byType.set(key, arr);
    }
  }
  const flaky = [];
  for (const [type, n] of freq.entries()) {
    if (n >= 2) flaky.push({ type, count: n, occurrences: byType.get(type) });
  }
  await fs.ensureDir('logs');
  await fs.writeJson(path.join('logs', 'flaky.json'), { generatedAt: new Date().toISOString(), flaky }, { spaces: 2 });
  console.log(`Flaky types: ${flaky.length}`);
}

main().catch(e => { console.error(e); process.exit(1); });

