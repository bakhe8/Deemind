# Workflows

## Weekly Status

- File: .github/workflows/weekly-status.yml
- Triggers: schedule, workflow_dispatch
- Artifacts: no
- Secrets: none
- Jobs:
  - status (runs-on: ubuntu-latest)
    • actions/checkout@v4
    • actions/setup-node@v4
    • npm ci || npm i
    • node tools/synthesize-status.js
    • Commit status

## Separation Audit (Deemind Tools)

- File: .github/workflows/separation-audit.yml
- Triggers: schedule, workflow_dispatch
- Artifacts: yes
- Secrets: none
- Jobs:
  - audit (runs-on: ubuntu-latest)
    • actions/checkout@v4
    • actions/setup-node@v4
    • node tools/separation-audit.js
    • actions/upload-artifact@v4

## Semantic Release

- File: .github/workflows/semantic-release.yml
- Triggers: workflow_dispatch, push
- Artifacts: no
- Secrets: GITHUB_TOKEN
- Jobs:
  - release (runs-on: ubuntu-latest)
    • actions/checkout@v4
    • actions/setup-node@v4
    • npm ci || npm i
    • Semantic Release

## Salla Validate & Package

- File: .github/workflows/salla-validate.yml
- Triggers: push, pull_request, workflow_dispatch
- Artifacts: yes
- Secrets: SALLA_TOKEN
- Jobs:
  - salla (runs-on: ubuntu-latest)
    • actions/checkout@v4
    • actions/setup-node@v4
    • npm ci || npm i
    • Build demo theme
    • Stylelint CSS
    • PostCSS process (autoprefix + dir pseudo)
    • Package with Salla CLI (if available)
    • Validate theme with Salla CLI (if available)
    • Upload packaged artifacts

## Salla Sync

- File: .github/workflows/salla-sync.yml
- Triggers: schedule, workflow_dispatch
- Artifacts: yes
- Secrets: GITHUB_TOKEN
- Jobs:
  - sync (runs-on: ubuntu-latest)
    • actions/checkout@v4
    • actions/setup-node@v4
    • npm ci || npm i
    • Fetch Salla docs
    • Import baseline themes (Raed/Luna/Mono)
    • Sync Salla schema
    • Schema diff and issue
    • Upload sync artifacts

## Roadmap → Issues Sync

- File: .github/workflows/roadmap-sync.yml
- Triggers: push, workflow_dispatch
- Artifacts: no
- Secrets: GITHUB_TOKEN
- Jobs:
  - sync (runs-on: ubuntu-latest)
    • actions/checkout@v4
    • actions/setup-node@v4
    • npm ci || npm i
    • node tools/sync-roadmap-to-issues.js

## Release

- File: .github/workflows/release.yml
- Triggers: push, workflow_dispatch
- Artifacts: no
- Secrets: GITHUB_TOKEN
- Jobs:
  - release (runs-on: ubuntu-latest)
    • actions/checkout@v4
    • actions/setup-node@v4
    • npm ci || npm i
    • Release

## Create GitHub Release from Notes (Deemind Tools)

- File: .github/workflows/release-from-notes.yml
- Triggers: push, workflow_dispatch
- Artifacts: no
- Secrets: GITHUB_TOKEN
- Jobs:
  - release (runs-on: ubuntu-latest)
    • actions/checkout@v4
    • actions/setup-node@v4
    • Publish Release from Notes

## PR Summary (placeholder)

- File: .github/workflows/pr-summary.yml
- Triggers: workflow_dispatch, pull_request
- Artifacts: no
- Secrets: GITHUB_TOKEN
- Jobs:
  - summarize (runs-on: ubuntu-latest)
    • actions/checkout@v4
    • Add PR summary comment

## Package Theme on Release

- File: .github/workflows/package-release.yml
- Triggers: workflow_dispatch, release
- Artifacts: no
- Secrets: GITHUB_TOKEN
- Jobs:
  - build-and-attach (runs-on: ubuntu-latest)
    • actions/checkout@v4
    • actions/setup-node@v4
    • npm ci || npm i
    • Build demo theme
    • Zip demo theme
    • Upload Release Asset

## New Theme Auto-Pipeline (Deemind Tools)

- File: .github/workflows/new-theme-auto.yml
- Triggers: push, workflow_dispatch
- Artifacts: no
- Secrets: none
- Jobs:
  - new-theme (runs-on: ubuntu-latest)
    • actions/checkout@v4
    • actions/setup-node@v4
    • npm ci || npm i
    • Build new themes and capture snapshots
    • Run snapshot tests (sanity)
    • Commit new snapshots/config

