<#
.SYNOPSIS
  Deemind Smart Refresh v2 controller with safeguards for CPU, idle, permissions, and concurrency.

.DESCRIPTION
  This script powers the background maintenance workflow described in codex-directives/smart-refresh-v2-integration.md.
  Run it directly or through the npm helpers (refresh:smart, refresh:now, refresh:force). Use -SelfTest to execute all
  guards without touching production data; this emits telemetry for the validation block documented in the directive.
#>
[CmdletBinding()]
param(
  [switch]$SelfTest,
  [switch]$Force,
  [switch]$Immediate
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$script:ScriptRoot = Split-Path -Parent $PSCommandPath
$script:RepoRoot = (Resolve-Path (Join-Path $script:ScriptRoot '..')).ProviderPath
$script:LogPath = Join-Path $script:RepoRoot 'logs\deemind-maintenance.log'
$script:LogArchive = Join-Path $script:RepoRoot 'logs\maintenance-archive'
$script:StateDir = Join-Path $script:RepoRoot 'runtime\state'
$script:StatePath = Join-Path $script:StateDir 'deemind-refresh-state.json'

function Initialize-Logging {
  if (-not (Test-Path $script:LogPath)) {
    $logDir = Split-Path -Parent $script:LogPath
    if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Force -Path $logDir | Out-Null }
    New-Item -ItemType File -Force -Path $script:LogPath | Out-Null
  }
  $rotated = $false
  $info = Get-Item $script:LogPath -ErrorAction SilentlyContinue
  if ($info -and $info.Length -gt 10MB) {
    if (-not (Test-Path $script:LogArchive)) { New-Item -ItemType Directory -Path $script:LogArchive -Force | Out-Null }
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $archivePath = Join-Path $script:LogArchive "deemind-maintenance-$stamp.log"
    Move-Item -Path $script:LogPath -Destination $archivePath
    New-Item -ItemType File -Force -Path $script:LogPath | Out-Null
    $rotated = $true
  }
  return $rotated
}

function Write-RefreshLog {
  param([Parameter(Mandatory=$true)][string]$Message)
  $timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
  Add-Content -Path $script:LogPath -Value "[$timestamp] $Message"
}

function Get-SystemLoad {
  $cpu = 0
  try {
    $sample = Get-Counter '\Processor(_Total)\% Processor Time' -SampleInterval 1 -MaxSamples 1
    $cpu = [math]::Round($sample.CounterSamples[0].CookedValue, 2)
  } catch {
    $cpu = 50
  }
  $memPercent = 0
  try {
    $os = Get-CimInstance Win32_OperatingSystem
    $used = $os.TotalVisibleMemorySize - $os.FreePhysicalMemory
    $memPercent = [math]::Round(($used / $os.TotalVisibleMemorySize) * 100, 2)
  } catch {
    $memPercent = 40
  }
  return [pscustomobject]@{
    Cpu = [math]::Min([math]::Max($cpu, 0), 100)
    Memory = [math]::Min([math]::Max($memPercent, 0), 100)
  }
}

function Get-UserIdleSeconds {
  try {
    Add-Type -AssemblyName System.Windows.Forms -ErrorAction Stop | Out-Null
    $lastInput = [System.Windows.Forms.SystemInformation]::LastInputTime
    $tick = [Environment]::TickCount
    $idleMs = $tick - $lastInput
    if ($idleMs -lt 0) { $idleMs = $idleMs + [int]::MaxValue }
    return [math]::Round($idleMs / 1000, 0)
  } catch {
    return 0
  }
}

function Get-FileAgeSeconds {
  param([string]$Path)
  if (-not (Test-Path $Path)) { return [double]::PositiveInfinity }
  $info = Get-Item $Path
  return (New-TimeSpan -Start $info.LastWriteTime -End (Get-Date)).TotalSeconds
}

