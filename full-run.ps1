# Deemind Full Autopilot Run
param(
  [switch]$Push
)

$projectRoot = "C:\Users\Bakheet\Documents\peojects\deemind"
$pushFlag = $Push.IsPresent ? "" : " -- --no-push"

Write-Host "🤖 Running Deemind Autopilot$([string]::IsNullOrEmpty($pushFlag) ? '' : ' (no push)')..."
Start-Process powershell -ArgumentList "-NoLogo -Command cd `"$projectRoot`"; npm run codex:autopilot$pushFlag" -WorkingDirectory $projectRoot -Wait
