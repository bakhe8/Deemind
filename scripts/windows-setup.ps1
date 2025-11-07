<#!
.SYNOPSIS
  One-time Windows setup for Deemind development.

.DESCRIPTION
  Uses winget (if available) to install Git (Git Bash), PowerShell 7, and nvm-windows.
  Then installs Node 20.10.0 and sets it as the active runtime.

.USAGE
  Right-click → Run with PowerShell (as user), or:
    PS> Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
    PS> .\scripts\windows-setup.ps1
#>

function Ensure-WinGet {
  if (Get-Command winget -ErrorAction SilentlyContinue) { return $true }
  Write-Warning "winget not found. Install from Microsoft Store (App Installer) and rerun."
  return $false
}

function Install-IfMissing {
  param([string]$Id, [string]$Name)
  if (-not (Ensure-WinGet)) { return }
  Write-Host "→ Ensuring $Name..."
  try {
    winget list --id $Id | Out-Null
    if ($LASTEXITCODE -ne 0) {
      winget install --id $Id --silent --accept-package-agreements --accept-source-agreements
    } else {
      Write-Host "$Name already present"
    }
  } catch { Write-Warning "winget check failed for $Name: $_" }
}

function Ensure-GitBash { Install-IfMissing -Id "Git.Git" -Name "Git (Git Bash)" }
function Ensure-PowerShell7 { Install-IfMissing -Id "Microsoft.PowerShell" -Name "PowerShell 7" }
function Ensure-Nvm { Install-IfMissing -Id "CoreyButler.NVMforWindows" -Name "nvm-windows" }

function Ensure-Node20 {
  if (Get-Command nvm -ErrorAction SilentlyContinue) {
    nvm install 20.10.0 | Out-Null
    nvm use 20.10.0 | Out-Null
    node -v
  } else {
    Write-Warning "nvm-windows not found (skipping Node install). Run this script again after nvm is installed."
  }
}

# Main
Ensure-GitBash
Ensure-PowerShell7
Ensure-Nvm
Ensure-Node20

Write-Host "✔ Setup complete. In VS Code, choose Git Bash as default terminal."

