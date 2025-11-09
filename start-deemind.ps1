# Deemind Local Launcher (with logging and preview port isolation)
param(
  [int]$ServiceTimeout = 45,
  [int]$DashboardTimeout = 30
)

function Stop-PortProcess {
  param([int]$Port)
  try {
    $connections = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction Stop
    $pids = $connections | Select-Object -ExpandProperty OwningProcess -Unique | Where-Object { $_ -gt 0 }
    foreach ($pid in $pids) {
      try {
        $proc = Get-Process -Id $pid -ErrorAction Stop
        if ($proc.Path -like '*deemind*' -or $proc.Path -like '*node.exe*') {
          Write-Host "🧹 Stopping process $pid on port $Port ($($proc.Path))"
          Stop-Process -Id $pid -Force -ErrorAction Stop
        }
      } catch {}
    }
  } catch {}
}

function Wait-ForUrl {
  param(
    [string]$Url,
    [int]$TimeoutSeconds,
    [string]$Label = "Service"
  )

  $elapsed = 0
  $interval = 2
  Write-Host "⌛ Waiting for $Label on $Url ..."
  while ($elapsed -lt $TimeoutSeconds) {
    try {
      $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
        Write-Host "✅ $Label is up."
        return $true
      }
    } catch {}
    Start-Sleep -Seconds $interval
    $elapsed += $interval
  }
  Write-Warning "$Label did not respond within $TimeoutSeconds seconds."
  return $false
}

$projectRoot = "C:\Users\Bakheet\Documents\peojects\deemind"
$dashboardDir = Join-Path $projectRoot 'dashboard'
$serviceUrl = "http://localhost:5757/api/status"
$dashboardPort = 5759
$dashboardUrl = "http://localhost:$dashboardPort/"
$logDir = Join-Path $projectRoot 'logs\launcher'
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }
$timestamp = (Get-Date).ToString("yyyy-MM-ddTHH-mm-ss")
$serviceLog = Join-Path $logDir "service-$timestamp.log"
$dashboardLog = Join-Path $logDir "dashboard-$timestamp.log"

Stop-PortProcess -Port 5757
Stop-PortProcess -Port $dashboardPort

Write-Host "🚀 Starting Deemind service..."
Start-Process powershell -ArgumentList "-NoLogo -Command cd `"$projectRoot`"; npm run service:start *>> `"$serviceLog`"" -WorkingDirectory $projectRoot | Out-Null
Write-Host "🗒  Service log → $serviceLog"
Wait-ForUrl -Url $serviceUrl -TimeoutSeconds $ServiceTimeout -Label "Service"

Write-Host "🧱 Building dashboard bundle..."
Push-Location $dashboardDir
npm run build | Out-Null
Pop-Location

Write-Host "🖥  Starting Deemind dashboard (preview)..."
Start-Process powershell -ArgumentList "-NoLogo -Command cd `"$dashboardDir`"; npm run preview -- --host 127.0.0.1 --port $dashboardPort --strictPort *>> `"$dashboardLog`"" -WorkingDirectory $dashboardDir | Out-Null
Write-Host "🗒  Dashboard log → $dashboardLog"
Wait-ForUrl -Url $dashboardUrl -TimeoutSeconds $DashboardTimeout -Label "Dashboard"

Write-Host "🌐 Opening dashboard UI..."
Start-Process $dashboardUrl
