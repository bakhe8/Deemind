#!/usr/bin/env node
// Create labels, milestones, and issues from .github/deemind-issues.json via GitHub REST API
// Usage: node tools/create-issues.js <owner/repo> [jsonPath]

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'node:child_process';

async function main() {
  const [repo, jsonPathArg] = process.argv.slice(2);
  const isBuiltin = (jsonPathArg === 'builtin:comprehensive' || jsonPathArg === 'builtin:advanced');
  if (!repo) {
    console.error('Usage: node tools/create-issues.js <owner/repo> [jsonPath|builtin:comprehensive|builtin:advanced]');
    process.exit(1);
  }
  const jsonPath = isBuiltin ? null : (jsonPathArg || path.join('.github', 'deemind-issues.json'));
  if (!isBuiltin && !fs.existsSync(jsonPath)) {
    console.error(`Issues file not found: ${jsonPath}`);
    process.exit(1);
  }

  const token = getGhToken();
  const api = buildApi(token, repo);  let issues; if (isBuiltin) {
    issues = [
      { title: 'Identity: Project name set to Deemind — The Intelligent Theming Engine', labels:['docs'], milestone:'🧱 Week 1 — Foundation', body:'Ensure README and metadata consistently use the name.' },
      { title: 'Identity: Core purpose documented', labels:['docs'], milestone:'🧱 Week 1 — Foundation', body:'Convert messy static HTML/CSS/JS into Salla-ready Twig themes.' },
      { title: 'Identity: Local-only mode enforced', labels:['core','qa'], milestone:'🧱 Week 1 — Foundation', body:'No internet dependency; settings + package.json private.' },
      { title: 'Identity: Integration target Salla Theme System', labels:['docs'], milestone:'🧱 Week 1 — Foundation', body:'Adapter maps output to Salla expectations.' },
      { title: 'Identity: Vision statement added', labels:['docs'], milestone:'🧱 Week 1 — Foundation', body:'Self-healing intelligent parser.' },
      { title: 'Identity: Philosophy added', labels:['docs'], milestone:'🧱 Week 1 — Foundation', body:'Deemind doesn’t just parse — it deems meaning.' },
      { title: 'Pipeline: Input stage verified', labels:['core'], milestone:'🧱 Week 1 — Foundation', body:'Accepts raw folder with HTML/CSS/JS/images.' },
      { title: 'Pipeline: Parser stage verified', labels:['core'], milestone:'🧱 Week 1 — Foundation', body:'Normalize, detect structure, conflicts, reusable blocks.' },
      { title: 'Pipeline: Semantic mapper stage verified', labels:['core'], milestone:'🧱 Week 1 — Foundation', body:'Map static text to Twig vars and translations.' },
      { title: 'Pipeline: Adapter stage verified', labels:['core'], milestone:'🧱 Week 1 — Foundation', body:'Build Salla-compatible layout/pages/partials.' },
      { title: 'Pipeline: Validator stage verified', labels:['core'], milestone:'🧱 Week 1 — Foundation', body:'Schema, deps, assets, i18n checks.' },
      { title: 'Pipeline: Output stage verified', labels:['core'], milestone:'🧱 Week 1 — Foundation', body:'Manifest + reports, reproducible.' },
      { title: 'Folders: Ensure /input', labels:['core'], milestone:'🧱 Week 1 — Foundation', body:'User drops prototypes here.' },
      { title: 'Folders: Ensure /output', labels:['core'], milestone:'🧱 Week 1 — Foundation', body:'Generated themes mirror input name.' },
      { title: 'Folders: Ensure /tools', labels:['core'], milestone:'🧱 Week 1 — Foundation', body:'All engine logic.' },
      { title: 'Folders: Ensure /configs', labels:['core'], milestone:'🧱 Week 1 — Foundation', body:'Mappings, schema, budgets, settings.' },
      { title: 'Folders: Ensure /tests', labels:['core'], milestone:'🧱 Week 1 — Foundation', body:'Fixtures and runner.' },
      { title: 'Folders: Ensure /logs', labels:['core'], milestone:'🧱 Week 1 — Foundation', body:'Conflict and reports.' },
      { title: 'Folders: Ensure /archives', labels:['core'], milestone:'🧱 Week 1 — Foundation', body:'Optional delivery zips.' },
      { title: 'Folders: Automation layers present', labels:['automation'], milestone:'🧱 Week 1 — Foundation', body:'.github, .vscode, .husky configured.' },
      { title: 'CLI: Detect theme and run stages', labels:['core'], milestone:'🧱 Week 1 — Foundation', body:'cli.js orchestrates parse→map→adapt→validate.' },
      { title: 'CLI: Progress logs and manifest', labels:['core'], milestone:'🧱 Week 1 — Foundation', body:'Print clear steps and write manifest.json.' },
      { title: 'Core tools listed and integrated', labels:['core'], milestone:'🧱 Week 1 — Foundation', body:'parser, mapper, conflict-detector, adapter (adapter.js), validator, validator-extended.' },
      { title: 'Config: mappings.json present', labels:['config'], milestone:'🧱 Week 1 — Foundation', body:'Placeholders → Twig vars.' },
      { title: 'Config: settings.json present', labels:['config'], milestone:'🧱 Week 1 — Foundation', body:'Behavior toggles and caps.' },
      { title: 'Config: budgets.json present', labels:['config'], milestone:'🧱 Week 1 — Foundation', body:'Size thresholds.' },
      { title: 'Config: salla-schema.json present', labels:['config'], milestone:'🧱 Week 1 — Foundation', body:'Validation schema.' },
      { title: 'Dev: Node v20.10.0 pinned', labels:['core'], milestone:'🧱 Week 1 — Foundation', body:'.nvmrc updated.' },
      { title: 'Dev: Dependencies verified', labels:['core'], milestone:'🧱 Week 1 — Foundation', body:'fs-extra, cheerio, chalk, ajv, glob, p-limit.' },
      { title: 'Dev: ESLint + Prettier set', labels:['core'], milestone:'🧱 Week 1 — Foundation', body:'Flat config + formatting.' },
      { title: 'Dev: .gitignore entries', labels:['core'], milestone:'🧱 Week 1 — Foundation', body:'node_modules, output, logs.' },
      { title: 'VS Code: workspace config present', labels:['docs'], milestone:'🧱 Week 1 — Foundation', body:'settings, extensions, tasks.' },
      { title: 'GitHub: Private repo confirmed', labels:['automation'], milestone:'⚙️ Week 3 — Automation', body:'Repo privacy checked.' },
      { title: 'GitHub: Actions workflow active', labels:['automation'], milestone:'⚙️ Week 3 — Automation', body:'Build + fixtures on push/PR.' },
      { title: 'GitHub: Issue templates added', labels:['automation'], milestone:'⚙️ Week 3 — Automation', body:'Bug/feature templates present.' },
      { title: 'GitHub: Projects milestones planned', labels:['automation'], milestone:'⚙️ Week 3 — Automation', body:'Week 1/2/3 milestones set.' },
      { title: 'GitHub: Wiki enabled', labels:['automation'], milestone:'⚙️ Week 3 — Automation', body:'Internal docs area.' },
      { title: 'GitHub: Dependabot weekly updates', labels:['automation'], milestone:'⚙️ Week 3 — Automation', body:'Dependabot config present.' },
      { title: 'GitHub: Branch protection rules', labels:['automation'], milestone:'⚙️ Week 3 — Automation', body:'Require passing CI before merge.' },
      { title: 'GitHub: Security alerts enabled', labels:['automation'], milestone:'⚙️ Week 3 — Automation', body:'Dependency alerts on.' },
      { title: 'GitHub: Insights monitored', labels:['automation'], milestone:'⚙️ Week 3 — Automation', body:'Track CI and activity.' },
      { title: 'Pre-commit: lint, tests, validator', labels:['automation','qa'], milestone:'🧱 Week 1 — Foundation', body:'Hook fails on validator errors.' },
      { title: 'CI: build demo + fixtures', labels:['automation'], milestone:'🧱 Week 1 — Foundation', body:'Workflow validated.' },
      { title: 'Parser: Conflict detection', labels:['core'], milestone:'🧠 Week 2 — Intelligence', body:'Inconsistent sections across pages.' },
      { title: 'Parser: Template matching', labels:['core'], milestone:'🧠 Week 2 — Intelligence', body:'Known Salla patterns.' },
      { title: 'Parser: Progressive and multi-pass', labels:['core'], milestone:'🧠 Week 2 — Intelligence', body:'Structure→semantics merges.' },
      { title: 'Parser: Interactive resolution (optional)', labels:['core'], milestone:'🧠 Week 2 — Intelligence', body:'Ask once, store decisions.' },
      { title: 'Parser: Pattern learning (optional)', labels:['core'], milestone:'🧠 Week 2 — Intelligence', body:'Log patterns for future confidence.' },
      { title: 'Parser: JS extraction to assets', labels:['core'], milestone:'🧠 Week 2 — Intelligence', body:'Extract inline <script> safely.' },
      { title: 'Parser: Conflict reporting JSON', labels:['core'], milestone:'🧠 Week 2 — Intelligence', body:'Human-readable report.' },
      { title: 'Parser resilience: caching/retry/skip/async/throttle', labels:['core','qa'], milestone:'🧠 Week 2 — Intelligence', body:'Hash cache, retry, skip bad inputs.' },
      { title: 'Mapper: replace static labels with Twig vars', labels:['core'], milestone:'🧠 Week 2 — Intelligence', body:'mappings.json driven.' },
      { title: 'Mapper: detect dynamic placeholders', labels:['core'], milestone:'🧠 Week 2 — Intelligence', body:'user, price, currency, etc.' },
      { title: 'Mapper: wrap text for translation', labels:['core'], milestone:'🧠 Week 2 — Intelligence', body:'Add i18n wrappers.' },
      { title: 'Mapper: Arabic/English i18n support', labels:['core'], milestone:'🧠 Week 2 — Intelligence', body:'Optional pass.' },
      { title: 'Adapter: convert HTML to partials', labels:['core'], milestone:'🧠 Week 2 — Intelligence', body:'Header/footer/cards to partials (flagged).' },
      { title: 'Adapter: dependency graph topological order', labels:['core'], milestone:'🧠 Week 2 — Intelligence', body:'Order includes/extends.' },
      { title: 'Adapter: place templates in layout/pages/partials', labels:['core'], milestone:'🧠 Week 2 — Intelligence', body:'Salla structure.' },
      { title: 'Adapter: copy & fingerprint assets', labels:['core'], milestone:'🧠 Week 2 — Intelligence', body:'Content hash names to dedupe.' },
      { title: 'Adapter: generate theme.json', labels:['core'], milestone:'🧠 Week 2 — Intelligence', body:'Salla schema metadata.' },
      { title: 'Validation: core checks', labels:['qa'], milestone:'🧱 Week 1 — Foundation', body:'Twig syntax, assets exist, required pages.' },
      { title: 'Validation: extended checks', labels:['qa'], milestone:'🧱 Week 1 — Foundation', body:'Budgets, encoding, images, collisions.' },
      { title: 'Validation: schema sync (cached)', labels:['qa'], milestone:'🧱 Week 1 — Foundation', body:'Use salla-schema.json.' },
      { title: 'Validation: error taxonomy', labels:['qa'], milestone:'🧱 Week 1 — Foundation', body:'parseError, conversionError, validationError, assetError.' },
      { title: 'Validation: QA summary reports', labels:['qa'], milestone:'🧱 Week 1 — Foundation', body:'report.json and report-extended.json.' },
      { title: 'Manifest: include version/commit/timestamp/tool/checksum', labels:['qa','core'], milestone:'🧱 Week 1 — Foundation', body:'Content-based checksums and input checksum.' },
      { title: 'Build: repeatable checksums', labels:['qa'], milestone:'🧱 Week 1 — Foundation', body:'Identical outputs except timestamps.' },
      { title: 'Delivery: validate → (optional) zip → release', labels:['automation'], milestone:'⚙️ Week 3 — Automation', body:'Optional delivery pipeline.' },
      { title: 'Performance: caches and concurrency', labels:['qa','core'], milestone:'⚙️ Week 3 — Automation', body:'Asset dedupe; parsing cache; limit concurrency.' },
      { title: 'Security: sanitize and path guards', labels:['qa'], milestone:'🧱 Week 1 — Foundation', body:'Inline JS strip; traversal prevention; local only.' },
      { title: 'Metrics (later): build time, conflicts, error freq, cache, success %', labels:['qa'], milestone:'⚙️ Week 3 — Automation', body:'Collect locally in JSON.' },
      { title: 'Future: multi-platform adapter/ML/GUI/brand/incremental', labels:['docs'], milestone:'⚙️ Week 3 — Automation', body:'Capture extension requirements.' },
      { title: 'AI usage: VS Code assistant only', labels:['ai','docs'], milestone:'🧠 Week 2 — Intelligence', body:'No runtime AI dependencies.' },
      { title: 'Testing & QA: fixtures/automated/smoke/visual/CI', labels:['qa'], milestone:'🧱 Week 1 — Foundation', body:'End-to-end QA plan.' },
      { title: 'Docs: quickstart/architecture/configurations/validation/workflow', labels:['docs'], milestone:'🧱 Week 1 — Foundation', body:'Ensure docs complete and updated.' },
      { title: 'Plan: week sequencing tracked', labels:['docs'], milestone:'🧱 Week 1 — Foundation', body:'Week1/2/3 deliverables tracked.' },
      { title: 'Principles applied: resilient/transparent/efficient/learning/isolated/readable', labels:['docs'], milestone:'🧱 Week 1 — Foundation', body:'Confirm in code and docs.' },
      { title: 'Go-live checkpoints verified', labels:['qa'], milestone:'⚙️ Week 3 — Automation', body:'Env ready, CI, hooks, sample build, manifest, reports, docs, AI, CI passing.' },
      { title: 'Completion: Deemind 1.0 Personal Build Complete', labels:['docs'], milestone:'⚙️ Week 3 — Automation', body:'CLI build passes locally and in CI; validator OK; manifest present.' }
    ];
  } else {
    issues = isBuiltin ? issues : JSON.parse(fs.readFileSync(jsonPath,'utf8'));
  }

  // Milestones: title -> number
  const msMap = await ensureMilestones(api, [...new Set(issues.map(i => i.milestone).filter(Boolean))]);
  // Labels
  await ensureLabels(api, unique(issues.flatMap(i => i.labels || [])));
  // Existing issues titles (state=all)\n  const existingTitles = new Set();\n  {\n    let page = 1;\n    while (true) {\n      const data = await api(/issues?state=all&per_page=100&page=);\n      if (!Array.isArray(data) || data.length === 0) break;\n      for (const it of data) existingTitles.add((it.title||'').toLowerCase());\n      page++;\n    }\n  }\n  // Issues\n  for (const it of issues) {\n    if (existingTitles.has((it.title||'').toLowerCase())) {\n      process.stdout.write(Skip duplicate: \n);\n      continue;\n    }\n    const milestoneNumber = it.milestone ? msMap.get(it.milestone) : undefined;\n    await api('/issues', {\n      method: 'POST',\n      body: {\n        title: it.title,\n        body: it.body || '',\n        labels: it.labels || [],\n        milestone: milestoneNumber,\n      },\n    });\n    process.stdout.write(Created: \n);\n  }\n  console.log('All issues created.');
}

