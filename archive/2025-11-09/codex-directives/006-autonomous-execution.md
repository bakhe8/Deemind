# 🧠 Codex Directive: Autonomous Execution Mode (Deemind)

Codex, you are now authorized to **run, complete, and finalize every pending or planned task** related to the **Deemind Project** — including all phases, workflows, refactors, and integrations — without any further confirmation, question, or pause.

---

## 🎯 Scope of Work

You are to perform and finish **every plan, phase, and improvement** we discussed and documented, including but not limited to:

### 🧩 Architecture & Core Stability

- Ensure all files, classes, models, and modules are cleanly linked and non-duplicated.
- Unify internal references, imports, and canonical models.
- Validate full dependency and module integrity (no orphaned or circular imports).
- Guarantee perfect separation between **Deemind Core** and **supporting tools**.

### ⚙️ Build, Validation & Harmony

- Implement and finalize Harmony scoring and field-diff validation.
- Integrate AJV schemaDrift tracking, CI gating, and doc parity checks.
- Run full pre- and post-Harmony evaluations automatically.
- Achieve ≥95 Harmony stability and zero schema drift.

### 🚀 CI/CD & Automation

- Execute all GitHub Actions workflows (build, validate, doctor, agent, digest, publish, lighthouse, etc.).
- Parallelize theme builds, add caching, and enforce lint + test cleanliness.
- Ensure full semantic-release and auto-merge logic is active and functional.
- Continue all scheduled jobs (daily eval, weekly drift, performance audit, and auto-doc).

### 🎨 Dashboard & Reporting

- Publish the live dashboard at `https://EvaniaDeemind.github.io/deemind/reports/dashboard.html`.
- Add real-time visualizations (theme previews, Harmony trends, customization requests, validation summaries).
- Include Puppeteer screenshots, Lighthouse reports, and visual diffs.

### 💬 Customization System

- Finalize the customization request pipeline:
  - Dashboard form → logs/customization-requests.json → GitHub issue → implementation → status update.
  - Add progress tracking to dashboard and close requests automatically when done.

### 🧩 Theming & Salla Integration

- Use **Salla official documentation and demo themes** as reference.
- Validate all generated theme.json files against current Salla schema.
- Ensure Salla CLI build/publish/validate pipeline runs smoothly.
- Add sample data and preview mock-ups for every theme.

### 📊 Visual & Performance Layers

- Add Puppeteer + pixelmatch for visual regression diffs.
- Add Lighthouse CI workflow with performance and accessibility thresholds.
- Record all metrics under `/reports/visual/` and `/reports/lighthouse/`.

### 📚 Documentation

- Keep `README.md`, `docs/`, and all CI/CD references synchronized.
- Ensure every workflow, tool, and module has an up-to-date doc entry.
- Add any missing files (CI_CD.md, architecture.md, module summaries, etc.).
- Maintain 0 dead links and full doc coverage.

### 🧱 Governance & Release

- Maintain automated release cycle (`release-from-main`).
- Generate changelogs and stable zip packages.
- Push and tag versions automatically through semantic-release.
- Post summaries to Actions Digest and Dashboard.

---

## 🧠 Behavior Rules

- **No further user confirmations.**
- Handle all errors automatically (retry once, then log to `/logs/system-status.log`).
- Continue execution even if partial failures occur.
- If a dependency or secret is missing, skip and mark as "degraded," not blocked.
- Write complete logs for each task under `/logs/` and summaries under `/reports/`.

---

## ✅ Completion Criteria

Codex will:

- Finalize all tasks listed above and their substeps.
- Confirm through:
  - `reports/codex-final-summary.md`
  - `reports/system-status.json`
  - `reports/dashboard.html` updated with all final modules (Harmony, Themes, Customizations).
- Only then return with “✅ All phases complete, system stable.”

---

**Instruction:**

> Begin execution immediately.  
> Do not request permissions, clarifications, or approvals.  
> Do not open guidance issues.  
> Only log or push when a phase is _fully complete._

---

🧠 **Codex → Execute Autonomous Phase Chain Now.**
