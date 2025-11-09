# Deemind Dashboard

The dashboard is a first-class surface for running the entire factory locally. It talks to the service (`npm run service:start`) over HTTP and renders the status of every stage from intake to preview.

## Pages

| Page                  | Purpose                                                              | Data Sources                                                                                              |
| --------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Upload / Theme Intake | Upload zips/folders, edit metadata, toggle baselines, launch preview | `/api/themes`, `/api/themes/:theme/structure`, `/api/themes/:theme/preview`, `/api/themes/:theme/reports` |
| Parser & Mapper       | Watch live logs, inspect queue, browse generated reports             | `/api/status`, `/api/log/stream`, `/api/reports`                                                          |
| Adapter & Baseline    | Summaries of baseline fills plus diff viewer                         | `/api/themes/:theme/reports` (baseline + diff)                                                            |
| Validation & QA       | Errors/warnings from extended validator                              | `/api/themes/:theme/reports`                                                                              |
| Reports & Metrics     | Charts for `reports/baseline-metrics.md` and baseline log table      | `/api/baseline/metrics`, `/api/baseline/logs`                                                             |
| Settings              | Shows effective paths, baseline defaults, auth token field           | `/api/settings`                                                                                           |

## Run Locally

```
npm run service:start           # 5757
cd dashboard && npm install
npm run dev                     # 5758
```

Or use the desktop launcher (`start-deemind.ps1 / .bat`) to boot the service, dashboard, preview server, and Electron shell together.

## Preview Integration

- Every build writes `output/<theme>/.preview.json`.
- The service exposes `/api/themes/<theme>/preview`.
- The Upload page reads this status and enables the “Open Preview” button (falls back to `http://localhost:<port>/` if the preview server reports a port but no URL).
- `npm run deemind:preview <theme>` reuses the same path if you want the preview without touching the rest of the pipeline.

## Customisation

- Change dashboard port via `DASHBOARD_PORT` env or `npm pkg set config.dashboard_port=<port>`.
- Point to a remote service by setting `VITE_SERVICE_URL`.
- Tailwind tokens live in `dashboard/src/styles.css`; add new tokens there and they will be available as utilities (e.g., `bg-primary`).
