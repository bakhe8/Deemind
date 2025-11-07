import fs from 'fs-extra';
import path from 'path';

const THEMES = ['demo', 'gimni'];
const SNAP_ROOT = path.join(process.cwd(), 'tests', 'snapshots');

function normalize(text) {
  return String(text).replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, '').trim();
}

async function ensureSnapshot(theme, rel, content, update = false) {
  const snapPath = path.join(SNAP_ROOT, theme, rel);
  if (!(await fs.pathExists(snapPath)) || update) {
    await fs.ensureDir(path.dirname(snapPath));
    await fs.writeFile(snapPath, content, 'utf8');
    return { created: true, ok: true };
  }
  const snap = await fs.readFile(snapPath, 'utf8');
  const ok = normalize(snap) === normalize(content);
  return { created: false, ok, snapPath };
}

async function main() {
  const update = process.argv.includes('--update');
  let failures = 0;
  for (const theme of THEMES) {
    const outDir = path.join(process.cwd(), 'output', theme, 'pages');
    const files = (await fs.pathExists(outDir)) ? (await fs.readdir(outDir)).filter(f => f.endsWith('.twig')) : [];
    for (const f of files) {
      const rel = path.join('pages', f);
      const content = await fs.readFile(path.join(outDir, f), 'utf8');
      const res = await ensureSnapshot(theme, rel, content, update);
      if (!res.ok) {
        console.error(`❌ Snapshot mismatch for ${theme}/${rel}`);
        failures++;
      } else if (res.created) {
        console.log(`📸 Created snapshot for ${theme}/${rel}`);
      } else {
        console.log(`✅ Snapshot OK for ${theme}/${rel}`);
      }
    }
  }
  if (failures) {
    console.error(`Snapshot failures: ${failures}`);
    process.exit(1);
  }
}

main().catch(e => { console.error(e); process.exit(1); });