## Lint

- File: .github/workflows/lint.yml
- Triggers: workflow_dispatch, pull_request
- Artifacts: no
- Secrets: none
- Jobs:
  - lint (runs-on: ubuntu-latest)
    • actions/checkout@v4
    • actions/setup-node@v4
    • npm ci
    • npm run lint

## Lighthouse CI

- File: .github/workflows/lighthouse.yml
- Triggers: workflow_dispatch, schedule
- Artifacts: yes
- Secrets: none
- Jobs:
  - lhci (runs-on: ubuntu-latest)
    • actions/checkout@v4
    • actions/setup-node@v4
    • npm ci || npm i
    • Build sample theme
    • Run Lighthouse CI
    • Upload Lighthouse Reports

## Deploy Jekyll with GitHub Pages dependencies preinstalled

- File: .github/workflows/jekyll-gh-pages.yml
- Triggers: push, workflow_dispatch
- Artifacts: yes (pages)
- Secrets: none
- Jobs:
  - build (runs-on: ubuntu-latest)
    • Checkout
    • Setup Pages
    • Build with Jekyll
    • Upload artifact
  - deploy (runs-on: ubuntu-latest)
    • Deploy to GitHub Pages

## Deploy (optional)

- File: .github/workflows/deploy.yml
- Triggers: workflow_dispatch
- Artifacts: no
- Secrets: none
- Jobs:
  - deploy (runs-on: ubuntu-latest)
    • actions/checkout@v4
    • Build demo theme
    • npm ci
    • npm run deemind:build demo
    • Placeholder deploy step

## Create Permissions & Secrets Issue

- File: .github/workflows/create-permissions-issue.yml
- Triggers: workflow_dispatch
- Artifacts: no
- Secrets: GITHUB_TOKEN
- Jobs:
  - open-issue (runs-on: ubuntu-latest)
    • actions/checkout@v4
    • actions/setup-node@v4
    • npm ci || npm i
    • Open issue

## Codex Improvements Issue Sync (Deemind Tools)

- File: .github/workflows/create-improvements.yml
- Triggers: push, workflow_dispatch
- Artifacts: no
- Secrets: GITHUB_TOKEN
- Jobs:
  - issues (runs-on: ubuntu-latest)
    • actions/checkout@v4
    • Create improvement issues

## PR Comment Summarizer

- File: .github/workflows/comment-summarizer.yml
- Triggers: workflow_dispatch
- Artifacts: no
- Secrets: GITHUB_TOKEN, OPENAI_API_KEY
- Jobs:
  - summarize (runs-on: ubuntu-latest)
    • actions/checkout@v4
    • actions/setup-node@v4
    • npm ci
    • Summarize PR discussion

## Codex Controlled Task

- File: .github/workflows/codex-task.yml
- Triggers: workflow_dispatch
- Artifacts: no
- Secrets: none
- Jobs:
  - run (runs-on: ubuntu-latest)
    • actions/checkout@v4
    • actions/setup-node@v4
    • npm ci || npm i
    • Run Codex Task
    • Generate Theme Screenshots
    • Refresh Harmony Summary

## Codex Harmony Validation (Deemind Tools)

- File: .github/workflows/codex-harmony.yml
- Triggers: schedule, push, pull_request, workflow_dispatch
- Artifacts: yes
- Secrets: OPENAI_API_KEY
- Jobs:
  - harmony-check (runs-on: ubuntu-latest)
    • actions/checkout@v4
    • actions/setup-node@v4
    • npm ci || npm i
    • Build & Validate
    • Salla Schema & Baseline Drift Checks
    • Enforce Salla Drift Thresholds
    • Run Codex Harmony Check
    • Enforce Harmony Threshold
    • Upload Harmony Report

## Codex Full Assessment (Deemind Tools)

- File: .github/workflows/codex-full-assessment.yml
- Triggers: schedule, workflow_dispatch
- Artifacts: yes
- Secrets: OPENAI_API_KEY
- Jobs:
  - audit (runs-on: ubuntu-latest)
    • actions/checkout@v4
    • actions/setup-node@v4
    • npm ci || npm i
    • Run Full Assessment
    • Upload Report

## Codex Deep Evaluation (Deemind Tools)

- File: .github/workflows/codex-auto-eval.yml
- Triggers: schedule, workflow_dispatch
- Artifacts: yes
- Secrets: OPENAI_API_KEY, GITHUB_TOKEN
- Jobs:
  - evaluate (runs-on: ubuntu-latest)
    • actions/checkout@v4
    • actions/setup-node@v4
    • Install deps
    • Run Doctor (validate → fix → revalidate)
    • Flaky detector
    • ESLint JSON report
    • Codex Auto Evaluation
    • Upload Reports
    • Prepare auto-apply branch
    • Auto-apply trivial suggestions
    • Commit auto-applied changes (if any)
    • Open PR for auto-applied suggestions

