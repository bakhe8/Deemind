# 🧠 Deemind Codex Autonomous Directive

## Mission
Achieve 100% implementation coverage of `/docs/deemind_checklist.md`.

## Loop
1. Parse checklist
2. Compare repo files to tasks
3. For each missing or incomplete item:
   - Open a GitHub issue with clear title & description
   - Implement required code or config
   - Run `npm run deemind:validate`
   - Commit with proper conventional message
   - Close the issue
4. Update `/logs/deemind_audit_report.md` with summary
5. Repeat every 6 hours or on manual trigger

