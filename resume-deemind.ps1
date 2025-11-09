param(
  [switch] $SkipDoctor
)

$ErrorActionPreference = 'Stop'

function Write-Step($message, $color = 'Cyan') {
  $ts = Get-Date -Format "HH:mm:ss"
  Write-Host "[resume @ $ts] $message" -ForegroundColor $color
}

function Invoke-CommandChecked {
  param(
    [string] $Command,
    [string[]] $Args
  )
  Write-Step "$Command $($Args -join ' ')" 'Green'
  $process = Start-Process -FilePath $Command -ArgumentList $Args -WorkingDirectory $PSScriptRoot -NoNewWindow -PassThru
  $process.WaitForExit()
  if ($process.ExitCode -ne 0) {
    throw "Command '$Command $($Args -join ' ')' failed with exit code $($process.ExitCode)."
  }
}

Set-Location $PSScriptRoot

$roadmapPath = Join-Path $PSScriptRoot 'internal/deemind-roadmap-local.json'
if (Test-Path $roadmapPath) {
  Write-Step "Checking roadmap checkpoints..."
  $roadmapJson = Get-Content $roadmapPath -Raw | ConvertFrom-Json
  $changed = $false
  foreach ($task in $roadmapJson.tasks) {
    if ($task.PSObject.Properties.Name -contains 'checkpoint' -and $task.checkpoint) {
      Write-Step "Clearing checkpoint on task '$($task.id)'." 'Yellow'
      $task.checkpoint = $false
      $changed = $true
    }
  }
  if ($changed) {
    $roadmapJson.generatedAt = Get-Date -Format o
    $roadmapJson | ConvertTo-Json -Depth 8 | Set-Content -Path $roadmapPath -Encoding UTF8
  } else {
    Write-Step "No checkpoints detected."
  }
} else {
  Write-Step "Roadmap file not found; skipping checkpoint check." 'Yellow'
}

$lockFile = Join-Path $PSScriptRoot 'logs/deemind-execution.lock'
if (Test-Path $lockFile) {
  Write-Step "Removing stale log lock file." 'Yellow'
  Remove-Item $lockFile -Force
}

$logPath = Join-Path $PSScriptRoot 'logs/deemind-execution.log'
if (Test-Path $logPath) {
  try {
    $stream = [System.IO.File]::Open($logPath, [System.IO.FileMode]::Open, [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::ReadWrite)
    $stream.Close()
    Write-Step "Log file accessible."
  } catch {
    Write-Step "Log file locked; creating backup and clearing lock." 'Yellow'
    $backup = "$logPath.bak"
    Copy-Item $logPath $backup -Force
  }
}

$ajvModulePath = Join-Path $PSScriptRoot 'node_modules/ajv'
if (-not (Test-Path $ajvModulePath)) {
  Write-Step "AJV module missing; installing..." 'Yellow'
  Invoke-CommandChecked -Command 'npm' -Args @('install', 'ajv')
} else {
  Write-Step "AJV dependency present."
}

if (-not $SkipDoctor) {
  Write-Step "Running npm run doctor to verify validator chain..."
  Invoke-CommandChecked -Command 'npm' -Args @('run', 'doctor')
} else {
  Write-Step "Doctor run skipped per parameter." 'Yellow'
}

Write-Step "Resuming Codex autopilot..."
Invoke-CommandChecked -Command 'node' -Args @('tools/codex-autopilot.js', '--resume', '--force')

Write-Step "Resume complete."