## Codex Auto-Docs (Deemind Tools)

- File: .github/workflows/codex-auto-docs.yml
- Triggers: push, schedule, workflow_dispatch
- Artifacts: no
- Secrets: OPENAI_API_KEY
- Jobs:
  - docs (runs-on: ubuntu-latest)
    • actions/checkout@v4
    • actions/setup-node@v4
    • npm ci || npm i
    • Generate repository documentation
    • Commit docs (if changed)

## codex-agent.yml

- File: .github/workflows/codex-agent.yml
- Triggers: n/a
- Artifacts: no
- Secrets: OPENAI_API_KEY, GITHUB_TOKEN
- Jobs:

## codex-agent-manual.yml

- File: .github/workflows/codex-agent-manual.yml
- Triggers: n/a
- Artifacts: no
- Secrets: OPENAI_API_KEY, GITHUB_TOKEN
- Jobs:

## CodeQL

- File: .github/workflows/codeql.yml
- Triggers: workflow_dispatch, push, pull_request, schedule
- Artifacts: no
- Secrets: none
- Jobs:
  - analyze (runs-on: ubuntu-latest)
    • Checkout repository
    • Initialize CodeQL
    • Autobuild
    • Perform CodeQL Analysis

## Coverage

- File: .github/workflows/codecov.yml
- Triggers: workflow_dispatch, push, pull_request
- Artifacts: no
- Secrets: none
- Jobs:
  - coverage (runs-on: ubuntu-latest)
    • actions/checkout@v4
    • actions/setup-node@v4
    • npm ci
    • npm run deemind:build demo
    • npm run coverage
    • Upload coverage to Codecov

## Code Hygiene

- File: .github/workflows/code-hygiene.yml
- Triggers: push, pull_request, workflow_dispatch
- Artifacts: yes
- Secrets: GITHUB_TOKEN
- Jobs:
  - hygiene (runs-on: ubuntu-latest)
    • actions/checkout@v4
    • actions/setup-node@v4
    • npm ci
    • Run audits
    • Salla schema validate
    • Salla schema diff (demo)
    • Mockup pre-validation (all)
    • Twig lint (gate on demo)
    • Screenshots (optional)
    • Mockup screenshot (optional)
    • Visual regression (optional)
    • Enforce visual gate

## CI (Deemind Core)

- File: .github/workflows/build.yml
- Triggers: workflow_dispatch, push, pull_request
- Artifacts: yes
- Secrets: GITHUB_TOKEN
- Jobs:
  - build (runs-on: ubuntu-latest)
    • actions/checkout@v4
    • actions/setup-node@v4
    • Cache node modules
    • Conflict Markers Check
    • Enforce Core/Tools domain boundary
    • npm ci
    • npm run lint
    • Build all themes in parallel
    • Validate theme.json against Salla schema
    • Madge cycle gate
    • Static analysis (cycles, unused deps)
    • Upload static analysis

## Auto-merge codex-trivial PRs

- File: .github/workflows/auto-merge-trivial.yml
- Triggers: workflow_dispatch, pull_request
- Artifacts: no
- Secrets: none
- Jobs:
  - automerge (runs-on: ubuntu-latest)
    • actions/checkout@v4
    • Merge PR

## Auto Label Issues

- File: .github/workflows/auto-labeler.yml
- Triggers: workflow_dispatch, issues
- Artifacts: no
- Secrets: GITHUB_TOKEN
- Jobs:
  - label (runs-on: ubuntu-latest)
    • actions/labeler@v5

## AI Docs (stub)

- File: .github/workflows/ai-docs.yml
- Triggers: workflow_dispatch, pull_request
- Artifacts: yes
- Secrets: none
- Jobs:
  - draft-docs (runs-on: ubuntu-latest)
    • actions/checkout@v4
    • Draft docs summary
    • Upload artifact

## Actions Digest

- File: .github/workflows/actions-digest.yml
- Triggers: workflow_dispatch, workflow_run
- Artifacts: no
- Secrets: GITHUB_TOKEN
- Jobs:
  - summarize (runs-on: ubuntu-latest)
    • actions/checkout@v4
    • actions/setup-node@v4
    • Generate actions digest
    • Append latest digest to job summary
    • Comment digest on PR (if exists for this SHA)
