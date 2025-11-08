// Build a minimal Raed-like fixture and assert no extended validation errors.
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const fixtures = ['salla-raed-lite','salla-luna-lite','salla-mono-lite'];
  const { execSync } = await import('child_process');
  const { validateExtended } = await import(pathToFileURL(path.join(process.cwd(), 'tools', 'validator-extended.js')).href);
  for (const name of fixtures) {
    const src = path.join(__dirname, 'input', name);
    const dst = path.join(process.cwd(), 'input', name);
    await fs.ensureDir(path.dirname(dst));
    await fs.remove(dst);
    await fs.copy(src, dst);
    execSync(`node cli.js ${name} --sanitize --i18n --autofix`, { stdio: 'inherit' });
    const outDir = path.join(process.cwd(), 'output', name);
    const report = await validateExtended(outDir);
    const errCount = (report.errors||[]).length;
    if (errCount) {
      console.error(`❌ ${name} fixture validation errors: ${errCount}`);
      process.exit(1);
    }
    console.log(`✅ ${name} fixture validated without errors.`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
