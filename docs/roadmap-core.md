# 🧭 Deemind Core Roadmap

This document captures the living roadmap for the core Deemind stack (CLI, runtime, dashboard). It supplements `docs/deemind_checklist.md` with context, priorities, and ownership.

---

## ✅ Recently Landed (Runtime 1.0)

| Area                   | Highlights                                                                 |
| ---------------------- | -------------------------------------------------------------------------- |
| Runtime Stub           | Local Express/Twig server with `/api/cart`, `/api/auth`, live SSE badges   |
| Dashboard Bridge       | Upload/Parser/Adapter/Validation pages wired to stub controls              |
| Scenario Runner        | `npm run runtime:scenario <theme> <flow>` hits stub APIs and logs traces   |
| Composable Demo Stores | `mockups/store/partials/` + manifests + `/api/store/preset` hot swaps data |
| Event Streaming        | `/api/preview/events` SSE proxy + dashboard feeds                          |
| Store Diff Preview     | Settings page previews preset diffs before applying                        |

---

## 🚧 In Progress / Q4 2025 Priorities

| Epic                          | Status | Notes                                                                       |
| ----------------------------- | ------ | --------------------------------------------------------------------------- |
| **Runtime 1.1 Stabilization** | 🔄     | Error telemetry, preset cache validation, CLI UX polish                     |
| **Dashboard Insight Layer**   | 🔄     | Filterable runtime event feed, richer diff visualization                    |
| **Composable Demo Library**   | 🔄     | More partial sets (grocery, furniture), typed manifests                     |
| **Scenario Automation**       | 🧪     | Chain scenarios (add→checkout→wishlist), integrate with QA reports          |
| **API Surface Cleanup**       | 🧹     | Merge `/api/store/*` endpoints with dashboard store service for consistency |

---

## 🎯 Next Wave (Roadmap Targets)

1. **Twilight/NEXUS Runtime Shim**
   - Load Twilight SDK locally (mock `window.Salla` events, components).
   - Toggle from dashboard to compare “Twig only” vs “Twig+Twilight” views.

2. **Preset Composer UI**
   - Visual selector for partials (hero, catalog, footer) with live diff preview.
   - Ability to save ad-hoc presets back to `mockups/store/demos`.

3. **Store Analytics & Alerts**
   - Record preview actions (cart.add, auth.login) in `/logs/runtime-events.json` with metadata.
   - Surface KPIs (avg response time, error counts) on Reports page.

4. **Baseline-Aware Runtime Validation**
   - When preset updates run, diff against baseline metrics to catch regressions.
   - Push summaries to `reports/baseline-metrics.md`.

5. **Multi-Theme Preview Matrix**
   - Launch multiple stubs (auto ports) and aggregate their events/logs in the dashboard.
   - Bridge scenario runner output back into the dashboard for quick replay.

6. **Partial Versioning & CDN Sync**
   - Support `hero/spring@2025-02` version pins.
   - Optional remote source for shared partial libraries.

---

## 🧹 Cleanup & Debt Tracking

| Area           | Action                                                                                                               |
| -------------- | -------------------------------------------------------------------------------------------------------------------- |
| Runtime Config | Consolidate state snapshots (`runtime/state/*.json`) and `.preview.json` metadata into a single manifest per theme.  |
| Docs           | Align README, `docs/runtime.md`, and dashboard help tooltips so they reference the same preset/scenario terminology. |
| Scripts        | Replace ad-hoc `node ...` invocations with `npm run runtime:*` helpers (seed, preset, diff).                         |
| Tests          | Add integration tests that compose presets, hit APIs, and verify SSE + dashboard endpoints.                          |

---

## 📌 References

- `docs/deemind_checklist.md` — canonical checklist used by the GitHub sync script.
- `tools/store-compose.js` — library for composing demo data.
- `server/runtime-stub.js` — runtime API implementation.
- `dashboard/src/pages/Settings.tsx` — Store preset UI + diff preview.
- `.github/workflows/roadmap-sync.yml` — automation for syncing checklist → issues/Project.

Have a new epic or dependency to add? Update this file and the checklist to keep automation in sync.
