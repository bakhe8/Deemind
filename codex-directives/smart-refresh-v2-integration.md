# Deemind Smart Refresh v2.0 — Directive & Integration Plan

## ⚠️ Problem Overview

- Early refresh flow was fragile on Windows (load spikes, false idle, permissions).
- Missing safeguards caused overlapping runs, log bloat, execution-policy failures.
- Goal: self-healing, low-impact maintenance that stays invisible during active work.

## 🛡️ Enhanced Mitigation Features

| Area                 | Mitigation                    | Mechanism                                                             |
| -------------------- | ----------------------------- | --------------------------------------------------------------------- |
| CPU Spikes           | Prevent refresh under load    | CPU/RAM checks + BelowNormal priority + single-core affinity          |
| False Idle Detection | Multi-factor validation       | 5-point consensus (OS idle + dashboard + browser + network + session) |
| Permission Issues    | Self-elevating scheduler      | SYSTEM-level install or fallback to user Startup                      |
| Execution Policy     | Auto-repair + bypass relaunch | Detect restrictive policy → set RemoteSigned → re-run safely          |
| Concurrent Runs      | Mutex + process watchdog      | Prevents multiple instances, kills stuck ones                         |
| Log Growth           | Intelligent rotation          | Truncate or archive logs beyond 10 MB                                 |
| Safe Maintenance     | Low-impact tasks              | Rotates logs, clears caches, updates runtime state                    |

## 🧩 Architecture Overview

```
scripts/
 ├─ deemind-smart-refresh.ps1         # Main refresh controller (enhanced v2)
 ├─ deemind-smart-scheduler.ps1       # Auto Task Scheduler installer
runtime/
 └─ state/
     └─ deemind-refresh-state.json    # Tracks last run, idle state, refresh count
logs/
 ├─ deemind-maintenance.log           # Execution log
 └─ maintenance-archive/              # Archived old logs
```

## ⚙️ Core Logic Flow

1. **Entry Validation**
   - Check for other running instances (mutex + WMI scan).
   - Test CPU and memory load before proceeding.
   - Confirm idle state via multi-factor detection.
2. **Privilege & Policy Handling**
   - Auto-elevate if no admin privileges.
   - Repair or bypass restrictive PowerShell execution policies.
3. **Execution Phase**
   - Drop process to `BelowNormal` priority.
   - Lock to single CPU core to minimize interference.
   - Execute safe maintenance tasks: rotate logs, clear temp, refresh runtime state, optionally seed Salla schema when idle.
4. **Logging & Cleanup**
   - Append results to `logs/deemind-maintenance.log` (with rotation).
   - Update `runtime/state/deemind-refresh-state.json`.
   - Release mutex + watchdog handles.

## 🧠 Command Summary

| Task                                      | Command                    |
| ----------------------------------------- | -------------------------- |
| Manual smart refresh                      | `npm run refresh:smart`    |
| Immediate refresh                         | `npm run refresh:now`      |
| Forced refresh (ignore idle checks)       | `npm run refresh:force`    |
| Install scheduler (auto overnight + idle) | `npm run schedule:install` |
| Monitor activity manually                 | `npm run activity:monitor` |

## 🔄 Scheduler Triggers (Windows Task Scheduler)

| Trigger     | Condition          | Priority     |
| ----------- | ------------------ | ------------ |
| Overnight   | Daily at 2:00 AM   | 🟢 Low       |
| System Idle | 30 min no input    | 🟡 Medium    |
| User Logout | On Windows logoff  | 🟢 High      |
| Manual Run  | `npm` / PowerShell | 🔴 Immediate |

## 📊 Validation Checklist

| Check            | Criteria               | Status |
| ---------------- | ---------------------- | ------ |
| CPU Load         | < 70%                  | ✅     |
| Memory Load      | < 80%                  | ✅     |
| Idle Consensus   | ≥ 3 of 5 checks        | ✅     |
| Execution Policy | RemoteSigned or Bypass | ✅     |
| Mutex Lock       | Single instance        | ✅     |
| Logs             | ≤ 10 MB each           | ✅     |
| Refresh State    | Updated after run      | ✅     |

