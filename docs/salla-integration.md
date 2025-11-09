# Salla Docs Integration

Deemind can ingest public Salla documentation to enhance alignment during build and validation.

## Sync Hints From Docs

Run the harvester to fetch and summarize key hints (layout hooks, helpers, filters, component categories):

```
npm run salla:docs:sync
```

It writes `configs/knowledge/salla-docs.json` with fields:

- `layouts.masterHooks`: list of suggested master layout block names (e.g., head, header, content, footer, scripts)
- `helpers`: occurrences of `salla.*` helpers found
- `filters`: Twig filters seen (e.g., `t`, `escape`, `raw`)
- `components.{home,header,footer,products}`: headings found under these sections

The scraper is heuristic and safe; when pages are unreachable it falls back to sane defaults.

## How It’s Used

- Adapter: when generating `layout/default.twig`, it will include master blocks discovered in `salla-docs.json`.
- Validator (extended): warns when pages don’t extend a layout; when includes aren’t under `partials/`; and when overall i18n coverage is far below the baseline.

## Updating

Re-run `npm run salla:docs:sync` whenever Salla docs change to refresh the hints.

## Canonical Schema / Filters / Partials

The runtime and validator now rely on canonical JSON snapshots stored under `core/salla/`:

- `schema.json`
- `filters.json`
- `partials.json`
- `meta.json` (sync metadata + hashes)

Sync them via the new tool:

```
npx tsx tools/salla-sync.ts
```

Environment variables (`SALLA_SCHEMA_URL`, `SALLA_FILTERS_URL`, `SALLA_PARTIALS_URL`) override the default endpoints. When a URL is unreachable the tool falls back to bundled minimal definitions so the pipeline keeps working offline. Every run updates `core/salla/meta.json` with the timestamp, source (remote vs fallback), and sha256 hash for each file.

## Runtime 1.1 Dashboard Hooks

The Deemind × Salla blueprint pairs the service API with dashboard modules:

| Module                      | Service API                                                                                                                 | What it does                                                                                                        |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Build Orchestrator          | `POST /api/build/start`, `GET /api/build/sessions`, `GET /api/build/stream`, `GET /api/status`                              | Queue builds (with optional diff), stream session/log updates over SSE, and show TaskRunner queue depth.            |
| Preview Manager             | `GET/POST /api/themes/:theme/preview`                                                                                       | Inspect preview metadata (port/url/pages) and regenerate snapshots per theme, then compare two themes side-by-side. |
| Multi-stub Runtime Controls | `GET /api/preview/stubs`, `GET/POST/DELETE /api/preview/stub`, `POST /api/preview/stub/reset`, `GET /api/preview/stub/logs` | Launch/stop multiple runtime stubs, tail logs, and reset state files without touching the CLI.                      |
| Runtime Inspector           | `GET /api/runtime/state`, `POST /api/runtime/context`, `POST /api/runtime/locale`, cart/wishlist/session endpoints          | Inspect or mutate cart, auth, locale, and mock context; keep Runtime Inspector in sync with the live stub.          |
| Store Preset Manager        | `GET /api/store/demos`, `GET /api/store/partials`, `POST /api/store/preset`, `GET /api/store/diff`                          | Compose partials into demo presets, apply overrides, and visualize diffs before publishing.                         |
| CLI Task Runner             | `POST /api/run`, `GET /api/run/jobs`                                                                                        | Trigger doctor/validate jobs and show job history directly from the dashboard.                                      |

Documenting these hooks ensures that future Salla integrations (e.g., Twilight/NEXUS, scenario runner) can reuse the same contract without guessing how the dashboard expects to consume data.
