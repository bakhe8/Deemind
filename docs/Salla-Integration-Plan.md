# Salla Integration Plan — Runtime 1.1

This guide outlines how Deemind mirrors Salla’s runtime expectations locally: schema parity, documentation sync, and validation hooks. Follow these steps whenever you update dependencies or onboard a new theme.

## 1. Canonical Data Sync

| File                       | Source                                           | Command              |
| -------------------------- | ------------------------------------------------ | -------------------- |
| `core/salla/schema.json`   | Official Salla schema endpoint (or override env) | `npm run salla:sync` |
| `core/salla/filters.json`  | Salla filter catalog                             | `npm run salla:sync` |
| `core/salla/partials.json` | Standard partial references                      | `npm run salla:sync` |
| `core/salla/meta.json`     | Generated metadata (timestamp, hashes, source)   | `npm run salla:sync` |

- The sync script respects `SALLA_SCHEMA_URL`, `SALLA_FILTERS_URL`, and `SALLA_PARTIALS_URL`. When offline, it falls back to bundled defaults so the pipeline never blocks.
- Dashboard “Help → Salla Docs” surfaces the last sync timestamp by reading `meta.json`.

## 2. Documentation Bridge

- `docs/Salla-Reference.md` links to official documentation (layout hooks, Twilight SDK, API references). Refresh it whenever the Salla portal structure changes.
- The dashboard surfaces this doc via a Markdown viewer so reviewers can jump directly to primary sources while inspecting a build.

## 3. Validation Hooks

| Tool                             | Purpose                                                              | Usage                                                                                               |
| -------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `tools/validate-theme.ts`        | AJV validation of `theme.json` or canonical files                    | `npm run validate:theme -- ./input/demo/theme.json`                                                 |
| `tools/validator-extended.js`    | Runtime parity checks: raw filters, budgets, i18n, Twig dependencies | Triggered automatically during `npm run deemind:build <theme>`                                      |
| `tools/twig-dependency-graph.js` | Include/extends graph + cycle detection                              | Automatically invoked during builds; report saved under `reports/twig-dependency-<theme>.{json,md}` |

- Integration tests should run `npm run validate:theme` for each canonical dataset before adaptation.
- The extended validator reads `core/salla/schema.json` to confirm component usage and filter availability.

## 4. Runtime Compatibility

- `server/runtime-stub.js` exposes REST endpoints that mimic Salla behavior (`/api/cart`, `/api/wishlist`, `/api/auth`, `/api/store/preset`, `/api/runtime/*`).
- Twilight shim: toggle via dashboard → Settings → Twilight; it injects `twilight-shim.js` and exposes `window.Salla.twilight`.
- Locale handling: stub loads `data/locales/<lang>.json` and syncs with the dashboard through SSE.
- Store presets: `mockups/store/demos/<demo>/store.json` declare partial compositions; `tools/store-compose.js` deep-merges `mockups/store/partials/**` to produce per-theme datasets.

## 5. Operational Checklist

1. `npm run salla:sync` – refresh schema/filter/partials snapshots.
2. (Optional) Update `docs/Salla-Reference.md` + dashboard help links.
3. `npm run validate:theme -- ./input/<theme>/theme.json` – confirm metadata alignment.
4. `npm run deemind:build <theme>` – full pipeline (parser → mapper → adapter → validation → runtime prep).
5. `npm run preview:launch <theme>` – interactive stub for QA, with Twilight + runtime preset toggles.

## 6. Future Enhancements

- **Version Pinning** – allow `core/salla/meta.json` to track upstream versions and warn when outdated.
- **Schema Diff Reports** – auto-generate diff summaries when sync results differ from previous snapshots.
- **Twilight Component Registry** – extend `core/salla/partials.json` with Twilight-specific widgets to aid validation.

Keeping this plan current ensures Deemind remains a faithful local mirror of Salla’s production runtime and lets developers iterate entirely offline without surprises when deploying themes upstream.
