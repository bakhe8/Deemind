# Deemind Tools

Deemind Tools is the automation ecosystem around the Deemind engine. It includes:

- Codex Agent (self-driven evaluation, summaries, improvement PRs)
- Validators (core + extended), doctor, snapshots + flaky detector
- Packaging (Salla CLI wrapper) and static analysis
- CI/CD workflows (build, package, docs, evaluations, digests)

Key paths

- `tools/` — scripts and helpers (agent, validators, adapters, salla-cli, postcss, static-analysis)
- `.github/workflows/` — CI pipelines
- `reports/` — generated reports (assessment, static-analysis, snapshots)
- `logs/` — validation logs, telemetry

Branch policy

- All automation targets `main` only (push + PR).
- Scheduled runs: deep evaluations (daily/6h) and weekly digest continue.

Node and environment

- Node 20 enforced (`.nvmrc`, package.json engines).
- CI uses `actions/setup-node@v4` node-version: 20.
