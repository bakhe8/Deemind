# Deemind × Salla Architecture (Runtime 1.1)

This document summarizes the core contracts, service routes, and dashboard wiring that make up the Runtime 1.1 “Deemind × Salla” blueprint.

## 1. Data Contracts (core/contracts)

| File                       | Purpose                                                                                                                                                                                               |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `theme-contract.json`      | Canonical schema emitted by the parser → adapter stages. Every build writes `canonical/<theme>/theme.json` that conforms to this contract (input → parsed → adapted → validated blocks).              |
| `api.contract.ts`          | Shared TypeScript interfaces for service ↔ dashboard communication (RunRequest, JobStatus, ReportSummary, OutputEntry, etc.). Dashboard imports this file directly so UI types always match the API. |
| `build-report.schema.json` | Validator output schema (error/warning totals, timings, baseline stats). Build Orchestrator uses the `metrics` slice (errors/warnings) fetched via `/api/themes/:theme/reports`.                      |

Key directories bound to these contracts:

- `canonical/<theme>/theme.json` — parser output that must satisfy `theme-contract.json`.
- `preview-static/<theme>/pages/*.html` + `preview-static/<theme>/.preview.json` — snapshot HTML and metadata that power the runtime stub and dashboard preview matrix.
- `runtime/state/<theme>.json` — persisted store/session state per theme, shaped by the runtime contract exported from `api.contract.ts`.
- `reports/<theme>/**` — validator + baseline artifacts adhering to `build-report.schema.json`.

The service validates canonical output against `theme-contract.json` before persisting; the dashboard imports `@contracts/api.contract` to ensure UI and API stay in sync at compile time.

## 2. Service Modules (service/)

| Module               | Highlights                                                                                                                                                                |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `server.ts`          | Express API. Boots the TaskRunner, manages multi-stub state (`stubPool`), exposes `/api/themes/*`, preview routes, build orchestration, runtime APIs, store presets, etc. |
| `routes/run.ts`      | Encapsulates the CLI task runner (`POST /api/run`, `GET /api/run/jobs`).                                                                                                  |
| `task-runner.ts`     | Single-queue orchestration (spawn, log streaming, completion). Emits events consumed by build/session trackers.                                                           |
| `logger.ts`          | JSONL logger + SSE broadcast for global `/api/log/stream`.                                                                                                                |
| `default-schemas.ts` | Applies default JSON templates when themes are missing metadata during upload.                                                                                            |

The service is the single source of truth for dashboard interactions. Every dashboard feature ultimately talks to `server.ts`.

## 3. Service ↔ Dashboard Endpoints

| Feature                | Endpoint(s)                                                                                                                                                        |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Build Orchestrator     | `POST /api/build/start`, `GET /api/build/sessions`, `GET /api/build/stream`, `GET /api/status`                                                                     |
| CLI Runner             | `POST /api/run`, `GET /api/run/jobs`                                                                                                                               |
| Theme Upload/Defaults  | `POST /api/themes/upload`, `POST /api/themes/:theme/defaults`, `GET/POST /api/themes/:theme/metadata`, `GET /api/themes/:theme/structure`                          |
| Preview Manager        | `GET /api/themes/:theme/preview`, `GET /api/themes/previews`, `POST /api/themes/:theme/preview`, `GET /preview-static/<theme>/<page>.html`                         |
| Reports                | `GET /api/themes/:theme/reports`, `GET /api/reports`                                                                                                               |
| Multi-stub Runtime     | `GET /api/preview/stubs`, `GET/POST/DELETE /api/preview/stub`, `POST /api/preview/stub/reset`, `GET /api/preview/stub/logs`                                        |
| Runtime Inspector APIs | `GET /api/runtime/state`, `POST /api/runtime/context`, `POST /api/runtime/locale`, `/api/runtime/cart/*`, `/api/runtime/wishlist/*`, `/api/runtime/session/logout` |
| Store Presets          | `GET /api/store/demos`, `GET /api/store/partials`, `POST /api/store/preset`, `GET /api/store/diff`                                                                 |
| Twilight Toggle        | `GET/POST /api/twilight`                                                                                                                                           |
| Scenario Runner        | `POST /api/runtime/scenario`, `GET /api/runtime/scenarios`, `GET /api/runtime/scenario/stream`                                                                     |

## 4. Dashboard Wiring (runtime-aware pages)

| Page                      | Uses                                                                                                  |
| ------------------------- | ----------------------------------------------------------------------------------------------------- |
| Upload & Adapter/Baseline | `ThemeStubList` + `StubStatusCard` for stub controls, `/api/themes/:theme/*` for structure + reports. |
| Parser & Validation       | `/api/status`, `/api/log/stream`, `/api/themes/:theme/reports` for live logs + insights.              |
| Build Orchestrator        | `useBuildStream` (SSE), `useRunnerStatus`, `startBuild`, `/api/run`.                                  |
| Preview Manager           | `/api/themes/:theme/preview` (GET/POST), static snapshot URLs, diff coverage cards.                   |
| Settings                  | Multi-stub launch/stop logs, store preset diff, Twilight toggle, defaults generator.                  |
| Runtime Inspector         | `/api/runtime/*` endpoints for state/context/cart/auth operations.                                    |

Each page pulls from the service contract summarized above; there’s no direct filesystem access in the dashboard.

## 5. Runtime Stub (server/runtime-stub.js)

Key behaviors:

- Reads snapshots from `preview-static/<theme>/pages/**`.
- Persists state per theme under `runtime/state/<theme>.json`.
- Injects `window.__SALLA_STUB__` + helper APIs (`salla.cart`, `salla.wishlist`, `salla.auth`, `salla.locale`).
- Exposes mock REST endpoints (cart, wishlist, auth, twilight) and SSE update feeds.
- Can regenerate mock context via `tools/mock-layer/mock-data-builder.js`.

This stub is launched by `/api/preview/stub` and controlled through dashboard Settings/Runtime Inspector.

## 6. Preview Matrix & Snapshot Diff Flow

1. **Matrix aggregation** — `GET /api/themes/previews` walks every theme under `/input` and `/output`, reuses the preview metadata helper (same logic as `GET /api/themes/:theme/preview`), and returns a flat array:

   ```jsonc
   {
     "previews": [
       {
         "theme": "demo",
         "status": "ready",
         "pages": ["index", "product/index", "product/single"],
         "timestamp": "2025-11-09T07:32:11.903Z",
         "port": null,
         "url": null,
         "missing": false,
       },
       {
         "theme": "salla-luna-lite",
         "status": "missing",
         "pages": [],
         "timestamp": null,
         "port": null,
         "url": null,
         "missing": true,
       },
     ],
   }
   ```

2. **Dashboard coverage card** — the Preview Manager consumes the matrix to render readiness stats (friendly mode) and a developer table with page counts, missing/extra summaries per theme, plus actions (`Base`, `Compare`, `Generate`, `Open`).

3. **Bulk orchestration** — the “Generate All Snapshots” control loops through every theme and calls `POST /api/themes/:theme/preview` sequentially. Each success triggers a single-theme refresh via `GET /api/themes/:theme/preview`, so the matrix stays hot without another full scan.

4. **Diff + Mode toggle** — the global `ModeContext` switches the Preview Manager between raw JSON/log detail (Developer) and summarized metrics/cards (Friendly) without a reload. Both views share the same matrix data and iframe previews, so switching modes never disrupts live polling.

Keeping these modules aligned (contracts → service routes → dashboard hooks) ensures the Runtime 1.1 pipeline stays predictable and extensible when new Salla adapters or dashboard features land.
