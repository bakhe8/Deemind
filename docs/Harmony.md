# Harmony Engine — Reference

Harmony enforces cross-module coherence across Deemind.

## What Harmony Checks

- Canonical ↔ Adapter schema alignment (fields, types, required keys)
- Cross-dependency health (missing/duplicated/unused)
- Workflow ↔ Tool consistency (scripts referenced by workflows exist)
- Docs ↔ Code parity (paths and commands referenced exist)

## Scoring

- 0–100 based on:
  - Build consistency (20)
  - Dependency/Import integrity (30)
  - Workflow/Tool coherence (25)
  - Adapter/Schema alignment (25)

## Artifacts

- Report: `logs/codex-harmony-report.md`
- Score history: `logs/harmony-score.json`
- Initial snapshot: `reports/harmony/initial-harmony-validation.md`

## Repair Policy

- Minor issues: auto-create tasks in `codex-tasks.json`
- Moderate/Critical: open PR with label `codex-harmony-fix`; merge when CI passes (auto-merge if labeled `codex-trivial`)

## CI Integration

- `.github/workflows/codex-harmony.yml` runs on push/PR and schedule; fails if score < 90.
