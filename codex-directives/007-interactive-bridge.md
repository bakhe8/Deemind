# 🧠 Codex Directive — Build Self-Updating Interactive Instruction Bridge (Deemind Command Pages)

## 🎯 Objective
Codex, you are now instructed to build and maintain an **auto-updating web interface** under `/reports/ui/` that always reflects the **current Deemind tool features, commands, modules, and states**.

These pages form a **permanent control bridge** between the human operator and Deemind itself — dynamically synced from Deemind’s configuration, schema, and CI reports.

---

## 🧩 Core Principle
The bridge must **never fall out of sync** with Deemind.  
All available commands, theme operations, validators, and tool features must be detected automatically from:
- `package.json` (`scripts` and CLI commands)
- `/tools/` and `/configs/` contents
- `/codex-tasks.json`
- `/reports/system-status.json`
- `/reports/harmony-summary.json`
- `/docs/` index (for reference links)

---

## ⚙️ Functional Scope

### 1️⃣ Dynamic Command Index
- Auto-read all available CLI scripts from `package.json → scripts`.
- Auto-read all tool modules (`/tools/*.js`, `/tools/*.cjs`, `/tools/*.mjs`) and extract exported commands.
- Auto-merge with `codex-tasks.json` for higher-level Codex actions.
- Present these dynamically inside the **“Commands” panel** (dropdown list, search box, or cards).

### 2️⃣ Live Feature Detection
- Watch `/configs/`, `/tools/`, `/docs/`, and `/reports/`.
- When a file changes (new feature, schema update, or doc added), the UI automatically:
  - Refreshes available options
  - Updates visible buttons and command inputs
  - Adds contextual help tooltips pulled from doc headers

### 3️⃣ Automated Schema Sync
- Parse `configs/salla-schema.json` and `configs/settings.json` to list all Salla fields and validation rules.
- Update the “Theme Validation” panel in real time.
- If schema or version changes → reflect instantly in the UI (version badge updates automatically).

### 4️⃣ UI Structure

```
/reports/ui/
├── index.html           # Main dashboard hub
├── commands.html        # Dynamic CLI + Codex commands
├── customization.html   # Theme customization and status
├── status.html          # Harmony + validation + system health
├── logs.html            # Real-time Codex and Deemind logs
└── assets/
    ├── ui.js            # General UI logic
    ├── bridge.js        # Auto-sync + file fetch engine
    ├── autodetect.js    # Command & feature scanning
    └── style.css        # Shared theme
```

---

## 🧩 Autodetect.js Responsibilities
`autodetect.js` must:
1. Read and parse JSON files directly from `/reports/`, `/configs/`, and `/tools/` via `fetch()`.
2. Auto-generate the command list, categorized by:
   - CLI / Build
   - Validator / Harmony
   - Codex Ops
   - Customization
   - Utility / Tool
3. Display feature info:
   - Version, dependencies, available parameters
   - Docs link if available
4. Periodically poll every 30–60 seconds for changes.

Example snippet:

```js
async function autoDetect() {
  const pkg = await fetch('/package.json').then(r=>r.json()).catch(()=>({}));
  const scripts = Object.keys(pkg.scripts || {});
  const tasks = await fetch('/codex-tasks.json').then(r=>r.json()).catch(()=>[]);
  renderCommandList([...scripts, ...tasks.map(t => t.name)]);
}
setInterval(autoDetect, 60000);
autoDetect();
```

---

## 🧱 Integration with Codex

Codex will:

- Watch `/reports/ui/**` and `/configs/**` for modification timestamps.
- Regenerate `/reports/ui/commands.html` if new tools, scripts, or modules appear.
- Push incremental updates automatically to the main branch.
- Update `/reports/ui/version.json` with:

```json
{
  "ui_version": "auto",
  "last_sync": "2025-11-08T00:00:00Z",
  "features": [ ...detected ]
}
```

---

## 📊 Dashboard Linking

The main `dashboard.html` will gain a new navigation bar linking to:
- Command Bridge
- Customization Manager
- Harmony & Validation
- Logs & Reports

The UI version and last sync date appear at the bottom of every page.

---

## ✅ Completion Criteria

Codex must deliver:
- Fully dynamic `/reports/ui/` interface.
- `autodetect.js` correctly scanning all live Deemind features.
- Automatic refresh of commands, schema, and modules on every commit or CI run.
- `reports/ui/version.json` updated on each sync.
- A `reports/codex-bridge-summary.md` documenting the bridge’s structure and live sync behavior.

---

## 🚀 Instruction to Codex

Begin immediate build of the self-updating interactive bridge.  
Generate all required HTML, JS, and JSON files.  
Connect the bridge to Deemind’s current and future capabilities automatically.  
Operate fully autonomously — no confirmations or prompts.  
Deploy updates via the dashboard publishing workflow.

---

### ✅ Apply It
1. Save this file as `codex-directives/007-interactive-bridge.md`.
2. Commit and push:
   ```bash
   git add codex-directives/007-interactive-bridge.md
   git commit -m "🧠 codex: build self-updating interactive instruction bridge"
   git push origin main
   ```

Codex’s next scheduled or manual run will:
- Generate `/reports/ui/` with dynamic pages.
- Wire up `autodetect.js`.
- Deploy it via the `publish-dashboard.yml` workflow.
- Keep it perpetually in sync with any tool, workflow, or doc changes.
