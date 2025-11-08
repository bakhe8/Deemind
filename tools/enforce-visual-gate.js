#!/usr/bin/env node
import fs from 'fs-extra';
import path from 'path';

async function main() {
  const cfg = await fs.readJson(path.join(process.cwd(), 'configs', 'harmony.json')).catch(()=>({ enableVisualGate:false }));
  if (!cfg.enableVisualGate) { console.log('Visual gate disabled.'); return; }
  const summary = path.join(process.cwd(), 'reports', 'visual', 'diffs', 'summary.json');
  if (!(await fs.pathExists(summary))) { console.log('No visual diff summary; skipping.'); return; }
  const s = await fs.readJson(summary).catch(()=>({ pairs:0, diffs:0 }));
  const max = Number(cfg.visualDiffMax ?? 0);
  console.log('Visual diffs:', s.diffs, 'max allowed:', max);
  if (s.diffs > max) { console.error('Visual regression gate failed'); process.exit(1); }
}

main().catch(e => { console.error(e); process.exit(1); });

