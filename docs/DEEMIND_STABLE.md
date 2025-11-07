# Deemind — Stable Architecture (No Harmony)

Deemind is the Salla theming engine. Deemind Tools is the automation ecosystem that builds, validates, documents, and maintains Deemind. Harmony is out of scope and not referenced in this architecture.

- Deemind (engine): parsers, mappers, adapters, validators, canonical models → outputs valid themes in `output/<theme>/`.
- Deemind Tools: Codex agent, validators, CI workflows, docs, telemetry, packaging utilities.

Principles

- One main branch (`main`) for CI/CD.
- Node 20 enforced across local and CI.
- Always produce `manifest.json`, `report-extended.json`, and Salla `theme.json` per theme.
- CI runs: lint → build → tests/snapshots → doctor → static analysis → package.

---

## Layout

- `tools/` — build ecosystem (agent, validators, adapters, packaging, static analysis)
- `configs/` — mappings, budgets, schema, settings
- `input/` → `output/` — stable I/O convention
- `docs/` — architecture, adapters, tools, workflows

## Compliance & Packaging

- `theme.json` enriched (categories, fonts, settings).
- Salla CLI wrapper (`tools/salla-cli.js`): `zip | serve | push | validate`.
- Workflow `salla-validate.yml` packages and validates.

## Maintenance

- Codex Agent: self-driven deep evaluation on a schedule, progress and telemetry recorded.
- Static analysis: cycles and unused deps reported under `reports/static-analysis.md`.
- Weekly status and daily evaluation continue.

---

## Not in scope

- Harmony validation and comparison (intentionally deferred).

---

## Next steps

- Add Lighthouse CI against preview deployments (optional).
- Expand snapshot coverage for new themes.
- Tighten ESLint rules incrementally.
