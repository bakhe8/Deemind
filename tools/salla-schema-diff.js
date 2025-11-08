#!/usr/bin/env node
import fs from 'fs-extra';
import path from 'path';

function requiredPaths(schema) {
  const req = new Set(schema.required || []);
  return Array.from(req);
}

async function main() {
  const [theme='demo'] = process.argv.slice(2);
  const reports = path.join(process.cwd(), 'reports');
  await fs.ensureDir(reports);
  const schemaPath = path.join(process.cwd(), 'configs', 'salla-schema.json');
  if (!(await fs.pathExists(schemaPath))) throw new Error('Missing configs/salla-schema.json');
  const schema = await fs.readJson(schemaPath);
  const required = requiredPaths(schema);
  const themeJsonPath = path.join(process.cwd(), 'output', theme, 'theme.json');
  const data = (await fs.pathExists(themeJsonPath)) ? (await fs.readJson(themeJsonPath)) : {};
  const missing = required.filter(k => !(k in data));
  const lines = [];
  lines.push('# Salla Schema Diff');
  lines.push(`Theme: ${theme}`);
  lines.push(`Required fields missing (${missing.length}): ${missing.join(', ') || 'none'}`);
  await fs.writeFile(path.join(reports,'salla-schema-diff.md'), lines.join('\n'));
}

main().catch(e => { console.error(e); process.exit(1); });

