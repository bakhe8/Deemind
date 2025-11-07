Param(
  [string]$Repo = "",
  [string]$File = ".github/deemind-issues.json"
)

# Requires: GitHub CLI (gh) authenticated (gh auth login)
# Usage: powershell -ExecutionPolicy Bypass -File tools/gh-create-issues.ps1 -Repo EvaniaDeemind/deemind

if (-not (Test-Path $File)) { Write-Error "Issues file not found: $File"; exit 1 }
$issues = Get-Content -Raw $File | ConvertFrom-Json

# Create milestones via gh api and build title->number map
$msExisting = gh api repos/$Repo/milestones --paginate | ConvertFrom-Json
$msMap = @{}
foreach ($ms in $msExisting) { $msMap[$ms.title] = $ms.number }
$msTitles = $issues | Select-Object -ExpandProperty milestone -Unique | Where-Object { Param(
  [string]$Repo = "",
  [string]$File = ".github/deemind-issues.json"
)

# Requires: GitHub CLI (gh) authenticated (gh auth login)
# Usage: pwsh tools/gh-create-issues.ps1 -Repo EvaniaDeemind/deemind

if (-not (Test-Path $File)) { Write-Error "Issues file not found: $File"; exit 1 }
$issues = Get-Content -Raw $File | ConvertFrom-Json

# Ensure milestones exist
$milestones = $issues | Select-Object -ExpandProperty milestone -Unique
foreach ($m in $milestones) { if ($m) { gh milestone list --repo $Repo --state open | Select-String -Pattern [regex]::Escape($m) -Quiet | Out-Null; if (-not $?) { gh milestone create "$m" --repo $Repo | Out-Null } } }

# Ensure labels exist
$labels = $issues | ForEach-Object { $_.labels } | Where-Object { $_ } | ForEach-Object { $_ } | Select-Object -Unique
foreach ($l in $labels) { gh label list --repo $Repo | Select-String -Pattern "^$l\b" -Quiet | Out-Null; if (-not $?) { gh label create "$l" --repo $Repo --color FFFFFF | Out-Null } }

# Create issues
foreach ($i in $issues) {
  $milestoneArg = @(); if ($i.milestone) { $milestoneArg = @("--milestone", $i.milestone) }
  $labelArgs = @(); if ($i.labels) { foreach ($lab in $i.labels) { $labelArgs += @("--label", $lab) } }
  gh issue create --repo $Repo --title $i.title --body $i.body @milestoneArg @labelArgs | Write-Output
}

 -ne $null }
foreach ($mt in $msTitles) {
  if (-not $msMap.ContainsKey($mt)) {
    $created = gh api repos/$Repo/milestones -X POST -f title="$mt" | ConvertFrom-Json
    $msMap[$created.title] = $created.number
  }
}

