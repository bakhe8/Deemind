# Modules

## cli.js

/\*\*

- 🧠 Deemind — Intelligent Theming Engine
- ***
- Converts static HTML prototypes in /input/<themeName>
- into validated, platform-ready Salla themes in /output/<themeName>.
-
- Run:
- npm run deemind:build demo
  \*/

* Imports: fs-extra, path, chalk, url, ./src/deemind-parser/hybrid-runner.js, ./src/deemind-parser/semantic-mapper.js, ./src/adapter.js, ./src/validator.js, ./tools/validator-extended.js, ./tools/partials-prune.js …

## tools/watch-new-themes.js

/\*\*

- @domain DeemindTools
- Purpose: Watch input/ for newly created theme folders and automatically run
-          the new-theme pipeline (build → i18n wrap → validate → snapshot).
  \*/

* Imports: fs, fs-extra, path, child_process

## tools/visual-regression.js

- Imports: fs-extra, path

## tools/validator-extended.js

/\*\*

- DEEMIND — THEMING ENGINE — Extended Validator
- Adds deep checks for encoding, assets, translation, cycles, and budgets.
  \*/

* Exports: validateExtended
* Imports: fs-extra, path, glob, crypto

## tools/validate-theme-schema.js

- Imports: fs-extra, path, ajv

## tools/validate-salla.js

- Imports: fs-extra, path, child_process

## tools/validate-salla-assets.js

- Exports: validateSallaAssets
- Imports: fs-extra, path, image-size

## tools/update-telemetry.js

- Imports: fs-extra, path

## tools/update-knowledge-from-reports.js

- Imports: fs, path

## tools/update-harmony-summary.js

- Imports: fs-extra, path

## tools/update-dashboard.js

- Imports: fs-extra, path

## tools/twig-validate.js

- Imports: fs-extra, path

## tools/twig-lint.js

- Imports: fs-extra, path

## tools/synthesize-status.js

- Imports: fs-extra, path

## tools/sync-roadmap-to-issues.js

- Imports: fs, octokit

## tools/separation-audit.js

- Imports: fs, path

## tools/screenshot-pages.js

- Imports: fs, path, puppeteer

## tools/screenshot-mockup.js

- Imports: fs-extra, path

## tools/salla-schema-sync.js

- Imports: fs-extra, path

## tools/salla-schema-diff.js

- Imports: fs-extra, path

## tools/salla-demo-compare.js

- Imports: fs-extra, path

## tools/salla-cli.js

- Imports: child_process, path

## tools/run-codex-task.js

- Imports: child_process, fs-extra, path

## tools/run-all-workflows.js

- Imports: fs, path, child_process

## tools/report-salla-assets.js

- Imports: fs-extra, path, ./validate-salla-assets.js

## tools/publish-release-from-notes.js

- Imports: fs, child_process, path, octokit

## tools/promote-mockup.js

- Imports: fs-extra, path

## tools/postcss-process.js

- Imports: fs-extra, path, postcss, autoprefixer, postcss-dir-pseudo-class

## tools/partials-prune.js

- Exports: prunePartials
- Imports: fs-extra, path, glob

## tools/open-schema-drift-issue.js

- Imports: fs-extra, path, octokit

## tools/open-pr.js

- Imports: child_process, fs, path, octokit

## tools/normalize-css-assets.js

/\*_/_.css and rewrites url(...) to assets/normalized/_ paths,
// copying missing referenced files from the input tree when possible.
export async function normalizeCssAssets({ outputPath, inputPath }) {
const cssDir = path.join(outputPath, 'assets');
const files = await listFiles(cssDir, '.css');
const cacheFile = path.join(process.cwd(), '.factory-cache', 'css-normalize.json');
await fs.ensureDir(path.dirname(cacheFile));
let cache = {};
try { cache = await fs.readJson(cacheFile); } catch (e) { /_ ignore \*/

- Exports: normalizeCssAssets
- Imports: fs-extra, path, crypto

## tools/new-theme-pipeline.js

- Imports: fs-extra, path, child_process

## tools/monitor-actions.js

- Imports: child_process, fs, path

## tools/mockup-validate.js

- Imports: fs-extra, path

## tools/mockup-generator.js

- Imports: fs-extra, path

## tools/import-salla-baselines.js

- Imports: child_process, fs-extra, path

## tools/import-raed-baseline.js

- Imports: fs, path

## tools/flaky-detector.js

- Imports: fs-extra, path

## tools/fixit-runner.js

- Imports: path, fs-extra

## Preview & Dashboard

- `tools/preview-prep.js` – inventories generated pages, writes `.preview.json`, and stores preview timestamps/urls.
- `tools/preview-server.js` – chooses a free port, passes livereload flags, and spawns `server/preview.js`.
- `server/preview.js` – Express + Twig preview host (routes `/`, `/pages`, `/page/*`).
- `service/server.ts` – API powering the dashboard (themes, reports, preview status, baseline metrics, log streaming).
- `dashboard/src/pages/*` – React pages (Upload, Parser, Adapter, Validation, Reports, Settings).
- `dashboard/src/components/*` – shared UI (log viewer, diff viewer, stats cards, pipeline overview, charts).
- `docs/dashboard.md` – reference for endpoints, run commands, and page responsibilities.

## tools/fix-missing-assets.js

/\*\*

- Why: Extended validator often flags missing-assets when prototypes reference
- images that weren’t copied or normalized. For fast iteration, we create
- placeholder files in output/assets/normalized so validation can proceed
- deterministically. Real assets should be supplied later by the theme owner.
  \*/

* Exports: fixMissingAssets
* Imports: fs-extra, path

## tools/fix-inline-handlers.js

- Exports: fixInlineHandlers
- Imports: fs-extra, path

## tools/fix-i18n-output.js

- Imports: fs-extra, path, ../configs/constants.js

## tools/fetch-salla-docs.js

- Imports: fs, path

## tools/enforce-visual-gate.js

- Imports: fs-extra, path

## tools/enforce-salla-gates.js

- Imports: fs-extra, path

## tools/doctor.js

- Imports: fs-extra, path, child_process, octokit

## tools/delivery-pipeline.js

/\*\*

- Zip a built theme into archives/ with a timestamped name.
- Why: Provides deterministic packaging and a breadcrumb (last-success.txt)
- for quick retrieval and handoff.
  \*/

* Exports: archiveTheme
* Imports: fs-extra, path, archiver

## tools/deemind-agent.js

/\*\*

- Deemind Autonomous Agent
- ***
- Full implementation of self-managing GPT Codex loop.
-
- Capabilities:
- 1.  Read /docs/deemind_checklist.md
- 2.  Analyze repo for missing/partial tasks
- 3.  Create issues for missing features
- 4.  Implement missing logic using Codex (OpenAI API)
- 5.  Run validation command
- 6.  Commit + push changes
- 7.  Close resolved issues
-
- Requirements:
- - Node >= 20
- - OPENAI_API_KEY and GITHUB_TOKEN set in env or repo secrets
    \*/

* Imports: fs, path, child_process, octokit, openai

## tools/dashboard-open.js

- Imports: path, child_process, url

## tools/css-token-diff.js

- Imports: fs-extra, path

## tools/create-permissions-secrets-issue.js

- Imports: fs-extra, path, octokit

## tools/create-new-theme-directive-issue.js

- Imports: fs-extra, path, octokit

## tools/create-issues.js

- Imports: fs, path, node:child_process

## tools/create-improvement-issues.js

- Imports: fs, octokit

## tools/create-customization-directive-issue.js

- Imports: fs-extra, path, url, octokit

## tools/compare-to-raed-structure.js

- Imports: fs-extra, path

## tools/comment-summarizer.js

- Imports: octokit, openai

## tools/codex-harmony-check.js

- Imports: fs, path, child_process

## tools/codex-full-assessment.js

- Imports: fs, path, child_process

## tools/codex-deep-reeval.js

- Imports: fs-extra, path, child_process, ajv

## tools/codex-autopilot.js

/\*\*

- Codex Autopilot — runs Deemind directives locally without GitHub Actions.
-
- Responsibilities:
- - Load .env values (optional) for OPENAI / Salla / GitHub tokens.
- - Read codex-directives/\*.md in sorted order.
- - Map each directive to a set of local commands (npm/node scripts).
- - Execute commands sequentially, logging results to /logs and /reports.
- - Auto-commit and push if everything succeeds (optional).
    \*/

* Imports: fs-extra, path, child_process

## tools/codex-auto-eval.js

/\*\*

- Codex Auto-Evaluation Entrypoint
- - Reads latest validation log and ESLint JSON
- - Calls OpenAI to propose improvements
- - Writes suggestions and a human-readable summary under /reports
    \*/

* Imports: fs, path

## tools/codex-auto-docs.js

/\*\*

- Codex Auto-Docs Generator
- Scans workflows, tools, and core modules to generate useful Markdown docs.
- - Generates docs/workflows.md (triggers, jobs, steps, artifacts, secrets)
- - Generates docs/modules.md (purpose, main functions, inputs/outputs)
- - Updates README.md with a 📚 Documentation Index linking all docs/\*.md
- Uses OPENAI_API_KEY optionally to enhance summaries; otherwise, derives from code.
  \*/

* Imports: fs, path, glob, yaml

## tools/codex-apply-suggestions.js

- Imports: fs, path

## tools/close-open-issues.js

## tools/check-domain-boundary.js

- Imports: fs, path

## tools/check-conflicts.js

- Imports: child_process, fs

## tools/build-tracker.js

- Exports: generateBuildManifest
- Imports: fs-extra, path, crypto

## tools/build-all.js

- Imports: fs-extra, path, node:child_process

## tools/baseline-compare.js

- Exports: loadBaselineSet, computeComponentUsage
- Imports: fs-extra, path, glob

## tools/adapter.js

/\*\*

- Canonical Salla adapter entry point.
- Re-export the implementation that now lives under src/ so tools can keep stable paths.
  \*/

* Imports: ../src/adapter.js

## tools/adapter-salla.js

/\*\*

- Thin compatibility wrapper. The canonical Salla adapter now lives in tools/adapter.js.
- Import and re-export here to avoid duplication and keep older imports working.
  \*/

* Imports: ./adapter.js

## tools/build/test-coverage-scan.js

/\*\*

- @domain DeemindTools
- Naive coverage helper: list exported functions/classes without tests and stub pending tests.
  \*/

* Imports: fs, path

## tools/build/static-analysis.js

- Imports: child_process, fs-extra, path

## tools/build/modules-docgen.js

/\*\*

- @domain DeemindTools
- Generates docs/modules.md with a map of files → exported symbols.
  \*/

* Imports: fs, path

## tools/build/duplication-scan.js

/\*\*

- @domain DeemindTools
- Scans JS files for exact and near-duplicate functions/files.
- Produces reports/duplication-map.md
  \*/

* Imports: fs, path, crypto

## tools/build/architecture-graph.js

/\*\*

- @domain DeemindTools
- Builds a lightweight dependency graph (adjacency) and writes reports/architecture-graph.md.
  \*/

* Imports: fs, path
