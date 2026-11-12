# Controlled failure drills for the EnglishExamWeb runtime.
# Each scenario breaks exactly one component, then measures real automatic recovery.
# Nothing here touches database content, other containers, or English Coach.
param(
  [Parameter(Mandatory)][ValidateSet('backend', 'gateway', 'tunnel', 'containers', 'coldstart')][string]$Scenario,
  [int]$TimeoutSeconds = 300
)

$ErrorActionPreference = 'Continue'
. (Join-Path $PSScriptRoot 'config.ps1')
. (Join-Path $PSScriptRoot 'common.ps1')
$script:Quiet = $false
$script:LogName = 'drill'

$evidence = Join-Path $script:Root 'evidence\runtime'
if (-not (Test-Path -LiteralPath $evidence)) { New-Item -ItemType Directory -Force -Path $evidence | Out-Null }

function Test-PublicApi {
  $base = Get-PublicBaseUrl
  if (-not $base) { return $false }
  $probe = Invoke-ExternalProbe -Url "$base/api/me" -TimeoutSeconds 15
  return ($probe.Ok -and ($probe.Status -eq 401 -or $probe.Status -eq 200))
}

function Test-BackendApi {
  $r = Invoke-HttpProbe -Url "http://127.0.0.1:$($script:BackendPort)/actuator/health" -TimeoutSeconds 5
  return ($r.Ok -and $r.Status -eq 200)
}

function Wait-Recovery {
  param([string]$Label)
  $start = Get-Date
  $recovered = Wait-Until -TimeoutSeconds $TimeoutSeconds -IntervalSeconds 4 -Condition {
    (Test-BackendApi) -and (Test-TcpPort -Port $script:GatewayPort) -and (Test-PublicApi)
  }
  $elapsed = [int]((Get-Date) - $start).TotalSeconds
  return [pscustomobject]@{ label = $Label; recovered = $recovered; seconds = $elapsed }
}

$result = [ordered]@{
  scenario      = $Scenario
  startedAt     = (Get-Date).ToString('o')
  publicBaseUrl = Get-PublicBaseUrl
  steps         = @()
  recovered     = $false
  totalSeconds  = 0
}
$overallStart = Get-Date

switch ($Scenario) {
  'backend' {
    $before = @(Get-OwnedProcess -Marker $script:BackendJar -ProcessNames 'java.exe')
    Write-RuntimeLog "drill: stopping the backend JVM ($($before.Count) process(es))" -Level 'WARN'
    foreach ($p in $before) { Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue }
    $result.steps += [pscustomobject]@{ step = 'backend_stopped'; at = (Get-Date).ToString('o'); killed = $before.Count }
    $rec = Wait-Recovery -Label 'backend autostart'
    $result.steps += $rec
    $result.recovered = $rec.recovered
  }
  'gateway' {
    $before = @(Get-OwnedProcess -Marker $script:GatewayScript -ProcessNames 'node.exe')
    Write-RuntimeLog "drill: stopping the gateway process ($($before.Count) process(es))" -Level 'WARN'
    foreach ($p in $before) { Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue }
    $result.steps += [pscustomobject]@{ step = 'gateway_stopped'; at = (Get-Date).ToString('o'); killed = $before.Count }
    $rec = Wait-Recovery -Label 'gateway autostart'
    $result.steps += $rec
    $result.recovered = $rec.recovered
  }
  'tunnel' {
    $hostBefore = Get-PublicHost
    Write-RuntimeLog 'drill: resetting the Tailscale Funnel configuration' -Level 'WARN'
    & $script:TailscaleExe funnel reset 2>&1 | Out-Null
    Start-Sleep -Seconds 3
    $result.steps += [pscustomobject]@{ step = 'funnel_reset'; at = (Get-Date).ToString('o'); hostBefore = $hostBefore }
    $rec = Wait-Recovery -Label 'funnel reconfiguration'
    $result.steps += $rec
    $hostAfter = Get-PublicHost
    $result.steps += [pscustomobject]@{ step = 'hostname_comparison'; hostBefore = $hostBefore; hostAfter = $hostAfter; unchanged = ($hostBefore -eq $hostAfter) }
    $result.recovered = ($rec.recovered -and $hostBefore -eq $hostAfter)
  }
  'containers' {
    foreach ($name in @($script:IdentityContainer, $script:SqlContainer)) {
      Write-RuntimeLog "drill: restarting container $name" -Level 'WARN'
      & docker restart $name | Out-Null
      $result.steps += [pscustomobject]@{ step = "restarted_$name"; at = (Get-Date).ToString('o') }
      $state = & docker inspect --format '{{.State.Running}}' $name 2>$null
      $result.steps += [pscustomobject]@{ step = "state_$name"; running = ("$state".Trim() -eq 'true') }
      $port = if ($name -eq $script:SqlContainer) { $script:SqlPort } else { $script:IdentityPort }
      $up = Wait-Until -TimeoutSeconds 180 -IntervalSeconds 4 -Condition { Test-TcpPort -Port $port }
      $result.steps += [pscustomobject]@{ step = "port_$name"; port = $port; listening = $up }
    }
    $rec = Wait-Recovery -Label 'container recovery'
    $result.steps += $rec
    $result.recovered = $rec.recovered
  }
  'coldstart' {
    Write-RuntimeLog 'drill: simulating a cold start (all EnglishExamWeb runtime components down)' -Level 'WARN'
    foreach ($p in @(Get-OwnedProcess -Marker $script:BackendJar -ProcessNames 'java.exe')) { Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue }
    foreach ($p in @(Get-OwnedProcess -Marker $script:GatewayScript -ProcessNames 'node.exe')) { Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue }
    & $script:TailscaleExe funnel reset 2>&1 | Out-Null
    & docker stop $script:IdentityContainer $script:SqlContainer 2>&1 | Out-Null
    $result.steps += [pscustomobject]@{ step = 'runtime_stopped'; at = (Get-Date).ToString('o') }
    Start-Sleep -Seconds 5
    Write-RuntimeLog 'drill: invoking the Windows sign-in task exactly as Windows would' -Level 'INFO'
    Start-ScheduledTask -TaskName 'EnglishExamWeb Stack'
    $rec = Wait-Recovery -Label 'cold start from scheduled task'
    $result.steps += $rec
    $result.recovered = $rec.recovered
  }
}

$result.totalSeconds = [int]((Get-Date) - $overallStart).TotalSeconds
$result.finishedAt = (Get-Date).ToString('o')
$result.finalPublicApi = Test-PublicApi
$file = Join-Path $evidence ("drill-{0}-{1}.json" -f $Scenario, (Get-Date -Format yyyyMMdd-HHmmss))
Write-TextFile -Path $file -Content ($result | ConvertTo-Json -Depth 6)
Write-RuntimeLog ("drill {0}: recovered={1} in {2}s -> {3}" -f $Scenario, $result.recovered, $result.totalSeconds, $file) -Level $(if ($result.recovered) { 'INFO' } else { 'ERROR' })
$result | ConvertTo-Json -Depth 6
if (-not $result.recovered) { exit 1 }
