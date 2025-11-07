<#!
.SYNOPSIS
  PowerShell helper functions for Windows shells when working on Deemind.

.NOTES
  Import once per session:
    PS> . ./scripts/ps-helpers.ps1
#>

function Invoke-Chain {
  param(
    [Parameter(Mandatory=$true)][string]$First,
    [Parameter(Mandatory=$true)][string]$Then
  )
  Invoke-Expression $First
  if ($LASTEXITCODE -eq 0) { Invoke-Expression $Then } else { exit $LASTEXITCODE }
}

function Write-HereString {
  param(
    [Parameter(Mandatory=$true)][string]$Path,
    [Parameter(Mandatory=$true)][string]$Content
  )
  $dir = Split-Path -Parent $Path
  if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }
  $Content | Set-Content -NoNewline -Encoding UTF8 $Path
}

function Replace-InFile {
  param(
    [Parameter(Mandatory=$true)][string]$Path,
    [Parameter(Mandatory=$true)][string]$Pattern,
    [Parameter(Mandatory=$true)][string]$Replacement
  )
  $text = Get-Content -Raw $Path
  $text = [Regex]::Replace($text, $Pattern, $Replacement)
  Set-Content -Encoding UTF8 $Path $text
}

function Use-Node20 {
  if (Get-Command nvm -ErrorAction SilentlyContinue) {
    nvm install 20.10.0 | Out-Null
    nvm use 20.10.0 | Out-Null
    node -v
  } else {
    Write-Host "nvm-windows not found. Install from https://github.com/coreybutler/nvm-windows" -ForegroundColor Yellow
  }
}

Export-ModuleMember -Function Invoke-Chain, Write-HereString, Replace-InFile, Use-Node20

