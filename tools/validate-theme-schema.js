#!/usr/bin/env node
import fs from 'fs-extra';
import path from 'path';
import Ajv from 'ajv';

const ROOT = process.cwd();

async function listThemes() {
  const inputDir = path.join(ROOT, 'input');
  if (!(await fs.pathExists(inputDir))) return [];
  const ents = await fs.readdir(inputDir, { withFileTypes: true });
  return ents.filter(e => e.isDirectory()).map(e => e.name);
}

async function validateTheme(theme, ajv, schema) {
  const p = path.join(ROOT, 'output', theme, 'theme.json');
  if (!(await fs.pathExists(p))) return { theme, ok: false, errors: ['theme.json missing'] };
  const data = await fs.readJson(p).catch(() => ({}));
  const validate = ajv.compile(schema);
  const ok = validate(data);
  const errors = ok ? [] : (validate.errors || []).map(e => `${e.instancePath || '/'} ${e.message}`);
  return { theme, ok, errors };
}

async function main() {
  const args = process.argv.slice(2);
  const all = args.includes('--all');
  const themesArg = args.filter(a => !a.startsWith('--'));
  const themes = all || themesArg.length === 0 ? await listThemes() : themesArg;
  const schemaPath = path.join(ROOT, 'configs', 'salla-schema.json');
  if (!(await fs.pathExists(schemaPath))) { console.error('No schema at configs/salla-schema.json'); process.exit(1); }
  const schema = await fs.readJson(schemaPath);
  const ajv = new Ajv({ allErrors: true, strict: false });
  let failures = 0;
  for (const t of themes) {
    const res = await validateTheme(t, ajv, schema);
    if (!res.ok) {
      failures++;
      console.error(`❌ ${t}:`, res.errors.join('; '));
    } else {
      console.log(`✅ ${t}: schema OK`);
    }
  }
  if (failures) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });

