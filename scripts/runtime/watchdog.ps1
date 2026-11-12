# Self-healing watchdog for the EnglishExamWeb production runtime.
# It runs the idempotent stack repair on a fixed interval, records a heartbeat,
# and never restarts unrelated services (English Coach containers are out of scope).
param(
  [int]$IntervalSeconds = 30,
  [int]$StackTimeoutSeconds = 600
)

$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'
. (Join-Path $PSScriptRoot 'config.ps1')
. (Join-Path $PSScriptRoot 'common.ps1')
$script:Quiet = $true
$script:LogName = 'watchdog'

Initialize-RuntimeDirs

$mutex = New-Object System.Threading.Mutex($false, 'Local\EnglishExamWebWatchdog')
$acquired = $false
try { $acquired = $mutex.WaitOne(0) } catch { $acquired = $false }
if (-not $acquired) {
  Write-RuntimeLog 'another watchdog instance is already running; exiting' -Level 'WARN'
  exit 0
}

$stack = Join-Path $PSScriptRoot 'stack.ps1'
$heartbeatFile = Join-Path $script:RuntimeDir 'heartbeat.json'
$lastRunFile = Join-Path $script:RuntimeDir 'last-run.json'
$cycle = 0
$lastHealthy = $null
$consecutiveFailures = 0

Write-RuntimeLog ("watchdog started (interval ${IntervalSeconds}s, stack timeout ${StackTimeoutSeconds}s)") -Level 'INFO'

while ($true) {
  $cycle++
  $started = Get-Date
  $exitCode = $null
  $timedOut = $false
  try {    $outLog = Join-Path $script:LogDir 'watchdog-stack.out.log'
    $errLog = Join-Path $script:LogDir 'watchdog-stack.err.log'
    $proc = Start-Process -FilePath 'powershell' `
      -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $stack, '-Quiet', '-NoStepLog') `
      -WorkingDirectory $script:Root -WindowStyle Hidden -PassThru `
      -RedirectStandardOutput $outLog -RedirectStandardError $errLog
    if (-not $proc.WaitForExit($StackTimeoutSeconds * 1000)) {
      $timedOut = $true
      try { Stop-Process -Id $proc.Id -Force -ErrorAction Stop } catch { }
      Write-RuntimeLog "stack repair exceeded ${StackTimeoutSeconds}s and was terminated" -Level 'ERROR'
    } else {
      $exitCode = $proc.ExitCode
      if ($exitCode -ne 0) {
        Write-RuntimeLog "stack repair reported unhealthy (exit code $exitCode)" -Level 'WARN'
      }
    }
  } catch {
    Write-RuntimeLog ("could not run the stack repair: " + $_.Exception.Message) -Level 'ERROR'
  }

  $healthy = $false
  $publicBase = $null
  try {
    if (Test-Path -LiteralPath $lastRunFile) {
      $state = Get-Content -LiteralPath $lastRunFile -Raw | ConvertFrom-Json
      $healthy = [bool]$state.healthy
      $publicBase = $state.publicBaseUrl
    }
  } catch { }

  if (-not $healthy) { $consecutiveFailures++ } else { $consecutiveFailures = 0 }

  $duration = [int]((Get-Date) - $started).TotalMilliseconds
  $heartbeat = [pscustomobject]@{
    at                 = $started.ToString('o')
    cycle              = $cycle
    intervalSeconds    = $IntervalSeconds
    healthy            = $healthy
    stackExitCode      = $exitCode
    timedOut           = $timedOut
    durationMs         = $duration
    consecutiveFailures = $consecutiveFailures
    publicBaseUrl      = $publicBase
    watchdogPid        = $PID
  }
  Write-TextFile -Path $heartbeatFile -Content ($heartbeat | ConvertTo-Json -Depth 4)

  if ($healthy -ne $lastHealthy) {
    Write-RuntimeLog ("state change: healthy={0} public={1} (cycle {2}, {3}ms)" -f $healthy, $publicBase, $cycle, $duration) -Level $(if ($healthy) { 'INFO' } else { 'ERROR' })
    $lastHealthy = $healthy
  } elseif (-not $healthy -and ($cycle % 20 -eq 0)) {
    Write-RuntimeLog ("still unhealthy after {0} consecutive cycles" -f $consecutiveFailures) -Level 'ERROR'
  } elseif ($healthy -and ($cycle % 40 -eq 0)) {
    Write-RuntimeLog ("heartbeat: healthy for {0} cycles, last check {1}ms" -f $cycle, $duration) -Level 'INFO'
  }

  Start-Sleep -Seconds $IntervalSeconds
}
