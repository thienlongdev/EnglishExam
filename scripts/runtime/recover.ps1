# One-command emergency recovery and status report for EnglishExamWeb.
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File scripts\runtime\recover.ps1
param(
  [switch]$SkipVercel,
  [switch]$StatusOnly
)

$ErrorActionPreference = 'Continue'
. (Join-Path $PSScriptRoot 'config.ps1')
. (Join-Path $PSScriptRoot 'common.ps1')
$script:LogName = 'recover'

$stack = Join-Path $PSScriptRoot 'stack.ps1'
Write-Host ''
Write-Host '==================================================================' -ForegroundColor Cyan
Write-Host ' EnglishExamWeb - emergency recovery / status' -ForegroundColor Cyan
Write-Host '==================================================================' -ForegroundColor Cyan

$arguments = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $stack, '-Json')
if ($StatusOnly) { $arguments += '-CheckOnly' }
if ($SkipVercel) { $arguments += '-SkipVercel' }

$proc = Start-Process -FilePath 'powershell' -ArgumentList $arguments -WorkingDirectory $script:Root -PassThru -NoNewWindow -Wait
$exitCode = $proc.ExitCode

$last = Join-Path $script:RuntimeDir 'last-run.json'
if (Test-Path -LiteralPath $last) {
  $state = Get-Content -LiteralPath $last -Raw | ConvertFrom-Json
  Write-Host ''
  Write-Host ("Public endpoint : " + $state.publicBaseUrl)
  Write-Host ("Overall healthy : " + $state.healthy)
  Write-Host ''
  foreach ($step in $state.steps) {
    $mark = if ($step.ok) { 'OK  ' } else { 'FAIL' }
    $color = if ($step.ok) { 'Green' } else { 'Red' }
    Write-Host ("  [{0}] {1,-16} {2}" -f $mark, $step.name, $step.detail) -ForegroundColor $color
  }
  Write-Host ''
}
Write-Host 'Logs: .local\runtime\logs\' -ForegroundColor DarkGray
Write-Host 'Watchdog heartbeat: .local\runtime\heartbeat.json' -ForegroundColor DarkGray
Write-Host ''
exit $exitCode
