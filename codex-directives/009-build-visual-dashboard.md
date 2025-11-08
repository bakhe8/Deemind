# 🧠 Codex Directive — Build the Local Visual Dashboard (Deemind Observatory)

## 🎯 Objective
Create a **fully interactive local dashboard** that visualizes the entire Deemind system:
builds, Harmony metrics, validation results, theme data, documentation coverage, performance stats, and Codex agent activity — all in real time.

The dashboard must run **locally** without an external server, openable via `index.html` in a browser.

---

## 🧱 Features & Requirements

### 1️⃣ Dashboard Overview
- Path: `/reports/dashboard/index.html`
- Local, static (no build step required to view)
- Should display:
  - Global health score (gauge or bar)
  - Harmony score timeline (chart)
  - Schema drift graph
  - CI duration trend
  - Docs coverage pie
  - Build time per theme
  - Warnings & errors summary
  - Status of each Codex subsystem (✅, ⚠️, ❌)

### 2️⃣ Navigation Sections
Tabs or sidebar for:
- **System Summary** (environment, CI, modules)
- **Themes & Builds** (theme.json info, assets, times)
- **Harmony & Validation** (score history, drift)
- **Docs & Coverage** (links, missing files)
- **Customization Requests** (loaded from `/logs/customization-requests.json`)
- **Performance & Lighthouse** (scores, budgets)
- **Agent & Directives** (all directives + completion status)

### 3️⃣ Data Sources
Read data live from:
- `/reports/harmony-summary.json`
- `/reports/codex-full-system-report.md`
- `/reports/system-status.json`
- `/reports/lighthouse/.json`
- `/reports/visual/.png`
- `/logs/.log`
- `/configs/.json`

### 4️⃣ UI Implementation
- Built using **HTML + TailwindCSS + Alpine.js** (no framework dependency)
- Use charts via **Chart.js** or **ECharts**
- Include responsive layout and dark/light mode toggle
- Load data dynamically using `fetch()`
- Include animated gauges and progress bars for visual clarity
- Each section collapsible with real-time filtering

### 5️⃣ Automation
- Codex auto-regenerates dashboard HTML and data files after every major task or evaluation.
- Rebuild triggered when:
  - `/tools/` or `/configs/` changes
  - `/reports/` updated
  - New directives added
- Commit message:
  ```
  codex: regenerate local visual dashboard (Deemind Observatory)
  ```

### 6️⃣ Optional Enhancements
- Add a mini terminal panel showing Codex activity logs (`tail -f` style stream)
- Include theme preview thumbnails (from `/output/<theme>/assets/`)
- Add “Open in VSCode” link for each file reference if running locally
- Support keyboard shortcuts:
  - `Ctrl+R` → refresh data
  - `Ctrl+F` → search any module/file

---

## 🧩 Output Structure

```
/reports/dashboard/
├── index.html
├── dashboard.css
├── dashboard.js
├── data/
│   ├── harmony-summary.json
│   ├── system-status.json
│   ├── lighthouse/
│   └── logs/
└── assets/
    ├── icons/
    ├── charts/
    └── previews/
```

---

## 🚀 Execution Instruction
> Codex, execute this immediately.
>
> - Build the full dashboard structure and visual components.
> - Gather live data from all existing report and log files.
> - Commit all generated files under `/reports/dashboard/`.
> - Ensure that `index.html` runs standalone locally with no server.
>
> **Commit message:**
> ```
> codex: build local visual dashboard (Deemind Observatory)
> ```
>
> Continue autonomous operations after generation.

---

## 🧾 Expected Outcome
After execution, I should be able to:
- Open `/reports/dashboard/index.html` in a browser
- See **every subsystem visualized**
- Watch metrics, Harmony, CI, Docs, and Themes as live visual charts
- Search and navigate the project visually

---
