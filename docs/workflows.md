# Workflows

## Weekly Status

- File: .github\workflows\weekly-status.yml
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

## Semantic Release

- File: .github\workflows\semantic-release.yml
- Triggers: push
- Artifacts: no
- Secrets: GITHUB_TOKEN
- Jobs:
  - release (runs-on: ubuntu-latest)
    • actions/checkout@v4
    • actions/setup-node@v4
    • npm ci || npm i
    • Semantic Release

## Roadmap → Issues Sync

- File: .github\workflows\roadmap-sync.yml
- Triggers: push, workflow_dispatch
- Artifacts: no
- Secrets: GITHUB_TOKEN
- Jobs:
  - sync (runs-on: ubuntu-latest)
    • actions/checkout@v4
    • actions/setup-node@v4
    • npm ci || npm i
    • node tools/sync-roadmap-to-issues.js

## Release Drafter

- File: .github\workflows\release.yml
- Triggers: push, pull_request
- Artifacts: no
- Secrets: GITHUB_TOKEN
- Jobs:
  - update_release_draft (runs-on: ubuntu-latest)
    • actions/checkout@v4
    • release-drafter/release-drafter@v6

## PR Summary (placeholder)

- File: .github\workflows\pr-summary.yml
- Triggers: pull_request
- Artifacts: no
- Secrets: GITHUB_TOKEN
- Jobs:
  - summarize (runs-on: ubuntu-latest)
    • actions/checkout@v4
    • Add PR summary comment

## Package Theme on Release

- File: .github\workflows\package-release.yml
- Triggers: release
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

## Lint

- File: .github\workflows\lint.yml
- Triggers: pull_request, push
- Artifacts: no
- Secrets: none
- Jobs:
  - lint (runs-on: ubuntu-latest)
    • actions/checkout@v4
    • actions/setup-node@v4
    • npm ci
    • npm run lint

## Deploy Jekyll with GitHub Pages dependencies preinstalled

- File: .github\workflows\jekyll-gh-pages.yml
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

- File: .github\workflows\deploy.yml
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

## PR Comment Summarizer

- File: .github\workflows\comment-summarizer.yml
- Triggers: workflow_dispatch
- Artifacts: no
- Secrets: GITHUB_TOKEN, OPENAI_API_KEY
- Jobs:
  - summarize (runs-on: ubuntu-latest)
    • actions/checkout@v4
    • actions/setup-node@v4
    • npm ci
    • Summarize PR discussion

## Codex Deep Evaluation

- File: .github\workflows\codex-auto-eval.yml
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

## Codex Auto-Docs

- File: .github\workflows\codex-auto-docs.yml
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

- File: .github\workflows\codex-agent.yml
- Triggers: n/a
- Artifacts: no
- Secrets: OPENAI_API_KEY, GITHUB_TOKEN
- Jobs:

## CodeQL

- File: .github\workflows\codeql.yml
- Triggers: push, pull_request, schedule
- Artifacts: no
- Secrets: none
- Jobs:
  - analyze (runs-on: ubuntu-latest)
    • Checkout repository
    • Initialize CodeQL
    • Autobuild
    • Perform CodeQL Analysis

## Coverage

- File: .github\workflows\codecov.yml
- Triggers: push, pull_request
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

## Deemind CI

- File: .github\workflows\build.yml
- Triggers: push, pull_request
- Artifacts: yes
- Secrets: GITHUB_TOKEN
- Jobs:
  - build (runs-on: ubuntu-latest)
    • actions/checkout@v4
    • actions/setup-node@v4
    • Cache node modules
    • Conflict Markers Check
    • npm ci
    • npm run lint
    • npm run deemind:build demo -- --sanitize --i18n --autofix
    • npm run deemind:test
    • Package demo theme (zip)
    • Upload packaged theme
    • Deemind doctor (validate → fix → revalidate)
    • Append validation log to history

## Auto Label Issues

- File: .github\workflows\auto-labeler.yml
- Triggers: issues
- Artifacts: no
- Secrets: GITHUB_TOKEN
- Jobs:
  - label (runs-on: ubuntu-latest)
    • actions/labeler@v5

## AI Docs (stub)

- File: .github\workflows\ai-docs.yml
- Triggers: pull_request
- Artifacts: yes
- Secrets: none
- Jobs:
  - draft-docs (runs-on: ubuntu-latest)
    • actions/checkout@v4
    • Draft docs summary
    • Upload artifact

## Actions Digest

- File: .github\workflows\actions-digest.yml
- Triggers: workflow_run
- Artifacts: no
- Secrets: GITHUB_TOKEN
- Jobs:
  - summarize (runs-on: ubuntu-latest)
    • actions/checkout@v4
    • actions/setup-node@v4
    • Generate actions digest
    • Append latest digest to job summary
    • Comment digest on PR (if exists for this SHA)
