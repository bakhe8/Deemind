# 🧭 Codex Task Taxonomy — Controlled Collaboration Mode

## 🎯 Purpose
Define all valid, isolated tasks that Codex can execute in collaboration with Deemind.  
Each task has:
- a clear purpose  
- a defined CLI command  
- specific outputs and reports  
- no side effects outside its scope  

Codex must only execute tasks listed here.  
All other actions require explicit human approval.

---

## 🧱 1️⃣ Build & Validation Tasks

| Task | Description | Command | Output |
|------|--------------|----------|---------|
| **codex:build** | Build one or all Deemind themes from `/input/` → `/output/`. | `npm run deemind:build <theme>` | `/reports/build-<theme>.md` |
| **codex:validate** | Run schema, token, and structure validation for a theme. | `npm run deemind:validate <theme>` | `/reports/validate-<theme>.md` |
| **codex:test** | Execute test fixtures and snapshot comparison for all builds. | `npm run deemind:test` | `/reports/test-results.md` |
| **codex:doctor** | Deep validator (schema, structure, assets, encoding). | `npm run deemind:doctor` | `/reports/doctor-report.md` |
| **codex:harmony** | Run Harmony scoring across all themes and modules, then refresh summary JSON. | `npm run deemind:harmony && npm run codex:update-harmony` | `/reports/harmony-summary.md` + `/reports/harmony-summary.json` |

---

## 🧩 2️⃣ Mock-Up & Design Tasks

| Task | Description | Command | Output |
|------|--------------|----------|---------|
| **codex:mockup** | Generate or update mock-ups for a new theme. | `npm run deemind:mockup <theme>` | `/mockups/<theme>/` + `/reports/mockup-<theme>.md` |
| **codex:mockup:validate** | Run HTML/CSS lint and Harmony pre-score for mock-ups. | `npm run deemind:mockup:validate` | `/reports/mockup-validation.json` |
| **codex:mockup:promote** | Promote approved mock-ups → `/input/` for theme generation. | `npm run deemind:mockup:promote <theme>` | `/logs/mockup-promotion.log` |

---

## 🧠 3️⃣ Analysis & Auditing Tasks

| Task | Description | Command | Output |
|------|--------------|----------|---------|
| **codex:audit:deps** | Check for unused, outdated, or cyclic dependencies. | `npm run audit:deps` or `npx depcheck` | `/reports/dependency-audit.md` |
| **codex:audit:lint** | Run lint, stylelint, and html-validate checks. | `npm run lint:all` | `/reports/lint-summary.md` |
| **codex:audit:security** | Perform npm audit and record vulnerable packages. | `npm audit --json` | `/reports/security-audit.json` |
| **codex:audit:structure** | Validate file hierarchy and Deemind module linkage. | `node tools/validate-structure.js` | `/reports/structure-audit.md` |
| **codex:audit:performance** | Run Lighthouse audit on preview builds. | `lhci autorun` | `/reports/lighthouse/<theme>.html` |

---

## ⚙️ 4️⃣ Packaging & Release Tasks

| Task | Description | Command | Output |
|------|--------------|----------|---------|
| **codex:package** | Bundle validated theme into `.zip` for deployment. | `npm run deemind:package <theme>` | `/output/<theme>.zip` |
| **codex:release:draft** | Create a draft release via semantic-release. | `npm run release:draft` | GitHub draft release |
| **codex:release:publish** | Publish approved draft to GitHub Releases. | `npm run release:publish` | Live release entry |
| **codex:salla:validate** | Validate build using Salla CLI. | `salla validate --token $SALLA_TOKEN` | `/reports/salla-validate.md` |
| **codex:salla:push** | Push zip to Salla store (if approved). | `salla push --token $SALLA_TOKEN` | `/reports/salla-push.log` |

---

## 🧰 5️⃣ Maintenance & Sync Tasks

| Task | Description | Command | Output |
|------|--------------|----------|---------|
| **codex:sync:schema** | Fetch latest Salla schema and update configs. | `node tools/sync-schema.js` | `/configs/salla-schema.json` |
| **codex:sync:tokens** | Update design tokens and regenerate diffs. | `node tools/sync-tokens.js` | `/configs/design-tokens.json` |
| **codex:sync:baseline** | Sync with Raed or Luna reference themes. | `node tools/sync-baseline.js` | `/reports/baseline-sync.md` |
| **codex:clean** | Purge old builds, logs, and cache. | `npm run clean` | `/logs/cleanup.log` |

---

## 🧩 6️⃣ Intelligence & Documentation Tasks

| Task | Description | Command | Output |
|------|--------------|----------|---------|
| **codex:doc:update** | Regenerate documentation using auto-docs. | `npm run docs:generate` | `/docs/` updated |
| **codex:doc:validate** | Check for dead links or missing references. | `node tools/validate-docs.js` | `/reports/docs-validation.md` |
| **codex:summary** | Summarize last run results (Harmony, build, audit). | `node tools/summarize-last-task.js` | `/reports/summary-latest.md` |
| **codex:report:trend** | Generate historical metrics trend line. | `node tools/trend-report.js` | `/reports/harmony-trends.md` |

---

## 🧩 7️⃣ Optional Experimental Tasks

| Task | Description | Command | Output |
|------|--------------|----------|---------|
| **codex:ai:assist** | Suggest refactors or improvements (AI-assist). | `node tools/codex-ai.js` | `/reports/ai-suggestions.md` |
| **codex:visual:diff** | Compare mock-up vs build screenshots. | `node tools/visual-regression.js` | `/reports/visual/diff-results.md` |
| **codex:visual:preview** | Generate visual screenshots for PR comments. | `node tools/screenshot-pages.js` | `/reports/visual/<theme>/` |

---

## 🧱 8️⃣ Task Lifecycle Summary

1. **Trigger** — Command (manual or workflow_dispatch)  
2. **Execute** — Run isolated task  
3. **Report** — Generate output in `/reports/`  
4. **Log** — Append task summary in `/logs/codex-tasks.json`  
5. **Wait** — Idle until next instruction  

---

## 🧠 Best Practice

- Each task = one CLI call  
- No chained actions inside Codex (that’s Deemind’s job)  
- Codex *never edits code*, only executes, analyzes, or packages  
- All results must be reproducible via manual CLI command  

---

> **Instruction to Codex:**  
> Use this taxonomy as your command library.  
> Accept only these task names, execute them in isolation, log results, and await next explicit request.  
> All builds, tests, and validations must go through the Deemind engine.

After each successful task, refresh the dashboard by executing:

```
npm run codex:update-dashboard
```

🔄 Optional Additions

If you want, I can also generate:

- A CLI alias map (tools/codex-task-map.js) — so you can just type codex run build demo
- A Markdown task launcher for your GitHub README (so contributors can click “Run Build” or “Run Validate”)
