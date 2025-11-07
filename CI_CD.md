# CI/CD Overview — Deemind

This repo uses GitHub Actions to build, validate, evaluate, and package themes.

## Workflows

- Deemind CI (`.github/workflows/build.yml`)
  - Trigger: push, pull_request
  - Tasks: install, lint, build demo, tests (fixtures/snapshots/CSS), doctor, flaky, telemetry
  - Artifacts: telemetry, logs, demo-theme.zip

- Lint (`.github/workflows/lint.yml`)
  - Trigger: push (main, develop), pull_request
  - Tasks: eslint

- Codex Deep Evaluation (`.github/workflows/codex-auto-eval.yml`)
  - Trigger: schedule (weekly), workflow_dispatch
  - Tasks: doctor, flaky, ESLint JSON, OpenAI suggestions, auto-apply trivial fixes, open PR
  - Outputs: reports/codex-_.md/json/patch, logs/_
  - Secrets: OPENAI_API_KEY

- Deemind Codex Agent (`.github/workflows/codex-agent.yml`)
  - Trigger: schedule (6h), workflow_dispatch
  - Tasks: autonomous audit/implementation
  - Secrets: OPENAI_API_KEY, GITHUB_TOKEN

- Actions Digest (`.github/workflows/actions-digest.yml`)
  - Trigger: workflow_run (CI, Codex Eval, Codex Agent)
  - Tasks: generate digest, append to summary, comment on PR

- Semantic Release (`.github/workflows/semantic-release.yml`)
  - Trigger: push to main
  - Tasks: semantic-release (conventional commits)
  - Effects: version bump in package.json, tag, GitHub Release with assets

- Package on Release (`.github/workflows/package-release.yml`)
  - Trigger: release published
  - Tasks: build demo, zip, attach to GitHub Release

- Roadmap → Issues Sync (`.github/workflows/roadmap-sync.yml`)
  - Trigger: push to docs/deemind_checklist.md, workflow_dispatch
  - Tasks: create/update issues & add to project

- Weekly Status (`.github/workflows/weekly-status.yml`)
  - Trigger: schedule (weekly), workflow_dispatch
  - Tasks: generate docs/status; auto-commit

- CodeQL, Codecov, PR helpers

## Secrets & Credentials

- GITHUB_TOKEN (built-in): used for commits, PRs, releases
- OPENAI_API_KEY: required for Codex eval/agent
- CODECOV_TOKEN: set if repo is private and Codecov requires it

Configure under GitHub → Settings → Secrets and variables → Actions.

## Versioning & Releases

- Conventional commits recommended (feat:, fix:, chore:, docs:)
- `semantic-release` computes next version and publishes GitHub Releases
- Changelog is updated in CHANGELOG.md and committed back to main

## Packaging

- CI produces demo zip artifact
- On release, a versioned zip is attached to the GitHub Release

## Environments

- Node.js 20 across workflows
- Caching for dependencies

## Integration

- Roadmap sync -> issues/projects
- Digest on workflow completion -> PR comments
- Codex evaluation loop -> auto PRs with suggestions

## How to Run Locally

- Build: `npm run deemind:build demo -- --sanitize --i18n`
- Doctor: `npm run deemind:doctor`
- Snapshots: `npm run test:snapshots`
- Flaky: `npm run test:flaky`
- Trigger all workflows: `node tools/run-all-workflows.js` (push-based; set GITHUB_TOKEN for dispatch)
