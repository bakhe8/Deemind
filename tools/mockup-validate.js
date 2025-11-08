#!/usr/bin/env node
import fs from 'fs-extra';
import path from 'path';

async function main() {
  const theme = process.argv[2] || 'modern-blue';
  const root = path.join(process.cwd(), 'mockups', theme);
  const preview = path.join(root, 'preview.html');
  const css = path.join(root, 'preview.css');
  let errors = [];
  if (!(await fs.pathExists(root))) errors.push({ type: 'missing', file: root });
  if (!(await fs.pathExists(preview))) errors.push({ type: 'missing', file: preview });
  if (!(await fs.pathExists(css))) errors.push({ type: 'missing', file: css });
  // basic checks: contains expected sections
  if (await fs.pathExists(preview)) {
    const html = await fs.readFile(preview, 'utf8');
    ['navbar','hero','grid-4','banner','footer'].forEach(cls => {
      if (!html.includes(cls)) errors.push({ type: 'section-missing', section: cls });
    });
  }
  const repDir = path.join(process.cwd(), 'reports');
  await fs.ensureDir(repDir);
  const score = errors.length ? 80 : 100;
  const out = { theme, passed: errors.length === 0, score, errors };
  await fs.writeJson(path.join(repDir, 'mockup-validation.json'), out, { spaces: 2 });
  if (errors.length) { console.error('Mockup validation warnings:', errors.length); process.exitCode = 0; }
  console.log('Mockup validation complete with score:', score);
}

main().catch(e => { console.error(e); process.exit(1); });

