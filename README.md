# 🧠 Deemind — The Intelligent Theming Engine ![CI](https://github.com/EvaniaDeemind/deemind/actions/workflows/build.yml/badge.svg)

> A local tool that understands, converts, and validates static HTML prototypes into Salla-compatible themes.

---

## 🚀 Quick Start

```
npm install
npm run codex:autopilot   # optional sanity/run-all command
npm run deemind:build demo
```

Input folder → /input/demo  
Output folder → /output/demo

### Local Service & Dashboard

Deemind now exposes a local API and dashboard so everything runs offline without GitHub Actions:

```
# Terminal 1 – API service (http://localhost:5757)
npm run service:start

# Terminal 2 – Dashboard UI (http://localhost:5758)
cd dashboard
npm install
npm run dev
```

Use the dashboard to trigger builds, stream logs, review reports, and download outputs entirely on your machine.

### Desktop Bundle (Phase 5 option)

To launch both the service and dashboard inside a single Electron window:

```
npm run desktop:start
```

This command builds the dashboard (if needed), starts the local API, and opens a desktop window pointing at the offline UI.

Quick VS Code Setup

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
- [commenting.md](docs/commenting.md)
- [configurations.md](docs/configurations.md)
- [deemind_checklist.md](docs/deemind_checklist.md)
- [modules.md](docs/modules.md)
- [salla-integration.md](docs/salla-integration.md)
- [salla-reference.md](docs/salla-reference.md)
- [salla-sdk.md](docs/salla-sdk.md)
- [salla-web-components.md](docs/salla-web-components.md)
- [status.md](docs/status.md)
- [validation.md](docs/validation.md)
- [workflow.md](docs/workflow.md)
- [workflows.md](docs/workflows.md)
