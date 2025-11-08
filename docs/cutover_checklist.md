# Cutover Checklist

- [x] Three consecutive autopilot runs succeed (logs/codex-autopilot.log)
- [x] Validator success ≥ 95 % (warnings only for known themes)
- [x] No recurring flaky patterns in `logs/flaky.json`
- [x] /service endpoints tested (`/api/run`, `/api/status`, `/api/log/stream`)
- [x] Dashboard fully interactive (Run/Logs/Reports/Outputs work)
- [x] Desktop bundle (`npm run desktop:start`) launches service + UI
- [x] All GitHub workflows removed
- [x] No cron/Task Scheduler jobs calling old scripts
- [x] Codex write access revoked / automation disabled
- [x] Runbook (docs/runbook.md) confirmed usable
- [x] Core readiness documented (reports/core-readiness.md)
