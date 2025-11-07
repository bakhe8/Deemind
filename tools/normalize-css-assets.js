import fs from 'fs-extra';
import path from 'path';

// Scans output assets/**/*.css and rewrites url(...) to assets/normalized/* paths,
// copying missing referenced files from the input tree when possible.
export async function normalizeCssAssets({ outputPath, inputPath }) {
  const cssDir = path.join(outputPath, 'assets');
  const files = await listFiles(cssDir, '.css');
  let rewrites = 0, copies = 0;
  for (const file of files) {
    let css = await fs.readFile(file, 'utf8');
    const dirRelFromAssets = path.relative(path.join(outputPath, 'assets'), path.dirname(file));
    css = await css.replace(/url\((['"]?)([^)'"]+)\1\)/gi, (m, q, url) => {
      if (/^https?:\/\//i.test(url) || url.startsWith('//') || url.startsWith('assets/')) return m;
      const srcAbs = resolveCssRef({ inputPath, outputPath, dirRelFromAssets, url });
      const targetRel = path.join('normalized', url.replace(/^\.+\//, ''));
      const dest = path.join(outputPath, 'assets', targetRel);
      tryCopy(srcAbs, dest);
      rewrites++; copies++;
      return `url('assets/${targetRel.replace(/\\/g,'/')}')`;
    });
    await fs.writeFile(file, css, 'utf8');
  }
  return { rewrites, copies };
}

function resolveCssRef({ inputPath, outputPath, dirRelFromAssets, url }) {
  // Try resolving relative to output assets folder
  const outCandidate = path.resolve(path.join(outputPath, 'assets', dirRelFromAssets), url);
  if (fs.existsSync(outCandidate)) return outCandidate;
  // Try resolving relative to input assets
  const inCandidate = path.resolve(path.join(inputPath, 'assets', dirRelFromAssets), url);
  if (fs.existsSync(inCandidate)) return inCandidate;
  // Fallback: relative to input root
  const inRootCandidate = path.resolve(inputPath, url);
  return inRootCandidate;
}

async function listFiles(base, ext) {
  const out = [];
  async function walk(d) {
    if (!(await fs.pathExists(d))) return;
    const ents = await fs.readdir(d, { withFileTypes: true });
    for (const e of ents) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) await walk(p); else if (!ext || p.endsWith(ext)) out.push(p);
    }
  }
  await walk(base);
  return out;
}

function tryCopy(src, dest) {
  try {
    if (!fs.existsSync(src)) return;
    fs.ensureDirSync(path.dirname(dest));
    fs.copyFileSync(src, dest);
  } catch {}
}

// CLI
if (process.argv[1] && process.argv[1].endsWith('normalize-css-assets.js')) {
  const theme = process.argv[2] || 'demo';
  const root = process.cwd();
  normalizeCssAssets({ outputPath: path.join(root, 'output', theme), inputPath: path.join(root, 'input', theme) })
    .then(r => { console.log(`CSS normalized: rewrites=${r.rewrites}, copies=${r.copies}`); })
    .catch(e => { console.error(e); process.exit(1); });
}

