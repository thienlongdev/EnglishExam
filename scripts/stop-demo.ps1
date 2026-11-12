# Manual maintenance stop for the EnglishExamWeb runtime.
# The watchdog would otherwise restart everything within ~30 seconds, so this first pauses the
# supervision tasks and then stops only the dedicated EnglishExamWeb demo processes/container.
# SQL data, accounts, questions, exams and results are always preserved.
param([switch]$KeepSupervision)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path "$PSScriptRoot/..").Path
$demo = Join-Path $root '.local/demo'

if (-not $KeepSupervision) {
  foreach ($task in @('EnglishExamWeb Watchdog', 'EnglishExamWeb Keepalive', 'EnglishExamWeb Stack')) {
    $existing = Get-ScheduledTask -TaskName $task -ErrorAction SilentlyContinue
    if ($existing) { Stop-ScheduledTask -TaskName $task -ErrorAction SilentlyContinue }
  }
  Write-Output 'Paused the EnglishExamWeb supervision tasks (resume with scripts\runtime\install-autostart.ps1 and Start-ScheduledTask).'
}

& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'runtime\stack.ps1') -CheckOnly 2>&1 | Out-Null

foreach ($entry in @(@('tunnel.pid', "$demo/cloudflared-empty.yml"), @('gateway.pid', "$root/scripts/demo-gateway.mjs"))) {
  $file = Join-Path $demo $entry[0]
  if (Test-Path -LiteralPath $file) {
    $recorded = [int](Get-Content $file -Raw).Trim()
    $process = Get-CimInstance Win32_Process -Filter "ProcessId=$recorded" -ErrorAction SilentlyContinue
    if ($process -and $process.CommandLine -and $process.CommandLine.Replace('\', '/').Contains($entry[1].Replace('\', '/'))) {
      Stop-Process -Id $process.ProcessId -ErrorAction SilentlyContinue
    }
  }
}

$jar = Join-Path $demo 'english-exam-demo-api.jar'
Get-CimInstance Win32_Process -Filter "name='java.exe'" |
  Where-Object { $_.CommandLine -and $_.CommandLine.Replace('\', '/').Contains($jar.Replace('\', '/')) } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -ErrorAction SilentlyContinue }

Get-CimInstance Win32_Process -Filter "name='node.exe'" |
  Where-Object { $_.CommandLine -and $_.CommandLine.Replace('\', '/').Contains('scripts/demo-gateway.mjs') } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -ErrorAction SilentlyContinue }

& docker stop english-exam-demo-identity | Out-Null
Write-Output 'Only the EnglishExamWeb demo runtime was stopped. SQL data, accounts, and results are preserved. The public demo is unavailable until restarted.'
Write-Output 'Restart with: powershell -NoProfile -ExecutionPolicy Bypass -File scripts\runtime\recover.ps1'