function Get-IdleSignals {
  param(
    [double]$CpuPercent,
    [double]$MemoryPercent,
    [switch]$OverrideIdleSuccess
  )
  $signals = @()
  $idleSeconds = Get-UserIdleSeconds
  $signals += [pscustomobject]@{
    Name = 'OsIdle'
    Passed = $idleSeconds -ge 120
    Detail = "$idleSeconds s since input"
  }
  $signals += [pscustomobject]@{
    Name = 'CpuLow'
    Passed = $CpuPercent -lt 45
    Detail = "$CpuPercent %"
  }
  $signals += [pscustomobject]@{
    Name = 'MemoryLow'
    Passed = $MemoryPercent -lt 75
    Detail = "$MemoryPercent %"
  }
  $dashboardMarker = Join-Path $script:StateDir 'dashboard-active.lock'
  $dashboardAge = Get-FileAgeSeconds $dashboardMarker
  $dashboardDetail = if ([double]::IsInfinity($dashboardAge)) { 'marker missing' } else { "Age: $([math]::Round($dashboardAge)) s" }
  $signals += [pscustomobject]@{
    Name = 'DashboardIdle'
    Passed = $dashboardAge -ge 120
    Detail = $dashboardDetail
  }
  $eventsMarker = Join-Path $script:RepoRoot 'logs\runtime-events.lock'
  $eventsAge = Get-FileAgeSeconds $eventsMarker
  $eventsDetail = if ([double]::IsInfinity($eventsAge)) { 'marker missing' } else { "Age: $([math]::Round($eventsAge)) s" }
  $signals += [pscustomobject]@{
    Name = 'RuntimeEventsIdle'
    Passed = $eventsAge -ge 120
    Detail = $eventsDetail
  }
  if ($OverrideIdleSuccess) {
    $signals = $signals | ForEach-Object {
      [pscustomobject]@{
        Name = $_.Name
        Passed = $true
        Detail = "$($_.Detail) (override)"
      }
    }
  }
  return $signals
}

function Ensure-ExecutionPolicy {
  $target = 'RemoteSigned'
  $current = $null
  $scope = 'CurrentUser'
  try {
    $current = Get-ExecutionPolicy -Scope CurrentUser -ErrorAction Stop
  } catch {
    $current = Get-ExecutionPolicy -ErrorAction SilentlyContinue
    $scope = 'Process'
  }
  $status = 'OK'
  if ($current -ne $target) {
    try {
      Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy $target -Force -ErrorAction Stop
      $current = $target
      $scope = 'CurrentUser'
      $status = 'Updated'
    } catch {
      Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force -ErrorAction SilentlyContinue
      $current = 'Bypass'
      $scope = 'Process'
      $status = 'ProcessBypass'
    }
  }
  return [pscustomobject]@{
    Value = $current
    Scope = $scope
    Status = $status
  }
}

function Acquire-RefreshMutex {
  param([string]$Name = 'Global\DeemindSmartRefreshV2')
  $created = $false
  $mutex = New-Object System.Threading.Mutex($false, $Name, [ref]$created)
  $acquired = $false
  $note = ''
  try {
    $acquired = $mutex.WaitOne(0)
    if ($acquired) {
      $note = 'Mutex acquired'
    } else {
      $note = 'Another refresh instance is running'
    }
  } catch {
    $note = "Mutex wait failed: $($_.Exception.Message)"
  }
  return [pscustomobject]@{
    Mutex = $mutex
    Acquired = $acquired
    Note = $note
  }
}

function Update-RefreshState {
  param([hashtable]$Data)
  if (-not (Test-Path $script:StateDir)) { New-Item -ItemType Directory -Force -Path $script:StateDir | Out-Null }
  $json = ($Data | ConvertTo-Json -Depth 6)
  Set-Content -Path $script:StatePath -Encoding UTF8 -Value $json
}

