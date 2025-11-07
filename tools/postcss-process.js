import fs from 'fs-extra';
import path from 'path';
import postcss from 'postcss';
import autoprefixer from 'autoprefixer';
import dirPseudo from 'postcss-dir-pseudo-class';

async function listCss(dir) {
  const out = [];
  async function walk(d) {
    if (!(await fs.pathExists(d))) return;
    const ents = await fs.readdir(d, { withFileTypes: true });
    for (const e of ents) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) await walk(p); else if (p.endsWith('.css')) out.push(p);
    }
  }
  await walk(dir);
  return out;
}

async function main() {
  const theme = process.argv[2] || 'demo';
  const outDir = path.join(process.cwd(), 'output', theme, 'assets');
  const files = await listCss(outDir);
  const processor = postcss([dirPseudo(), autoprefixer()]);
  for (const f of files) {
    const css = await fs.readFile(f, 'utf8');
    const res = await processor.process(css, { from: f, to: f, map: false });
    await fs.writeFile(f, res.css, 'utf8');
  }
  console.log(`PostCSS processed ${files.length} file(s) in ${outDir}`);
}

main().catch(e => { console.error(e); process.exit(1); });

