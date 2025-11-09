# 🧠 Deemind — The Intelligent Theming Engine ![CI](https://github.com/EvaniaDeemind/deemind/actions/workflows/build.yml/badge.svg)

> A local tool that understands, converts, and validates static HTML prototypes into Salla-compatible themes.

---

## 🚀 Quick Start

1. `npm install`
2. `npm run service:start` → boots the local API on `http://localhost:5757`
3. `cd dashboard && npm install && npm run dev` → Vite UI on `http://localhost:5758`
4. `npm run deemind:build demo -- --auto` → full pipeline (parser → baseline → validator → preview)

Input folder → `/input/demo`  
Output folder → `/output/demo`

### Local Service, Dashboard & Preview

Deemind now ships with an always-on local service + dashboard bundle:

```
# API service (http://localhost:5757)
npm run service:start

# Dashboard UI (http://localhost:5758)
cd dashboard && npm run dev

# Optional: preview server only
npm run deemind:preview demo
```

- The **dashboard** covers the entire factory: Upload → Parser → Adapter → Validation → Reports → Settings.
- Each successful build triggers **preview prep** + the preview server; you can open it from the dashboard’s “Live Preview” card or via `http://localhost:3000`.
- Want automation? Double-click the **Deemind Launcher** on your desktop to start the service, dashboard, and preview at once.

### Desktop Bundle (Phase 5 option)

To launch both the service and dashboard inside a single Electron window:

```
npm run desktop:start
```

This command builds the dashboard (if needed), starts the local API, and opens a desktop window pointing at the offline UI.

### Previewing Themes

- Every `npm run deemind:build <theme>` automatically writes `.preview.json` and launches the preview server (unless disabled in `configs/deemind.config.json`).
- `npm run deemind:preview demo` (or the dashboard “Open Preview” button) reuses the same server without a full rebuild.
- Routes: `/` (index), `/pages` (page list), `/page/<slug>?lang=ar`.
- Live reload is enabled unless port `45729` is busy; toggle via `preview.livereload` config.
- Preview metadata is exposed at `/api/themes/<theme>/preview` so the dashboard can show status + direct links.
- Static demo snapshots (for baseline review) are generated automatically under `preview-static/<theme>/pages`. Regenerate them manually with `npm run preview:seed`. The preview server serves these snapshots first, so you can browse product/catalog/cart layouts even when the original Twig requires the full Salla runtime.
- Snapshots pull their content from the JSON data living under `mockups/store/<theme>/` (defaults to `mockups/store/demo/`). Each aspect of the mock store has its own file:
  - `store.json` (metadata & settings)
  - `navigation.json`
  - `hero.json`
  - `inventory.json`
- `cart.json`
- `brands.json`
- `blog.json`
- `orders.json`
  Modify these files (or create a new theme folder) and run `npm run preview:seed` to refresh the preview without touching your input prototypes.
- Snapshot coverage is automatic: every `.twig` or `.html` under `output/<theme>/pages` gets a placeholder snapshot so reviewers never see a missing page.

### Runtime Stub (Interactive Mock API)

If you want to simulate cart actions, API calls, and a `window.salla` object without touching Salla’s platform, run the lightweight runtime stub:

```
npm run preview:seed         # ensure snapshots exist
npm run preview:stub demo    # spins up http://localhost:4100/page/index
# or do everything at once with the launcher
npm run preview:launch demo
```

What it does:

- Serves the static HTML snapshots but injects a mocked `window.salla` runtime plus fetch helpers.
- Provides REST endpoints (`/api/cart`, `/api/cart/add`, `/api/cart/remove`, `/api/store`, `/api/products`) backed by `data/mock-store.json`.
- Buttons with `data-cart-add` attributes automatically call the mock API and update the cart state.
- Persists cart/wishlist/session data per theme in `runtime/state/<theme>.json`, so refreshes keep local state until you press **Reset State** (dashboard) or delete the file.
- Includes mock auth (`/api/auth/login`, `/api/auth/logout`) and wishlist endpoints to exercise those flows.
- Streams cart badge updates via SSE so navigation counters refresh in real time.
- Loads translations from `data/locales/<lang>.json` to mimic Twilight’s language behavior.

Update `data/mock-store.json` if you want different store/products/cart defaults for the stub.

> Need the full architecture, API list, and dashboard integration details? See [docs/runtime.md](docs/runtime.md).

> Tip: The Dashboard → Settings page now exposes “Runtime Stub” controls so you can start/stop the stub and inspect its logs without leaving the UI.

#### Store Presets & Scenario Runner

Use the new composable store library to switch demo data without rebuilding. Each preset is defined under `mockups/store/demos/**/store.json` and composed from reusable partials (`mockups/store/partials`).

```
# Apply a preset (via dashboard or service API)
curl -X POST http://localhost:5050/api/store/preset \
  -H "Content-Type: application/json" \
  -d '{"demo":"fashion","theme":"demo"}'
```

The dashboard Settings page now lists all presets so you can flip between “Electro”, “Fashion”, etc. on demand; overrides are accepted as JSON to tweak a section ad hoc.
Use the **Preview Diff** button to see which partials and store fields will change before committing the preset.

Automate common flows against the stub (cart, checkout, wishlist):

```
npm run runtime:scenario demo add-to-cart
npm run runtime:scenario demo checkout
npm run runtime:scenario demo wishlist
```

Each run hits the local APIs, records every request/response, and writes a log under `logs/runtime-scenarios/`. The runner will start the stub automatically if it isn’t already running (default port `4100`).

### Quick VS Code Setup

- Open the folder in VS Code
- Ensure Node v20.10.0 (`nvm use`)
- Recommended extensions installed (ESLint + Prettier, GitLens, Copilot)
- Run task: “Run Deemind Build” from the Terminal → Run Task menu

Windows/PowerShell notes

- Prefer Git Bash or PowerShell 7 in VS Code. We force Git Bash for tasks in `.vscode/tasks.json`.
- Chaining: Windows PowerShell 5.x doesn’t support `&&`. Use `; if ($LASTEXITCODE -eq 0) { <next> }` or run in Git Bash.
- Helpers: import `./scripts/ps-helpers.ps1` for `Invoke-Chain`, `Write-HereString`, and `Replace-InFile`.
- Node version: use Node 20 (`nvm install 20.10.0 && nvm use 20.10.0`).
- One‑time setup: run `scripts/windows-setup.ps1` to install Git Bash, PowerShell 7, nvm‑windows and Node 20 via winget.

Windows/PowerShell notes

- Prefer Git Bash or PowerShell 7 in VS Code. We force Git Bash for tasks in `.vscode/tasks.json`.
- Chaining: Windows PowerShell 5.x doesn’t support `&&`. Use `; if ($LASTEXITCODE -eq 0) { <next> }` or run in Git Bash.
- Helpers: import `./scripts/ps-helpers.ps1` for `Invoke-Chain`, `Write-HereString`, and `Replace-InFile`.
- Node version: use Node 20 (`nvm install 20.10.0 && nvm use 20.10.0`).

🧩 Modules Overview
Module Purpose
deemind-parser/ Understands messy HTML and extracts structure
semantic-mapper.js Maps text content into Twig variables
adapter-salla.js Generates Salla Twig layouts, pages, and partials
validator-extended.js Checks encoding, assets, translations, budgets
build-tracker.js Tracks build reproducibility
delivery-pipeline.js Zips and archives completed themes
⚙️ Config Files

configs/mappings.json → static-to-Twig replacements

configs/budgets.json → asset size thresholds

configs/salla-schema.json → theme validation schema

configs/settings.json → basic tool settings

📂 Folder Structure
input/ → HTML prototypes
output/ → Converted themes
tools/ → Core Deemind engine
configs/ → Settings and mappings
tests/ → QA fixtures and test runner
archives/ → Zipped builds
logs/ → Reports and conflict logs

💡 Philosophy

Deemind doesn’t just parse — it deems meaning.
It interprets structure, resolves conflicts, and delivers a complete, validated theme you can trust.

© 2025 Beto Harire — Personal Edition

---

## 📜 5️⃣ Example Manifest Output

```
{
  "theme": "demo",
  "version": "1.0.0",
  "engine": "Deemind 1.0",
  "adapter": "Salla",
  "timestamp": "2025-11-07T10:00:00Z",
  "pages": 3,
  "components": 12,
  "assets": 8,
  "checksum": "d3b07384d113edec49eaa6238ad5ff00"
}
```

✅ 6️⃣ CLI Commands Summary
Command Description
npm run deemind:build demo Parse, map, adapt, validate, and output theme
npm run deemind:validate Run extended QA validator only
npm run deemind:test Execute test fixtures for regression checking
npm run deemind:preview demo Serve /output/demo in the preview server (http://localhost:3000)

🧠 7️⃣ What’s Next

Drop your prototype into /input/

Run npm run deemind:build

Upload /output/<theme> to GitHub or Salla

Review /output/<theme>/report-extended.json

You can now rename your local folder to deemind, run the CLI as-is, and you’ll have a consistent, brand-aligned personal engine —
💡 “Deemind — Theming Salla Edition” is officially alive.

## 📚 Documentation Index

- [Adapters.md](docs/Adapters.md)
- [DEEMIND_STABLE.md](docs/DEEMIND_STABLE.md)
- [Harmony.md](docs/Harmony.md)
- [Tools.md](docs/Tools.md)
- [ai.md](docs/ai.md)
- [architecture.md](docs/architecture.md)
- [baseline.md](docs/baseline.md)
- [codex-customization-directive.md](docs/codex-customization-directive.md)
- [codex-new-theme-directive.md](docs/codex-new-theme-directive.md)
- [codex-progress.md](docs/codex-progress.md)
- [dashboard.md](docs/dashboard.md)
- [commenting.md](docs/commenting.md)
- [configurations.md](docs/configurations.md)
- [deemind_checklist.md](docs/deemind_checklist.md)
- [roadmap-core.md](docs/roadmap-core.md)
- [modules.md](docs/modules.md)
- [salla-integration.md](docs/salla-integration.md)
- [salla-reference.md](docs/salla-reference.md)
- [salla-sdk.md](docs/salla-sdk.md)
- [salla-web-components.md](docs/salla-web-components.md)
- [status.md](docs/status.md)
- [validation.md](docs/validation.md)
- [workflow.md](docs/workflow.md)
- [workflows.md](docs/workflows.md)

## Dashboard Overview

- Upload / Theme Intake → drag/drop, metadata editor, baseline toggles, and the Live Preview card.
- Parser & Mapper → live SSE log stream, report table, and queue info pulled from `/api/status`.
- Adapter & Baseline → diff viewer plus stats from `baseline-summary.json` & logs.
- Validation & QA → displays `report-extended.json` errors/warnings with quick filters.
- Reports & Metrics → renders `reports/baseline-metrics.md` and `/logs/baseline/*.json` in charts/table form.
- Settings → show effective paths, baseline chains, runtime stub controls, and store preset/diff tooling.