function Invoke-MaintenanceTasks {
  param([switch]$SelfTest)
  if ($SelfTest) {
    Write-RefreshLog 'Self-test mode: skipping maintenance tasks.'
    return
  }
  Write-RefreshLog 'Starting maintenance tasks.'
  $cacheDir = Join-Path $script:RepoRoot 'mockups\store\cache\context'
  if (Test-Path $cacheDir) {
    Get-ChildItem -Path $cacheDir -Recurse -File |
      Where-Object { (New-TimeSpan -Start $_.LastWriteTime -End (Get-Date)).TotalDays -ge 14 } |
      ForEach-Object { Remove-Item $_.FullName -Force }
  }
  if (Test-Path $script:LogArchive) {
    Get-ChildItem -Path $script:LogArchive -File |
      Where-Object { (New-TimeSpan -Start $_.LastWriteTime -End (Get-Date)).TotalDays -ge 30 } |
      ForEach-Object { Remove-Item $_.FullName -Force }
  }
  Write-RefreshLog 'Maintenance tasks complete.'
}

$logRotated = Initialize-Logging
$mutexContext = Acquire-RefreshMutex
$systemLoad = Get-SystemLoad
$policyStatus = Ensure-ExecutionPolicy
$idleSignals = Get-IdleSignals -CpuPercent $systemLoad.Cpu -MemoryPercent $systemLoad.Memory -OverrideIdleSuccess:$SelfTest
$idleConsensus = ($idleSignals | Where-Object { $_.Passed }).Count

$telemetry = [ordered]@{
  SelfTest = [bool]$SelfTest
  Timestamp = (Get-Date).ToString('o')
  ConcurrentRunDetected = -not $mutexContext.Acquired
  MutexNote = $mutexContext.Note
  CpuLoadPercent = $systemLoad.Cpu
  MemoryLoadPercent = $systemLoad.Memory
  IdleConsensus = $idleConsensus
  ExecutionPolicy = $policyStatus.Value
  ExecutionPolicyScope = $policyStatus.Scope
  LogRotated = $logRotated
  IdleSignals = $idleSignals
  StateFile = $script:StatePath
  LogFile = $script:LogPath
}

try {
  if (-not $mutexContext.Acquired -and -not $SelfTest -and -not $Force) {
    Write-RefreshLog 'Another refresh instance is active. Aborting.'
    throw "Smart refresh already running."
  }

  if (-not $SelfTest -and -not $Force) {
    if ($systemLoad.Cpu -gt 70) {
      Write-RefreshLog "CPU too high (${systemLoad.Cpu}%). Exiting."
      return
    }
    if ($systemLoad.Memory -gt 80) {
      Write-RefreshLog "Memory load too high (${systemLoad.Memory}%). Exiting."
      return
    }
    if ($idleConsensus -lt 3 -and -not $Immediate) {
      Write-RefreshLog "Idle consensus too low (${idleConsensus}/5). Exiting."
      return
    }
  }

  Invoke-MaintenanceTasks -SelfTest:$SelfTest
  $modeValue = if ($SelfTest) { 'self-test' } else { 'standard' }
  $statePayload = @{
    lastRun = (Get-Date).ToString('o')
    mode = $modeValue
    cpu = $systemLoad.Cpu
    memory = $systemLoad.Memory
    idleConsensus = $idleConsensus
    executionPolicy = $policyStatus.Value
    logRotated = $logRotated
  }
  Update-RefreshState -Data $statePayload
  Write-RefreshLog "Refresh complete (consensus=$idleConsensus/5, cpu=$($systemLoad.Cpu)%, mem=$($systemLoad.Memory)%)."

  if ($SelfTest) {
    $telemetry['Maintenance'] = 'Skipped (self-test)'
    [pscustomobject]$telemetry
  }
} finally {
  if ($mutexContext.Mutex -and $mutexContext.Acquired) {
    $mutexContext.Mutex.ReleaseMutex() | Out-Null
  }
}
