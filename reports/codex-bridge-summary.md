# Codex Interactive Bridge Summary

## Overview
The self-updating instruction bridge under `/reports/ui/` mirrors the current Deemind capabilities. It reads live data from:

- `package.json` scripts and tooling commands
- `/tools/` Node helpers
- `/configs/` (schema, tokens, settings, etc.)
- `/logs/` + `/reports/` (tasks, system status, harmony metrics)

Data snapshots are generated via `npm run codex:update-dashboard`, which now also produces:

- `reports/dashboard/data/observatory.json`
- `reports/ui/data/bridge.json`
- `reports/ui/version.json`

## UI Structure
```
/reports/ui/
├── index.html          # Overview hub
├── commands.html       # Scripts + tool inventory
├── customization.html  # Request queue view
├── status.html         # Schema + settings
├── logs.html           # Task log + system log
└── assets/
    ├── style.css
    ├── ui.js
    ├── bridge.js       # Polls bridge.json every 60s
    └── autodetect.js   # Renders each page
```

## Sync Behaviour
1. `tools/update-dashboard.js` scans scripts, tools, configs, docs, schema fields, tasks, and customization log.
2. Output is saved to `reports/ui/data/bridge.json` with timestamps and feature summary.
3. `reports/ui/version.json` tracks `ui_version`, `last_sync`, and detected features.
4. Each UI page subscribes to the bridge data and refreshes automatically (every 60s or on demand).

## Usage
- Generate fresh data: `npm run codex:update-dashboard`
- Open the bridge: `reports/ui/index.html` (or any page in `/reports/ui/`)
- Navigate to the legacy dashboard via the provided shortcut for visual metrics.
