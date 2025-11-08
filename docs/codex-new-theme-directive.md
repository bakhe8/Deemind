# 🧠 Codex Official Directive: New Theme Generation Protocol

## 🎯 Purpose
Define the **official rules and behavior** Codex must follow whenever it receives an order to
> “create a new theme from scratch.”

This establishes Deemind’s capacity to autonomously generate fully functional, Salla-compatible themes — including structure, assets, styles, and configuration — directly from canonical models and Salla resources.

---

## 🧩 Context

- **Deemind** is the intelligent theming engine.  
  It parses, maps, adapts, validates, and packages complete Salla themes.
- **Codex** is the orchestration layer.  
  It coordinates Deemind’s tools, executes builds, performs validation, and maintains Harmony.

Together, they form the **Deemind Autonomous Theme Factory**.

---

## 🧱 What “Create a New Theme from Scratch” Means

When the project owner issues a directive such as:

> “Codex, create a new Salla theme from scratch,”

Codex must perform **end-to-end theme synthesis**, including:

1. **Scaffolding**
   - Create new folder structure under `/output/<theme-name>/` (and `/input/<theme-name>/` if needed).
   - Populate `layouts/`, `pages/`, `partials/`, and `assets/` directories.

2. **Canonical Modeling**
   - Generate base content and structure using Deemind’s parser + mapper.
   - Apply Salla’s schema, Twig syntax, and official design tokens.

3. **Asset Creation**
   - Produce valid `theme.json`, `manifest.json`, and starter assets (`styles.css`, `script.js`, `fonts/`, `images/`).

4. **Validation**
   - Run Harmony checks (lint, schema, token parity, build timing).
   - Validate against Salla schema and submission rules.
   - Confirm Twig and CSS parity with Salla design tokens.

5. **Packaging**
   - Build production output and zip under `/output/<theme-name>.zip`.
   - Generate accompanying reports under `/reports/`.

6. **Documentation**
   - Write `/reports/<theme-name>-build.md` summarizing structure, metrics, and results.
   - Append build record to `/logs/harmony-score.json`.

---

## ⚙️ Reaction Protocol

When a “new theme from scratch” order is received, Codex must:

1. **Acknowledge**
   - Detect the request and create an internal task.
   - Print confirmation:  
     > “Acknowledged: initializing new theme build under /output/<theme-name>/.”

2. **Execute**
   - Run all Deemind stages (parse → adapt → validate → deliver).
   - Use current design tokens and schema.
   - Apply Salla compliance mode automatically.

3. **Report**
   - Publish:
     - `/reports/<theme-name>-build.md`
     - `/reports/<theme-name>-validation.md`
     - `/reports/<theme-name>-schema-diff.md`
   - Log build status in `/logs/harmony-score.json`.
   - Comment or commit summary:  
     `codex: new theme <theme-name> generated and validated`.

4. **Wait for Owner Input**
   - After successful build, Codex pauses for owner instructions (e.g., “customize color palette,” “add new block,” etc.).
   - No further actions until explicitly requested.

---

## 🧠 Behavior Rules

- Always base new themes on **official Salla documentation and schema**.  
- Never reuse outdated Raed/Luna structure without validating parity first.  
- Always generate **complete, ready-to-push** themes (no placeholders).  
- Use default Deemind tokens if no palette is specified.  
- Always enforce RTL/LTR logic and accessibility.  
- Every new theme build must pass:
  - Schema validation ✅  
  - CSS/JS lint ✅  
  - Token parity ✅  
  - Zero errors, ≤5 warnings ✅  

---

## 🧭 Reporting Standards

After each successful build, Codex must include:

| Report | Description |
|---------|--------------|
| `/reports/<theme-name>-build.md` | Step-by-step build summary with folder tree |
| `/reports/<theme-name>-validation.md` | Lint + schema + token parity results |
| `/reports/<theme-name>-schema-diff.md` | Comparison with latest Salla schema |
| `/logs/harmony-score.json` | Updated Harmony metrics and timestamps |

---

## 📦 Output Requirements

**Every generated theme must include:**

- Complete folder structure (`layouts/`, `pages/`, `partials/`, `assets/`)
- Valid `theme.json`
- `manifest.json`
- Compiled CSS + JS
- Fonts + placeholder images
- Build reports + logs

The final output must be **ready for immediate use with `salla push`**.

---

## 🧩 Example Trigger Phrases

Codex should recognize any of these as “new theme” directives:

- “Create a new Salla theme from scratch.”  
- “Generate a fresh theme based on Deemind engine.”  
- “Start a new theme build using Salla defaults.”  
- “Initialize a new output theme under /output/modern-store/.”  

All must trigger the same full-generation sequence.

---

## ✅ Success Definition

A theme is considered **successfully generated** when:

- Build completes without critical errors.  
- Schema and tokens validate 100%.  
- Theme passes Salla CLI validation.  
- `/output/<theme-name>.zip` exists and matches submission standards.  
- Harmony score ≥95 and logged.  

---

> **Instruction to Codex:**  
> Treat this directive as permanent.  
> Whenever the owner requests a “new theme from scratch,” you must execute the full process described here — generate, validate, document, and await further customization orders.  
> All outputs must remain fully Salla-compliant and Harmony-verified.

