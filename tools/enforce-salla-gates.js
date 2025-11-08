#!/usr/bin/env node
import fs from 'fs-extra';
import path from 'path';

async function main() {
  const cfgPath = path.join(process.cwd(), 'configs', 'harmony.json');
  const cfg = (await fs.pathExists(cfgPath)) ? (await fs.readJson(cfgPath)) : {};
  const schemaMissingMax = Number(cfg.schemaMissingMax ?? 0);
  const demoDriftAllowed = Number(cfg.demoDriftAllowed ?? 0); // counts of lines with Only in ...
  const raedMinOverlap = Number(cfg.raedMinOverlap ?? 0); // 0..1

  const repDir = path.join(process.cwd(), 'reports');
  let missing = 0;
  const schemaFile = path.join(repDir, 'salla-schema-diff.md');
  if (await fs.pathExists(schemaFile)) {
    const txt = await fs.readFile(schemaFile, 'utf8');
    const m = txt.match(/Required fields missing \((\d+)\)/);
    missing = m ? parseInt(m[1], 10) : 0;
  }
  if (missing > schemaMissingMax) {
    console.error(`Schema drift: missing=${missing} > max=${schemaMissingMax}`);
    process.exit(1);
  }

  // Aggregate demo drift across raed/luna/mono
  const bases = ['raed','luna','mono'];
  let driftHits = 0;
  for (const b of bases) {
    const f = path.join(repDir, `salla-demo-diff.${b}.md`);
    if (!(await fs.pathExists(f))) continue;
    const txt = await fs.readFile(f, 'utf8');
    const out = (txt.match(/Only in output:/g) || []).length;
    const base = (txt.match(/Only in baseline:/g) || []).length;
    if (out > demoDriftAllowed || base > demoDriftAllowed) {
      console.error(`Demo drift (${b}): out=${out} base=${base} > allowed=${demoDriftAllowed}`);
      driftHits++;
    }
  }
  if (driftHits > 0) process.exit(1);
  // Raed structural overlap gate (optional)
  const ro = path.join(repDir, 'salla-raed-structure-overlap.json');
  if (await fs.pathExists(ro)) {
    const o = await fs.readJson(ro).catch(()=>({ jaccard: 1 }));
    if (o.jaccard < raedMinOverlap) {
      console.error(`Raed overlap too low: ${o.jaccard} < min ${raedMinOverlap}`);
      process.exit(1);
    }
  }
  console.log('Salla gates passed.');
}

main().catch(e => { console.error(e); process.exit(1); });
