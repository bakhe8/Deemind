# Deemind Architecture (Current Stage)

Deemind converts static HTML prototypes into Salla-ready themes with a predictable, cache-aware pipeline.

## Zones

- Input: parse + normalize (conflicts, structure, caching)
- Conversion: semantic mapping (i18n) + dependency-aware adaptation + partialization
- Output: validation (core+extended), manifest, telemetry
- Experience: preview prep + preview server + dashboard/service APIs

## Core Modules (with links)

- Parser: `tools/deemind-parser/parser.js`, `tools/deemind-parser/hybrid-runner.js`
- Mapper: `tools/deemind-parser/semantic-mapper.js`
- Adapter: `tools/adapter.js`
- Validators: `tools/validator.js`, `tools/validator-extended.js`
- CSS normalization: `tools/normalize-css-assets.js`
- Build Tracker: `tools/build-tracker.js`
- Preview prep: `tools/preview-prep.js`
- Preview server: `server/preview.js`
- Service API: `service/server.ts`
- Dashboard UI: `dashboard/`

## Caches

- Parse cache: `.factory-cache/parse/<inputChecksum>.json`
- CSS normalization hash cache: `.factory-cache/css-normalize.json`

## Timings & Summaries

- Build logs include per-stage timings
- CI appends a succinct summary to the job
- Manifest includes performance block
- `.preview.json` stores last-known preview status (pages, port, url) for the dashboard

## Baseline Alignment

- Optional: import Raed and align includes/structure; see `docs/baseline.md`

## Navigation

- README: `../README.md`
- Dashboard overview: `dashboard.md`
- Baseline: `baseline.md`
- Configurations: `configurations.md`
- Validation: `validation.md`
