# Core Readiness Report — 2025-11-08

## Autopilot Stability

- Command: `npm run codex:autopilot -- --no-push`
- Log source: `logs/codex-autopilot.log`
- Latest runs:

| Timestamp (UTC)          | Result     | Notes                                 |
| ------------------------ | ---------- | ------------------------------------- |
| 2025-11-08T08:36:38.152Z | ✅ Success | First stabilized run after doctor fix |
| 2025-11-08T09:14:12.223Z | ✅ Success | Full directive set completed locally  |
| 2025-11-08T09:14:31.381Z | ✅ Success | Back-to-back verification pass        |

## Build/Test Health

- `npm run deemind:test` completes each run (warnings remain for lint/snapshot fixtures but no blocking errors).
- Extended validation reports: only `salla-new-theme` and `snapshots_expected` still show known errors because their source input folders are absent. All other themes validate with warnings only.
- Mockup validation score: 100 (modern-blue).
- Harmony summary maintained at 100 via `reports/harmony-summary.json`.

## Service & Dashboard

- Local API: `npm run service:start` (http://localhost:5757) with optional bearer token.
- Dashboard: `cd dashboard && npm run dev` (http://localhost:5758) drives builds/logs/reports without Codex or GitHub Actions.
- Recent autopilot and dashboard updates propagate through `reports/ui/data/bridge.json` and `reports/dashboard/data/observatory.json`.

## Security & Environment

- Node pinned to 20.x (project warning shown when running newer Node versions).
- Service defaults to localhost-only; token can be configured in `service/config.json` or `DEEMIND_SERVICE_TOKEN`.
- No external automation or secrets required after service start; all workloads execute locally.

## Next Steps

1. Remove legacy GitHub workflows once dashboard/service fully replace them.
2. Address remaining validation warnings (`salla-new-theme`, `snapshots_expected`) or remove obsolete outputs.
3. Publish `/docs/runbook.md` and `/docs/cutover_checklist.md` to document pure-local operations.
