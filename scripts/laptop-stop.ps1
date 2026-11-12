<#
.SYNOPSIS
    Stops the EnglishExam portable laptop demonstration environment.
.DESCRIPTION
    Safely stops the Next.js frontend, Spring Boot backend, and dedicated
    laptop Docker containers (SQL Server and Keycloak) without affecting
    unrelated desktop services or Docker workloads.
.PARAMETER Clean
    If specified, removes Docker containers and volumes (data reset).
    By default, database data is preserved across stops and restarts.
#>
param(
    [switch]$Clean
)

$ErrorActionPreference = 'Stop'
$script:RootDir = (Resolve-Path "$PSScriptRoot\..").Path
$script:LocalDir = Join-Path $script:RootDir '.local\laptop'

Write-Host "Stopping EnglishExam Laptop Demonstration Environment..." -ForegroundColor Cyan

# 1. Stop frontend process
$frontendPidFile = Join-Path $script:LocalDir 'frontend.pid'
if (Test-Path -LiteralPath $frontendPidFile) {
    try {
        $fpid = [int](Get-Content -LiteralPath $frontendPidFile -ErrorAction SilentlyContinue)
        if ($fpid -gt 0) {
            $p = Get-Process -Id $fpid -ErrorAction SilentlyContinue
            if ($p) {
                Stop-Process -Id $fpid -Force -ErrorAction SilentlyContinue
                Write-Host "  - Stopped frontend process (PID $fpid)" -ForegroundColor Green
            }
        }
    } catch {}
    Remove-Item -LiteralPath $frontendPidFile -Force -ErrorAction SilentlyContinue
}

# 2. Stop backend process
$backendPidFile = Join-Path $script:LocalDir 'backend.pid'
if (Test-Path -LiteralPath $backendPidFile) {
    try {
        $bpid = [int](Get-Content -LiteralPath $backendPidFile -ErrorAction SilentlyContinue)
        if ($bpid -gt 0) {
            $p = Get-Process -Id $bpid -ErrorAction SilentlyContinue
            if ($p) {
                Stop-Process -Id $bpid -Force -ErrorAction SilentlyContinue
                Write-Host "  - Stopped backend process (PID $bpid)" -ForegroundColor Green
            }
        }
    } catch {}
    Remove-Item -LiteralPath $backendPidFile -Force -ErrorAction SilentlyContinue
}

# Also ensure any lingering listeners on port 3000 or 8081 started by this repo are stopped
foreach ($port in @(3000, 8081)) {
    $conn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    foreach ($c in $conn) {
        $proc = Get-CimInstance Win32_Process -Filter "ProcessId = $($c.OwningProcess)" -ErrorAction SilentlyContinue
        if ($proc -and ($proc.CommandLine -like "*$script:RootDir*")) {
            Stop-Process -Id $proc.ProcessId -Force -ErrorAction SilentlyContinue
            Write-Host "  - Stopped process on port $port (PID $($proc.ProcessId))" -ForegroundColor Yellow
        }
    }
}

# 3. Stop laptop Docker containers
Push-Location $script:RootDir
try {
    if ($Clean) {
        Write-Host "  - Stopping and removing laptop containers and volumes..." -ForegroundColor Yellow
        & docker compose -f compose.laptop.yaml down -v
    } else {
        Write-Host "  - Stopping laptop containers (preserving database data)..." -ForegroundColor Cyan
        & docker compose -f compose.laptop.yaml stop
    }
} finally {
    Pop-Location
}

Write-Host "EnglishExam Laptop Demonstration stopped successfully." -ForegroundColor Green
