// @reuse-from: fs-extra
// @description: Extracts basic brand DNA from preview assets into core/brands.
import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';

const inputDir = path.join(process.cwd(), 'preview-static');
const brandsDir = path.join(process.cwd(), 'core', 'brands');
await fs.ensureDir(brandsDir);

function hash(value) {
  return crypto.createHash('md5').update(value).digest('hex').slice(0, 8);
}

function sniffColors(css) {
  const found = new Set();
  const regex = /#([0-9a-f]{3,8})|\brgba?\([^)]+\)|\b[a-zA-Z]+\b/g;
  let match;
  while ((match = regex.exec(css))) {
    const token = match[0];
    if (/^(var|calc|inherit|initial|unset|none|auto)$/i.test(token)) continue;
    found.add(token);
  }
  return Array.from(found).slice(0, 24);
}

async function run() {
  const cssFiles = [];
  if (await fs.pathExists(inputDir)) {
    const entries = await fs.readdir(inputDir);
    for (const entry of entries) {
      const directory = path.join(inputDir, entry);
      if (!(await fs.stat(directory)).isDirectory()) continue;
      const cssPath = path.join(directory, 'assets', 'css');
      if (await fs.pathExists(cssPath)) {
        const files = (await fs.readdir(cssPath)).filter((file) => file.endsWith('.css'));
        for (const file of files) {
          cssFiles.push(path.join(cssPath, file));
        }
      }
    }
  }

  const cssCombined = (
    await Promise.all(
      cssFiles.map(async (file) => {
        try {
          return await fs.readFile(file, 'utf8');
        } catch {
          return '';
        }
      }),
    )
  ).join('\n');

  const colors = sniffColors(cssCombined);
  const dna = {
    id: `brand-${hash(colors.join('|'))}`,
    identity: {
      colorPalette: {
        primary: colors[0] || '#0ea5e9',
        secondary: colors[1] || '#64748b',
        accents: colors.slice(2, 8),
      },
      typography: { base: 'Inter', scale: '1.125', headings: '600' },
      spacing: { base: 4, scale: [4, 8, 12, 16, 24, 32] },
      voice: { tone: 'modern-minimal', density: 'compact' },
    },
    components: { buttons: [], cards: [], forms: [] },
    presets: { salla: { radius: 8, shadow: 'sm' }, canonical: { container: 1200 } },
  };

  const outFile = path.join(brandsDir, `${dna.id}.json`);
  await fs.writeJson(outFile, dna, { spaces: 2 });
  console.log(`✅ Extracted Brand DNA → ${outFile}`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
