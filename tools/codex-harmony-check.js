#!/usr/bin/env node
// Internal compatibility auditor ("Harmony" checks) — name retained per request.
// Aligns with main-only policy and runs best-effort static/runtime probes.

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

let OpenAIClient = null;
try { ({ default: OpenAIClient } = await import('openai')); } catch (e) { /* ignore */ }

const ROOT = process.cwd();
const LOGS = path.join(ROOT, 'logs');
const REPORT = path.join(LOGS, 'codex-harmony-report.md');
const REPORTS_DIR = path.join(ROOT, 'reports', 'harmony');
const SCORE_JSON = path.join(LOGS, 'harmony-score.json');

function safeRun(cmd) {
  try {
    const started = Date.now();
    execSync(cmd, { stdio: 'pipe', encoding: 'utf8' });
    return { ok: true, ms: Date.now() - started };
  } catch (e) {
    return { ok: false, ms: 0, err: e?.message || String(e) };
  }
}

function listFiles(dir, exts = ['.js', '.mjs', '.cjs']) {
  const out = [];
  const walk = d => {
    if (!fs.existsSync(d)) return;
    for (const name of fs.readdirSync(d)) {
      const p = path.join(d, name);
      const st = fs.statSync(p);
      if (st.isDirectory()) {
        if (name === 'node_modules' || name.startsWith('.')) continue;
        walk(p);
      } else {
        if (!exts.length || exts.includes(path.extname(name))) out.push(p);
      }
    }
  };
  walk(dir);
  return out;
}

function checkDeps() {
  const diagnostics = [];
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    const deps = Object.keys(pkg.dependencies || {});
    const devDeps = Object.keys(pkg.devDependencies || {});
    const missing = [];
    for (const d of [...deps, ...devDeps]) {
      if (!fs.existsSync(path.join(ROOT, 'node_modules', d))) missing.push(d);
    }
    if (missing.length) diagnostics.push(`Missing modules: ${missing.join(', ')}`);
  } catch (e) { diagnostics.push('Unable to read package.json'); }
  return diagnostics;
}

