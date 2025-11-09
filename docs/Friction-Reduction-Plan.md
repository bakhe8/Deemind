# Friction Reduction Plan — Developer Experience Goals

The Deemind × Salla blueprint targets a zero-friction local workflow. This plan lists the current wins and the remaining items we use to guarantee smooth development on Windows.

## 1. Environment Standards

- **PowerShell-first scripts**: `start-deemind.ps1`, `full-run.ps1`, `ports:clean`, and all npm scripts run on Windows without bash.
- **Fixed Ports**: Service `5757`, dashboard `5758`, preview stub `4100+` (auto-increment per theme). No surprises for firewall rules.
- **Env Config**: `.env` only stores service tokens/ports; `service/config.json` holds defaults so we never hardcode values into scripts.

## 2. Contracts & Tooling

- `core/contracts/` avoid duplicate type definitions; UI + service import the same types.
- `core/logger/` (in progress) centralizes logging to prevent tailing multiple files.
- `tools/doctor.ts` (upcoming) will run parser → validator → scenario flows automatically to catch regressions before manual testing.

## 3. Mock & Preview Quality

- **Composable Mock Data**: `mockups/store/partials/**` + `mockups/store/demos/**` let us assemble demo stores without copying huge JSON blobs.
- **Context Builder**: `tools/mock-context-builder.ts` auto-detects Twig variables and generates realistic placeholder data so theme previews look real.
- **Runtime Stub Enhancements**: SSE cart badges, login state, Twilight shim, per-theme store presets, and scenario runner chains make local previews behave like production.

## 4. Dashboard & Service Coupling

- Dashboard “Run/Logs/Reports/Runtime/Preview” tabs will remain the only UI needed to operate the pipeline—no more switching terminals.
- `service/task-runner.ts` handles concurrency=1 with queue visibility so we know exactly what job is running.
- SSE streams (`/api/run/stream`, `/api/log/stream`, `/api/preview/events`) fuel runtime inspector and scenario monitors in real time.

## 5. Observability

- JSONL logs in `logs/deemind-YYYY-MM-DD.log` + SSE feed (soon powered by `core/logger/index.ts`).
- `reports/` becomes the single place for build artifacts: baseline metrics, twig dependency graphs, validation summaries, and final reports.
- Dashboard exposes “View report” buttons that open these files directly.

## 6. Action Items (Rolling)

| Area              | Action                                                               | Status  |
| ----------------- | -------------------------------------------------------------------- | ------- |
| Logger            | Wire `core/logger/index.ts` into service/runtime stub                | Pending |
| Doctor            | Implement `tools/doctor.ts` (validate → auto-fix → re-validate)      | Pending |
| TypeDoc           | Auto-generate API docs from `core/contracts`                         | Pending |
| Scenario Viewer   | Dashboard module to replay logs from `logs/runtime-scenarios/*.json` | Pending |
| Windows Packaging | Electron + installer bundling for a single-click app                 | Pending |

Keep this file up to date as friction points move or get eliminated. The goal is that every onboarding developer runs a single PowerShell command and immediately gets the entire Deemind factory—service, dashboard, runtime stub, docs, and reports—without additional setup.