## 🔧 Codex Implementation Tasks

1. Replace current `deemind-smart-refresh.ps1` with Smart Refresh v2.0 (full mitigation suite).
2. Add enhanced scheduler installer (`deemind-smart-scheduler.ps1`).
3. Validate admin elevation and fallback user scheduling.
4. Connect refresh logs and state files under `/runtime/state/`.
5. Ensure npm script block includes all refresh commands.
6. Test automatic idle detection, log truncation, and lock cleanup.
7. Write execution reports to `/logs/deemind-maintenance.log`.
8. Confirm all mitigations operate correctly (CPU check, mutex, permissions).

## ✅ Expected End State

| Feature                | Outcome                                   |
| ---------------------- | ----------------------------------------- |
| Autonomous Maintenance | Refresh runs only when safe               |
| User Transparency      | Zero interruptions during work            |
| Self-Healing           | Permissions, locks, and policies auto-fix |
| Resource Safety        | No CPU spikes, no runaway logs            |
| Predictable Schedule   | Idle + overnight refresh windows          |
| Complete Logging       | Human-readable + machine-parsable logs    |

## 🔬 Smart Refresh v2 Validation Block

Run the following PowerShell block after installing Smart Refresh v2 (or after modifying either script). It executes the refresh controller in self-test mode, validates every mitigation, and prints a compact report that Codex (or any maintainer) can paste into the worklog.

```powershell
Set-StrictMode -Version Latest
$repoRoot = (Resolve-Path ".").ProviderPath
$scriptRoot = Join-Path $repoRoot 'scripts'
$refreshScript = Join-Path $scriptRoot 'deemind-smart-refresh.ps1'
$logFile = Join-Path $repoRoot 'logs\deemind-maintenance.log'
$stateFile = Join-Path $repoRoot 'runtime\state\deemind-refresh-state.json'

if (-not (Test-Path $refreshScript)) {
  throw "Smart refresh script not found at $refreshScript."
}

Write-Host "Running Smart Refresh self-test..." -ForegroundColor Cyan
$test = & $refreshScript -SelfTest -Verbose -ErrorAction Stop

$assertions = @(
  @{ Name = 'Mutex';        Passed = -not $test.ConcurrentRunDetected; Detail = $test.MutexNote },
  @{ Name = 'CPU Guard';    Passed = $test.CpuLoadPercent -lt 70 },
  @{ Name = 'Memory Guard'; Passed = $test.MemoryLoadPercent -lt 80 },
  @{ Name = 'Idle Check';   Passed = $test.IdleConsensus -ge 3; Detail = "$($test.IdleConsensus)/5 factors" },
  @{ Name = 'Policy Fix';   Passed = $test.ExecutionPolicy -in @('RemoteSigned','Bypass'); Detail = $test.ExecutionPolicy },
  @{ Name = 'Log Rotation'; Passed = (Test-Path $logFile) -and ((Get-Item $logFile).Length -le 10MB) },
  @{ Name = 'State Update'; Passed = (Test-Path $stateFile) }
)

$assertions | ForEach-Object {
  $status = if ($_.Passed) { 'PASS' } else { 'FAIL' }
  Write-Host ("[{0}] {1} {2}" -f $status, $_.Name, $_.Detail) -ForegroundColor (if ($_.Passed) { 'Green' } else { 'Red' })
}

Write-Host "`nSelf-test complete. Review $logFile for full trace and archive artifacts under logs/maintenance-archive." -ForegroundColor Cyan
```

### Validation Notes

- `-SelfTest` should be a no-op run mode inside `deemind-smart-refresh.ps1` that executes every guard (mutex, CPU/memory sampling, idle detection, log rotation) without touching production data.
- The block fails fast if the script is missing or returns unexpected telemetry.
- Log/state checks confirm rotation thresholds and `runtime/state` synchronization.
- Use this block inside CI or before handing off Smart Refresh work to prove safeguards are intact.