function scanImports() {
  const diagnostics = [];
  const files = listFiles(path.join(ROOT, 'tools')).concat(listFiles(path.join(ROOT, 'src')));
  const importRe = /\bfrom\s+['"]([^'"\\]+)['"]|require\((['"])([^'"\\]+)\2\)/g;
  for (const f of files) {
    try {
      const txt = fs.readFileSync(f, 'utf8');
      let m;
      while ((m = importRe.exec(txt))) {
        const mod = m[1] || m[3];
        if (!mod) continue;
        if (mod.startsWith('.') || mod.startsWith('/')) {
          const resolved = path.resolve(path.dirname(f), mod);
          // check existence with common extensions
          const cand = [resolved, `${resolved}.js`, `${resolved}.mjs`, `${resolved}.cjs`, path.join(resolved, 'index.js')];
          if (!cand.some(p => fs.existsSync(p))) {
            diagnostics.push(`Unresolved import in ${path.relative(ROOT, f)} -> ${mod}`);
          }
        }
      }
    } catch (e) { void e; }
  }
  return diagnostics;
}

function separationChecks() {
  const srcDir = path.join(ROOT, 'src');
  let crossImports = 0; const sepDiags = [];
  if (fs.existsSync(srcDir)) {
    const importRe = /\bfrom\s+['"]([^'"\\]+)['"]|require\((['"])([^'"\\]+)\2\)/g;
    for (const f of listFiles(srcDir)) {
      try {
        const txt = fs.readFileSync(f, 'utf8');
        let m; while ((m = importRe.exec(txt))) {
          const mod = m[1] || m[3];
          if (!mod) continue;
          if (mod.startsWith('tools/') || mod.includes('/tools/')) {
            crossImports++;
            sepDiags.push(`Cross-domain import in ${path.relative(ROOT,f)} -> ${mod}`);
          }
        }
      } catch (e) { /* ignore */ }
    }
  }
  const coreToolSeparation = crossImports === 0 ? 100 : Math.max(0, 100 - crossImports * 10);
  return { sepDiags, crossImports, coreToolSeparation };
}

function checkWorkflows() {
  const diagnostics = [];
  const wfDir = path.join(ROOT, '.github', 'workflows');
  if (!fs.existsSync(wfDir)) return diagnostics;
  const ymls = fs.readdirSync(wfDir).filter(f => f.endsWith('.yml') || f.endsWith('.yaml'));
  for (const y of ymls) {
    try {
      const txt = fs.readFileSync(path.join(wfDir, y), 'utf8');
      if (/node tools\/[\w/-]+\.js/.test(txt)) {
        const m = txt.match(/node\s+(tools\/[\w/.-]+\.js)/);
        if (m && !fs.existsSync(path.join(ROOT, m[1]))) diagnostics.push(`Workflow ${y} references missing script ${m[1]}`);
      }
    } catch (e) { void e; }
  }
  return diagnostics;
}

function checkAdaptersVsCanonical() {
  const diagnostics = [];
  const canonical = path.join(ROOT, 'configs', 'salla-schema.json');
  const adapter = path.join(ROOT, 'tools', 'adapter.js');
  if (!fs.existsSync(adapter)) diagnostics.push('Adapter script tools/adapter.js missing');
  if (!fs.existsSync(canonical)) diagnostics.push('Salla canonical schema configs/salla-schema.json missing');
  return diagnostics;
}

async function main() {
  fs.mkdirSync(LOGS, { recursive: true });
  const lines = [];
  lines.push('# Codex Harmony Validation');
  lines.push('');
  // Build consistency (demo only, fast)
  const build = safeRun('node cli.js demo --sanitize --i18n');
  lines.push('## Build Consistency');
  lines.push(`- demo build: ${build.ok ? 'ok' : 'failed'} (${build.ms} ms)`);
  if (!build.ok) lines.push(`- error: ${build.err}`);

  // Dependencies presence
  const depDiags = checkDeps();
  lines.push('');
  lines.push('## Dependencies');
  lines.push(depDiags.length ? depDiags.map(d => `- ${d}`).join('\n') : '- All installed');

  // Imports/exports resolution (basic)
  const importDiags = scanImports();
  lines.push('');
  lines.push('## Imports/Exports');
  lines.push(importDiags.length ? importDiags.map(d => `- ${d}`).join('\n') : '- No unresolved local imports');

  // Workflows → tools mapping
  const wfDiags = checkWorkflows();
  lines.push('');
  lines.push('## Workflows ↔ Tools');
  lines.push(wfDiags.length ? wfDiags.map(d => `- ${d}`).join('\n') : '- Workflows reference existing scripts');

  // Adapters ↔ canonical
  const adaptDiags = checkAdaptersVsCanonical();
  const { sepDiags, crossImports, coreToolSeparation } = separationChecks();
  lines.push('');
  lines.push('## Adapters ↔ Canonical');
  lines.push(adaptDiags.length ? adaptDiags.map(d => `- ${d}`).join('\n') : '- Adapter and canonical schema present');

  // Optional AI summary
  if (OpenAIClient && process.env.OPENAI_API_KEY) {
    try {
      const client = new OpenAIClient({ apiKey: process.env.OPENAI_API_KEY });
      const summary = lines.join('\n');
      await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: `Summarize key risks and give a harmony score (0-100):\n\n${summary}` }]
      });
    } catch (e) { void e; }
  }

  // Compute a simple score
  let score = 100;
  const penalty = (depDiags.length + importDiags.length + wfDiags.length + adaptDiags.length) * 5;
  if (!build.ok) score -= 20;
  score = Math.max(0, score - penalty);
  lines.push('');
  lines.push('## Harmony Score');
  lines.push(`- score: ${score}`);
  lines.push(`- coreToolSeparation: ${coreToolSeparation}`);
  lines.push(`- crossImportsDetected: ${crossImports}`);

  fs.writeFileSync(REPORT, lines.join('\n'));
  try { fs.mkdirSync(REPORTS_DIR, { recursive: true }); } catch (e) { /* ignore */ }
  const initialOut = path.join(REPORTS_DIR, 'initial-harmony-validation.md');
  if (!fs.existsSync(initialOut)) {
    try { fs.writeFileSync(initialOut, lines.join('\n')); } catch (e) { /* ignore */ }
  }

  // Append score history
  let hist = [];
  try { hist = JSON.parse(fs.readFileSync(SCORE_JSON, 'utf8')); } catch (e) { hist = []; }
  hist.push({ date: new Date().toISOString(), score, coreToolSeparation, crossImportsDetected: crossImports, issues: [...depDiags, ...importDiags, ...wfDiags, ...adaptDiags, ...sepDiags].slice(0, 20), status: score > 90 ? 'Excellent' : score > 75 ? 'Good' : 'Needs attention' });
  try {
    const repDir = path.join(ROOT, 'reports', 'harmony'); fs.mkdirSync(repDir, { recursive: true });
    const hierLines = ['# Hierarchy Validation', '', '## Separation Findings', sepDiags.length ? sepDiags.map(d=>`- ${d}`).join('\n') : '- No cross-domain imports found', '', `Core↔Tools separation score: ${coreToolSeparation}`];
    fs.writeFileSync(path.join(repDir,'hierarchy-validation.md'), hierLines.join('\n'));
  } catch (e) { /* ignore */ }
  fs.writeFileSync(SCORE_JSON, JSON.stringify(hist, null, 2));
  console.log(`✅ Harmony report → ${path.relative(ROOT, REPORT)} (score ${score})`);
}

main().catch(e => { console.error(e); process.exit(1); });
