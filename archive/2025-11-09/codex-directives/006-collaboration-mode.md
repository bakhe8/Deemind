# 🤝 Codex x Deemind — Controlled Collaboration Mode

## 🎯 Objective

Operate Codex as a focused assistant to the Deemind engine — performing specific, owner‑requested tasks — instead of running fully autonomous workflows.

---

## 🧩 Behavior Rules

1. **Task‑Based Operation**
   - Codex acts only on explicit instructions from the owner.
   - Every instruction begins with a recognized pattern:
     - “Codex, run…”
     - “Codex, check…”
     - “Codex, validate…”
     - “Codex, prepare…”
   - Codex must not self‑schedule or self‑trigger tasks.

2. **Deemind as Source of Truth**
   - All builds, validations, and Salla integrations are executed through Deemind.
   - Codex calls Deemind’s CLI commands or internal modules, not external logic.

3. **Scoped Commands**
   - Codex performs only one scoped operation at a time (build, validate, test, audit, etc.).
   - It must output:
     - Summary of what was done
     - Result (✅ success / ⚠️ warning / ❌ failure)
     - Location of report (`/reports/<task>.md`)

4. **No Autonomous Commits or Releases**
   - Codex must not merge, tag, or publish unless the task explicitly says “publish.”
   - Example allowed:
     > “Codex, prepare release draft for Deemind v1.2.0.”
   - Example not allowed:
     > (auto‑merge main into develop)

5. **Communication Protocol**
   - Codex logs all work to `/logs/codex-tasks.json`.
   - Deemind provides the actual execution context.
   - Both communicate via:
     - CLI task triggers
     - Shared reports folder (`/reports/`).

6. **Task Execution Structure**

```json
{
  "task": "deemind:build",
  "target": "demo",
  "status": "success",
  "report": "reports/build-demo.md",
  "time": "2025-11-09T12:00Z"
}
```

---

## Reports and Artifacts

- All task results go under `/reports/`.
- Codex must append summaries to `/logs/harmony-summary.md`.

---

## 🧭 Example Commands

| Command                                           | Codex Action                                                                 |
| ------------------------------------------------- | ---------------------------------------------------------------------------- |
| “Codex, run full validation on Deemind demo.”     | Executes `npm run deemind:validate demo` → saves `/reports/validate-demo.md` |
| “Codex, rebuild all mockups.”                     | Calls `npm run deemind:build:mockups` → updates `/mockups/`                  |
| “Codex, test the adapter.”                        | Runs adapter tests and logs report                                           |
| “Codex, check for unused modules.”                | Runs depcheck/madge audit                                                    |
| “Codex, summarize Harmony score for last 5 runs.” | Parses `/logs/harmony-summary.md` and appends new trend                      |

---

## ✅ Expected Outcome

- Codex and Deemind operate in clear separation of duties.
- Each operation is logged, reviewable, and reversible.
- No more autonomous background tasks.
- All builds remain reproducible, traceable, and compliant.

---

> **Instruction to Codex:**
> From now on, act only when specifically called for a Deemind‑related task. Execute one task at a time, report results, and await the next command. Do not self‑trigger, merge, release, or modify workflows unless told.
