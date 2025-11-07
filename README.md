# 🧠 Deemind — The Intelligent Theming Engine ![CI](https://github.com/EvaniaDeemind/deemind/actions/workflows/build.yml/badge.svg)

> A local tool that understands, converts, and validates static HTML prototypes into Salla-compatible themes.

---

## 🚀 Quick Start

```
npm install
npm run deemind:build demo


Input folder → /input/demo
Output folder → /output/demo
```

Quick VS Code Setup

- Open the folder in VS Code
- Ensure Node v20.10.0 (`nvm use`)
- Recommended extensions installed (ESLint + Prettier, GitLens, Copilot)
- Run task: “Run Deemind Build” from the Terminal → Run Task menu

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
