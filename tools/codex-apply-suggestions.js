// Applies trivial Codex suggestions marked auto_apply=true.
// Supports simple literal replacements described as: "replace 'A' with 'B'".
// Env (optional): DRY_RUN=true to preview only.

import fs from 'fs';
import path from 'path';

function parseSuggestions(text) {
  try { return JSON.parse(text); } catch { return []; }
}

function extractReplaceInstruction(fixText) {
  if (!fixText) return null;
  const m = String(fixText).match(/replace\s+'([^']+)'\s+with\s+'([^']+)'/i) || String(fixText).match(/replace\s+"([^"]+)"\s+with\s+"([^"]+)"/i);
  if (!m) return null;
  return { from: m[1], to: m[2] };
}

function safeApplyReplace(filePath, from, to) {
  if (!fs.existsSync(filePath)) return { changed: false, reason: 'missing file' };
  let content = fs.readFileSync(filePath, 'utf8');
  if (!content.includes(from)) return { changed: false, reason: 'pattern not found' };
  const updated = content.split(from).join(to);
  if (process.env.DRY_RUN === 'true') return { changed: true, dryRun: true };
  fs.writeFileSync(filePath, updated, 'utf8');
  return { changed: true };
}

function main() {
  const logsPath = path.resolve('logs', 'codex_suggestions.json');
  if (!fs.existsSync(logsPath)) { console.log('No suggestions file at', logsPath); return; }
  const suggestions = parseSuggestions(fs.readFileSync(logsPath, 'utf8'));
  const applicable = suggestions.filter(s => s && s.auto_apply && s.file && s.fix);
  const results = [];
  for (const s of applicable) {
    const rep = extractReplaceInstruction(s.fix);
    if (!rep) { results.push({ file: s.file, applied: false, reason: 'unsupported fix format' }); continue; }
    const r = safeApplyReplace(path.resolve(s.file), rep.from, rep.to);
    results.push({ file: s.file, applied: !!r.changed, dryRun: !!r.dryRun, reason: r.reason || null });
  }
  const stamp = new Date().toISOString().replace(/[:T]/g,'-').slice(0,19);
  const out = path.resolve('reports', `codex-auto-apply-plan-${stamp}.json`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(results, null, 2));
  console.log('Auto-apply results saved to', out);
}

main();

