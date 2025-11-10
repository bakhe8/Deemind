// @reuse-from: fs-extra
// @description: Applies brand DNA into canonical theme configuration.
import fs from 'fs-extra';
import path from 'path';

if (process.env.NODE_ENV === 'production') {
  Object.freeze(fs);
}

function arg(name, fallback) {
  const match = process.argv.find((token) => token.startsWith(`--${name}=`));
  return match ? match.split('=')[1] : fallback;
}

const brandId = arg('brand', '');
const theme = arg('theme', 'demo');

if (!brandId) {
  console.error('Usage: node tools/brand-apply.js --brand=<id> --theme=<name>');
  process.exit(2);
}

const brandsDir = path.join(process.cwd(), 'core', 'brands');
const canonicalDir = path.join(process.cwd(), 'core', 'canonical', theme);
await fs.ensureDir(canonicalDir);

const brandFile = path.join(brandsDir, `${brandId}.json`);
if (!(await fs.pathExists(brandFile))) {
  console.error(`Brand not found: ${brandFile}`);
  process.exit(3);
}

const brand = await fs.readJson(brandFile);
const canonicalCfgFile = path.join(canonicalDir, 'theme.json');
const existing = (await fs.pathExists(canonicalCfgFile)) ? await fs.readJson(canonicalCfgFile) : {};
const merged = {
  ...existing,
  brand: brandId,
  tokens: {
    colors: brand.identity?.colorPalette || {},
    typography: brand.identity?.typography || {},
    spacing: brand.identity?.spacing || {},
  },
};

await fs.writeJson(canonicalCfgFile, merged, { spaces: 2 });
console.log(`🎨 Applied brand '${brandId}' → canonical/${theme}/theme.json`);