function unique(arr) { return Array.from(new Set(arr)); }

function getGhToken() {
  // Prefer env var, else gh auth token
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN.trim();
  const out = spawnSync('gh', ['auth', 'token'], { encoding: 'utf8' });
  if (out.status !== 0) {
    console.error('Unable to retrieve GitHub token. Run `gh auth login` or set GITHUB_TOKEN.');
    process.exit(1);
  }
  return out.stdout.trim();
}

function buildApi(token, repo) {
  const base = `https://api.github.com/repos/${repo}`;
  return async function api(pathname, { method = 'GET', body } = {}) {
    const headers = {
      'Accept': 'application/vnd.github+json',
      'Authorization': `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    };
    const res = await fetch(base + pathname, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`${method} ${pathname} -> ${res.status} ${res.statusText}: ${text}`);
    }
    if (res.status === 204) return null;
    return res.json();
  };
}

async function ensureMilestones(api, titles) {
  const map = new Map();
  // list existing
  let page = 1;
  const existing = [];
  while (true) {
    const data = await api(`/milestones?state=open&per_page=100&page=${page}`);
    if (!Array.isArray(data) || data.length === 0) break;
    existing.push(...data);
    page++;
  }
  for (const m of existing) map.set(m.title, m.number);
  for (const title of titles) {
    if (!map.has(title)) {
      const created = await api('/milestones', { method: 'POST', body: { title } });
      map.set(created.title, created.number);
    }
  }
  return map;
}

async function ensureLabels(api, labels) {
  // get existing labels
  let page = 1; const existing = new Set();
  while (true) {
    const data = await api(`/labels?per_page=100&page=${page}`);
    if (!Array.isArray(data) || data.length === 0) break;
    for (const l of data) existing.add(l.name);
    page++;
  }
  for (const name of labels) {
    if (!existing.has(name)) {
      await api('/labels', { method: 'POST', body: { name, color: 'FFFFFF' } });
      existing.add(name);
    }
  }
}

main().catch(err => { console.error(err.message || err); process.exit(1); });
