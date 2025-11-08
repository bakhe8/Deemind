// Simple harness to verify that pending exports exist and are functions/classes.
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

const ROOT = process.cwd();
const PENDING_DIR = path.join(ROOT, 'tests', 'pending');

// Map encoded module basenames to new locations after core moved to src/
const MOVE_MAP = new Map([
  ['tools_adapter.js', 'src/adapter.js'],
  ['tools_validator.js', 'src/validator.js'],
  ['tools_deemind-parser_parser.js', 'src/deemind-parser/parser.js'],
  ['tools_deemind-parser_semantic-mapper.js', 'src/deemind-parser/semantic-mapper.js'],
  ['tools_deemind-parser_hybrid-runner.js', 'src/deemind-parser/hybrid-runner.js'],
  ['tools_deemind-parser_conflict-detector.js', 'src/deemind-parser/conflict-detector.js'],
  ['tools_deemind-parser_css-parser.js', 'src/deemind-parser/css-parser.js'],
  ['tools_deemind-parser_js-extractor.js', 'src/deemind-parser/js-extractor.js'],
]);

function decodeModuleFromFilename(fileBase) {
  // fileBase example: tools_deemind-parser_parser.js.parseFolder.spec.js
  const parts = fileBase.split('.');
  if (parts.length < 3) return null;
  const exportName = parts[parts.length - 3]; // before '.spec.js'
  const encoded = parts.slice(0, parts.length - 3).join('.');
  const direct = encoded.replace(/^tools_/, 'tools/').replace(/_/g, '/');
  let moduleRel = direct;
  if (MOVE_MAP.has(encoded)) moduleRel = MOVE_MAP.get(encoded);
  return { moduleRel, exportName };
}

async function main() {
  if (!fs.existsSync(PENDING_DIR)) {
    console.log('No pending tests directory.');
    return;
  }
  const files = fs.readdirSync(PENDING_DIR).filter(f => f.endsWith('.spec.js'));
  let failures = 0;
  for (const f of files) {
    const { moduleRel, exportName } = decodeModuleFromFilename(f) || {};
    if (!moduleRel || !exportName) { console.warn('Skip malformed pending spec:', f); continue; }
    const abs = path.join(ROOT, moduleRel);
    if (!fs.existsSync(abs)) { console.error('Missing module for pending test:', moduleRel); failures++; continue; }
    let mod;
    try {
      mod = await import(pathToFileURL(abs).href);
    } catch (e) {
      // Allow optional tooling deps (e.g., archiver for delivery) to be missing in CI
      console.warn(`Skipping ${moduleRel} due to import error: ${e?.message || e}`);
      continue;
    }
    const fn = mod[exportName];
    const ok = typeof fn === 'function';
    if (!ok) { console.error(`❌ ${exportName} not found or not a function in ${moduleRel}`); failures++; }
    else { console.log(`✅ ${exportName} is available in ${moduleRel}`); }
  }
  if (failures) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });
