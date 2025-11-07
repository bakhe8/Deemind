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

* Imports: fs-extra, path, chalk, url, ./tools/deemind-parser/hybrid-runner.js, ./tools/deemind-parser/semantic-mapper.js, ./tools/adapter.js, ./tools/validator.js, ./tools/validator-extended.js, ./tools/partials-prune.js …

## tools\validator.js

/\*\*

- Core validator focused on structure and minimal Twig hygiene.
- Why: Run a fast, low‑noise gate before deeper checks to keep the
- main CLI responsive; extended checks run in a separate pass.
  \*/

* Exports: validateTheme, generateBuildManifest
* Imports: fs-extra, path, glob, crypto

## tools\validator-extended.js

/\*\*

- DEEMIND — THEMING ENGINE — Extended Validator
- Adds deep checks for encoding, assets, translation, cycles, and budgets.
  \*/

* Exports: validateExtended
* Imports: fs-extra, path, glob, crypto

## tools\update-telemetry.js

- Imports: fs-extra, path

## tools\update-knowledge-from-reports.js

- Imports: fs, path

## tools\synthesize-status.js

- Imports: fs-extra, path

## tools\sync-roadmap-to-issues.js

- Imports: fs, octokit

## tools\run-all-workflows.js

- Imports: fs, path, child_process

## tools\partials-prune.js

- Exports: prunePartials
- Imports: fs-extra, path, glob

## tools\open-pr.js

- Imports: child_process, fs, path, octokit

## tools\normalize-css-assets.js

- Exports: normalizeCssAssets
- Imports: fs-extra, path

## tools\monitor-actions.js

- Imports: child_process, fs, path

## tools\import-raed-baseline.js

- Imports: fs, path

## tools\flaky-detector.js

- Imports: fs-extra, path

## tools\fixit-runner.js

- Imports: path, fs-extra

## tools\fix-missing-assets.js

/\*\*

- Why: Extended validator often flags missing-assets when prototypes reference
- images that weren’t copied or normalized. For fast iteration, we create
- placeholder files in output/assets/normalized so validation can proceed
- deterministically. Real assets should be supplied later by the theme owner.
  \*/

* Exports: fixMissingAssets
* Imports: fs-extra, path

## tools\fetch-salla-docs.js

- Imports: fs, path

## tools\doctor.js

- Imports: fs-extra, path, child_process, octokit

## tools\delivery-pipeline.js

/\*\*

- Zip a built theme into archives/ with a timestamped name.
- Why: Provides deterministic packaging and a breadcrumb (last-success.txt)
- for quick retrieval and handoff.
  \*/

* Exports: archiveTheme
* Imports: fs-extra, path, archiver

## tools\deemind-agent.js

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

## tools\create-issues.js

- Imports: fs, path, node:child_process

## tools\comment-summarizer.js

- Imports: octokit, openai

## tools\codex-auto-eval.js

/\*\*

- Codex Auto-Evaluation Entrypoint
- - Reads latest validation log and ESLint JSON
- - Calls OpenAI to propose improvements
- - Writes suggestions and a human-readable summary under /reports
    \*/

* Imports: fs, path

## tools\codex-auto-docs.js

/\*\*

- Codex Auto-Docs Generator
- Scans workflows, tools, and core modules to generate useful Markdown docs.
- - Generates docs/workflows.md (triggers, jobs, steps, artifacts, secrets)
- - Generates docs/modules.md (purpose, main functions, inputs/outputs)
- - Updates README.md with a 📚 Documentation Index linking all docs/\*.md
- Uses OPENAI_API_KEY optionally to enhance summaries; otherwise, derives from code.
  \*/

* Imports: fs, path, glob, yaml

## tools\codex-apply-suggestions.js

- Imports: fs, path

## tools\close-open-issues.js

## tools\check-conflicts.js

- Imports: child_process, fs

## tools\build-tracker.js

- Exports: generateBuildManifest
- Imports: fs-extra, path, crypto

## tools\build-all.js

- Imports: fs-extra, path, node:child_process

## tools\baseline-compare.js

- Exports: loadBaselineSet, computeComponentUsage
- Imports: fs-extra, path, glob

## tools\adapter.js

- Exports: adaptToSalla
- Imports: fs-extra, path

## tools\adapter-salla.js

- Exports: adaptToSalla
- Imports: fs-extra, path

## tools\deemind-parser\semantic-mapper.js

- Exports: mapSemantics
- Imports: fs-extra, path, cheerio

## tools\deemind-parser\parser.js

/\*\*

- Parse an input folder of HTML files into normalized page objects.
- Why: We standardize encoding/line endings up front and enforce a
- timeout and maxBytes quarantine so a single bad file cannot crash
- the pipeline; quarantined files are copied to \_failed/ for review.
  \*/

* Exports: parseFolder
* Imports: fs-extra, path, glob, p-limit, cheerio

## tools\deemind-parser\js-extractor.js

- Exports: extractInlineJs

## tools\deemind-parser\hybrid-runner.js

- Exports: runHybridParser
- Imports: fs-extra, path, crypto, ./parser.js, ./conflict-detector.js, ./css-parser.js, ./js-extractor.js

## tools\deemind-parser\css-parser.js

- Exports: extractCssMap
- Imports: fs-extra, path, postcss

## tools\deemind-parser\conflict-detector.js

/\*\*

- Detect simple conflicts across pages.
- Why: Duplicate basenames often hide divergent versions of the same
- page (platform reviewers dislike this), and empty files pass silently
- unless we flag them here for early correction.
  \*/

* Exports: detectConflicts