# Ensure labels exist
$labels = $issues | ForEach-Object { Param(
  [string]$Repo = "",
  [string]$File = ".github/deemind-issues.json"
)

# Requires: GitHub CLI (gh) authenticated (gh auth login)
# Usage: pwsh tools/gh-create-issues.ps1 -Repo EvaniaDeemind/deemind

if (-not (Test-Path $File)) { Write-Error "Issues file not found: $File"; exit 1 }
$issues = Get-Content -Raw $File | ConvertFrom-Json

# Ensure milestones exist
$milestones = $issues | Select-Object -ExpandProperty milestone -Unique
foreach ($m in $milestones) { if ($m) { gh milestone list --repo $Repo --state open | Select-String -Pattern [regex]::Escape($m) -Quiet | Out-Null; if (-not $?) { gh milestone create "$m" --repo $Repo | Out-Null } } }

# Ensure labels exist
$labels = $issues | ForEach-Object { $_.labels } | Where-Object { $_ } | ForEach-Object { $_ } | Select-Object -Unique
foreach ($l in $labels) { gh label list --repo $Repo | Select-String -Pattern "^$l\b" -Quiet | Out-Null; if (-not $?) { gh label create "$l" --repo $Repo --color FFFFFF | Out-Null } }

# Create issues
foreach ($i in $issues) {
  $milestoneArg = @(); if ($i.milestone) { $milestoneArg = @("--milestone", $i.milestone) }
  $labelArgs = @(); if ($i.labels) { foreach ($lab in $i.labels) { $labelArgs += @("--label", $lab) } }
  gh issue create --repo $Repo --title $i.title --body $i.body @milestoneArg @labelArgs | Write-Output
}

.labels } | Where-Object { Param(
  [string]$Repo = "",
  [string]$File = ".github/deemind-issues.json"
)

# Requires: GitHub CLI (gh) authenticated (gh auth login)
# Usage: pwsh tools/gh-create-issues.ps1 -Repo EvaniaDeemind/deemind

if (-not (Test-Path $File)) { Write-Error "Issues file not found: $File"; exit 1 }
$issues = Get-Content -Raw $File | ConvertFrom-Json

# Ensure milestones exist
$milestones = $issues | Select-Object -ExpandProperty milestone -Unique
foreach ($m in $milestones) { if ($m) { gh milestone list --repo $Repo --state open | Select-String -Pattern [regex]::Escape($m) -Quiet | Out-Null; if (-not $?) { gh milestone create "$m" --repo $Repo | Out-Null } } }

# Ensure labels exist
$labels = $issues | ForEach-Object { $_.labels } | Where-Object { $_ } | ForEach-Object { $_ } | Select-Object -Unique
foreach ($l in $labels) { gh label list --repo $Repo | Select-String -Pattern "^$l\b" -Quiet | Out-Null; if (-not $?) { gh label create "$l" --repo $Repo --color FFFFFF | Out-Null } }

# Create issues
foreach ($i in $issues) {
  $milestoneArg = @(); if ($i.milestone) { $milestoneArg = @("--milestone", $i.milestone) }
  $labelArgs = @(); if ($i.labels) { foreach ($lab in $i.labels) { $labelArgs += @("--label", $lab) } }
  gh issue create --repo $Repo --title $i.title --body $i.body @milestoneArg @labelArgs | Write-Output
}

 } | ForEach-Object { Param(
  [string]$Repo = "",
  [string]$File = ".github/deemind-issues.json"
)

# Requires: GitHub CLI (gh) authenticated (gh auth login)
# Usage: pwsh tools/gh-create-issues.ps1 -Repo EvaniaDeemind/deemind

if (-not (Test-Path $File)) { Write-Error "Issues file not found: $File"; exit 1 }
$issues = Get-Content -Raw $File | ConvertFrom-Json

# Ensure milestones exist
$milestones = $issues | Select-Object -ExpandProperty milestone -Unique
foreach ($m in $milestones) { if ($m) { gh milestone list --repo $Repo --state open | Select-String -Pattern [regex]::Escape($m) -Quiet | Out-Null; if (-not $?) { gh milestone create "$m" --repo $Repo | Out-Null } } }

# Ensure labels exist
$labels = $issues | ForEach-Object { $_.labels } | Where-Object { $_ } | ForEach-Object { $_ } | Select-Object -Unique
foreach ($l in $labels) { gh label list --repo $Repo | Select-String -Pattern "^$l\b" -Quiet | Out-Null; if (-not $?) { gh label create "$l" --repo $Repo --color FFFFFF | Out-Null } }

# Create issues
foreach ($i in $issues) {
  $milestoneArg = @(); if ($i.milestone) { $milestoneArg = @("--milestone", $i.milestone) }
  $labelArgs = @(); if ($i.labels) { foreach ($lab in $i.labels) { $labelArgs += @("--label", $lab) } }
  gh issue create --repo $Repo --title $i.title --body $i.body @milestoneArg @labelArgs | Write-Output
}

 } | Select-Object -Unique
$lblExisting = gh api repos/$Repo/labels --paginate | ConvertFrom-Json
$lblSet = @{}
foreach ($l in $lblExisting) { $lblSet[$l.name] = $true }
foreach ($l in $labels) {
  if (-not $lblSet.ContainsKey($l)) {
    gh api repos/$Repo/labels -X POST -f name="$l" -f color=FFFFFF | Out-Null
    $lblSet[$l] = $true
  }
}

# Create issues
foreach ($i in $issues) {
  $args = @('--repo', $Repo, '--title', $i.title, '--body', $i.body)
  if ($i.milestone -and $msMap.ContainsKey($i.milestone)) {
    $args += @('--milestone', $msMap[$i.milestone])
  }
  if ($i.labels) {
    foreach ($lab in $i.labels) { $args += @('--label', $lab) }
  }
  gh issue create @args | Write-Output
}