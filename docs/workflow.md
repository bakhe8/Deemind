# Developer Workflow

This is the current, stabilized workflow for Deemind. It reflects the upgraded pipeline (doctor, snapshots, flaky detector, roadmap sync) and links to the relevant docs.

## Branching

- main = production; develop = integration; feature/_ and hotfix/_ for work.
- Open PRs to develop; require CI green + review; squash & merge.

## Day-to-day Loop

1. Create a branch: `feature/<task>`
2. Build locally: `npm run deemind:build <theme> -- --sanitize --i18n --autofix`
   - Preview auto-launches (configurable via `configs/deemind.config.json`) and serves `/output/<theme>/`.
3. Validate & fix: `npm run deemind:doctor` (validate → fix → revalidate)
4. Optional preview rerun: `npm run deemind:preview <theme>` to spin up the live server without a full rebuild.
5. Tests:
   - Snapshots: `npm run test:snapshots`
   - Flaky detector: `npm run test:flaky`
6. Commit; pre-commit hook runs lint-staged and validator.
7. Push and open PR; CI runs full suite and posts summaries.

## CI Overview

- Workflow: `.github/workflows/build.yml`
- Stages: conflict guard → install → lint → build (demo) → tests → doctor → telemetry
- History: validation logs appended to `logs/history/`
- Agent: scheduled/manual worker in `.github/workflows/codex-agent.yml`

## Tools & Docs

- Architecture: docs/architecture.md
- Configurations: docs/configurations.md
- Validation rules: docs/validation.md
- Modules overview: docs/modules.md
- Roadmap checklist: docs/deemind_checklist.md
- README entry point: README.md

## Releases

- Merge develop → main once green; publish theme artifacts as needed.
- Release notes are auto-drafted; verify and publish.

## Notes

- Node 20 enforced (`.nvmrc`). Use `nvm use` locally.
- i18n warnings are enforced in CI via `REQUIRE_I18N=true`. Adjust per-branch if needed.
