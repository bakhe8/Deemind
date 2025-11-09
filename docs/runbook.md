# Deemind Runbook — Runtime 1.1

This runbook keeps the whole Deemind × Salla factory running locally on Windows. Every step below uses PowerShell commands and fixed ports.

---

## 1. Daily Startup

```powershell
cd C:\Users\Bakheet\Documents\peojects\deemind
start-deemind.ps1          # launches service (5757) + dashboard (5758) + opens browser
# Example with options (dist dashboard + stub):
# start-deemind.ps1 -DashboardMode dist -DashboardPort 5758 -LaunchStub -Theme demo
```

If you prefer manual control:

```powershell
npm run service:start      # http://localhost:5757 (reads token from service/config.json)
cd dashboard
npm run dev                # http://localhost:5758
```

- Use the dashboard “Run” tab to trigger builds/validate/doctor without touching the CLI.
- Logs/Reports/Runtime tabs stream SSE data from the service in real time.
- `start-deemind.ps1` parameters:
  - `-DashboardMode dev|dist` (default dev)
  - `-DashboardPort <port>` (default 5758)
  - `-LaunchStub` / `-Theme` / `-StubPort` to spin up the runtime stub alongside the dashboard.

## 2. Theme Workflow

1. **Sync Salla Schemas**

   ```powershell
   npm run salla:sync
   ```

   Updates `core/salla/{schema,filters,partials}.json` + `meta.json`.

2. **Generate/Refresh Mock Data**

   ```powershell
   npm run mock:data demo electronics
   npm run mock:context demo
   ```

   Writes `mockups/store/cache/context/*.json` for previews + runtime. Runtime Inspector → “Mock Context” mirrors these files.

3. **Validate Theme Metadata**

   ```powershell
   npm run validate:theme -- input/demo/theme.json
   ```

4. **Build & Preview**

   ```powershell
   npm run deemind:build demo -- --auto
   npm run preview:launch demo    # seeds snapshots + starts runtime stub
   ```

5. **Scenario / Runtime QA**

   ```powershell
   npm run runtime:scenario -- --theme demo --chain checkout
   ```

6. **Doctor Loop (full gate)**
   ```powershell
   npm run doctor
   ```

## 3. Desktop Mode

```powershell
npm run desktop:start
```

Builds the dashboard (if needed), starts the service, and opens a bundled Electron window so you can operate everything from a single UI.

## 4. Maintenance Commands

| Task                            | Command                                                                                       |
| ------------------------------- | --------------------------------------------------------------------------------------------- |
| Clean busy ports                | `npm run ports:clean`                                                                         |
| Reset runtime stub state        | Dashboard → Settings → “Reset Stub” or `npm run preview:stub demo -- --reset`                 |
| Regenerate runtime context      | Dashboard → Runtime Inspector → “Mock Context” panel, or `npm run mock:data demo electronics` |
| Generate Twig dependency report | Occurs automatically during build (`reports/twig-dependency-<theme>.{json,md}`)               |
| Stream service logs             | Dashboard → Logs tab (SSE via `/api/log/stream`)                                              |
| Full smoke                      | `npm run runtime:smoke demo electronics`                                                      |

## 5. Shutdown

- `Ctrl+C` in service/dash terminals (or close Electron window).
- Runtime stub stops automatically when its terminal closes.

## 6. Logs & Reports

- Service logs → `logs/deemind-YYYY-MM-DD.log`.
- Build/validation reports → `output/<theme>/report*.json` + `reports/`.
- Dashboard “Reports” tab links directly to these files.

Keep this runbook beside the new architecture and Salla integration docs to ensure every operator follows the same blueprint. Update it whenever a new command or port is introduced.
