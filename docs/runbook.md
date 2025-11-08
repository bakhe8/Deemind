# Deemind Runbook (Local Operations)

## Start the Service API

```powershell
cd C:\Users\Bakheet\Documents\peojects\deemind
npm run service:start
```

- Runs on http://localhost:5757
- Optional bearer token from `service/config.json`

## Start the Dashboard

```powershell
cd C:\Users\Bakheet\Documents\peojects\deemind\dashboard
npm install   # first run only
npm run dev   # http://localhost:5758
```

- Use “Build All” to trigger Autopilot (no push)
- Use Validate / Doctor / Build Demo buttons as needed
- Logs stream live; Reports/Outputs panels list generated files

## Manual CLI Commands (if needed)

- Full autopilot: `npm run codex:autopilot`
- Demo build: `npm run deemind:build demo`
- Extended validation: `npm run deemind:validate`
- Doctor loop: `npm run doctor`

## Stopping Everything

- Ctrl+C in service terminal to stop API
- Ctrl+C in dashboard terminal to stop Vite

## Notes

- No GitHub workflows remain; everything runs locally.
- Keep autopilot logs in `/logs/codex-autopilot.log` for history.
- Update docs/reports from dashboard or CLI commands above.
