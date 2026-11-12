# Keepalive guard: starts the watchdog when its heartbeat is stale and it is not running.
$ErrorActionPreference = 'Continue'
. (Join-Path $PSScriptRoot 'config.ps1')
. (Join-Path $PSScriptRoot 'common.ps1')
$script:Quiet = $true
$script:LogName = 'keepalive'

$heartbeatFile = Join-Path $script:RuntimeDir 'heartbeat.json'
$watchdogScript = Join-Path $PSScriptRoot 'watchdog.ps1'
$staleSeconds = 150

$running = @(Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -and $_.CommandLine.Replace('\', '/').Contains('scripts/runtime/watchdog.ps1') })

$stale = $true
if (Test-Path -LiteralPath $heartbeatFile) {
  try {
    $hb = Get-Content -LiteralPath $heartbeatFile -Raw | ConvertFrom-Json
    $age = ((Get-Date) - [datetime]$hb.at).TotalSeconds
    if ($age -lt $staleSeconds) { $stale = $false }
    Write-RuntimeLog ("watchdog heartbeat age {0:N0}s, processes={1}" -f $age, $running.Count) -Level 'INFO'
  } catch { }
} else {
  Write-RuntimeLog 'no watchdog heartbeat yet' -Level 'WARN'
}

if ($stale -and $running.Count -eq 0) {
  Write-RuntimeLog 'watchdog is not running and its heartbeat is stale; starting it' -Level 'HEAL'
  Start-Process -FilePath 'powershell' `
    -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-File', $watchdogScript) `
    -WorkingDirectory $script:Root -WindowStyle Hidden | Out-Null
} elseif ($stale -and $running.Count -gt 0) {
  Write-RuntimeLog 'watchdog process exists but heartbeat is stale; leaving the restart to Task Scheduler' -Level 'WARN'
}
