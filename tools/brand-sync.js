// @reuse-from: fs-extra
// @description: Lightweight import/export helper for brand presets.
import fs from 'fs-extra';
import path from 'path';

const brandsDir = path.join(process.cwd(), 'core', 'brands');
await fs.ensureDir(brandsDir);

const action = process.argv[2] || 'list';
const name = process.argv[3];

async function readStdin() {
  return await new Promise((resolve) => {
    let buffer = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      buffer += chunk;
    });
    process.stdin.on('end', () => resolve(buffer));
  });
}

if (action === 'list') {
  const files = (await fs.readdir(brandsDir)).filter((file) => file.endsWith('.json'));
  console.log(files.map((file) => path.basename(file, '.json')).join('\n'));
  process.exit(0);
}

if (action === 'export') {
  if (!name) throw new Error('Usage: brand-sync export <name>');
  const file = path.join(brandsDir, `${name}.json`);
  if (!(await fs.pathExists(file))) throw new Error(`brand not found: ${name}`);
  process.stdout.write(await fs.readFile(file, 'utf8'));
  process.exit(0);
}

if (action === 'import') {
  if (!name) throw new Error('Usage: brand-sync import <name> < file.json');
  const data = await readStdin();
  await fs.writeFile(path.join(brandsDir, `${name}.json`), data, 'utf8');
  console.log(`✅ Imported → core/brands/${name}.json`);
  process.exit(0);
}

console.error(`Unknown action "${action}". Expected list|export|import.`);
process.exit(1);
