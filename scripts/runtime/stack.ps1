# Idempotent bring-up / repair of the EnglishExamWeb production runtime.
# Order: Docker engine -> containers -> identity config -> tunnel -> gateway -> backend -> public checks -> Vercel config.
# Safe to run at any time: it only touches the dedicated EnglishExamWeb containers and processes.
param(
  [switch]$CheckOnly,
  [int]$WaitSeconds = 240,
  [switch]$Quiet,
  [switch]$SkipVercel,
  [switch]$NoStepLog,
  [switch]$Json
)

$ErrorActionPreference = 'Continue'
. (Join-Path $PSScriptRoot 'config.ps1')
. (Join-Path $PSScriptRoot 'common.ps1')
$script:Quiet = [bool]$Quiet
$script:LogName = 'stack'

$mutex = New-Object System.Threading.Mutex($false, 'Local\EnglishExamWebRuntimeStack')
$acquired = $false
try { $acquired = $mutex.WaitOne(120000) } catch { $acquired = $false }
if (-not $acquired) {
  if (-not $Quiet) { Write-Host 'Another EnglishExamWeb runtime operation held the lock for more than 120s.' }
  exit 1
}

$steps = New-Object System.Collections.ArrayList
$script:PublicHost = Get-PublicHost
$script:PublicBase = Get-PublicBaseUrl

function Add-Step {
  param([string]$Name, [bool]$Ok, [string]$Detail, [bool]$Healed = $false, [bool]$Optional = $false)
  [void]$steps.Add([pscustomobject]@{ name = $Name; ok = $Ok; detail = $Detail; healed = $Healed; optional = $Optional })
  $level = 'INFO'
  if (-not $Ok) { $level = 'ERROR' } elseif ($Healed) { $level = 'HEAL' }
  $silent = ($Ok -and -not $Healed -and $NoStepLog)
  if (-not $silent) { Write-RuntimeLog ("{0}: {1}" -f $Name, $Detail) -Level $level }
}

function Test-DockerEngine {
  $v = & docker info --format '{{.ServerVersion}}' 2>$null
  return ($LASTEXITCODE -eq 0 -and $v)
}

function Test-ContainerRunning {
  param([string]$Name)
  $state = & docker inspect --format '{{.State.Status}}' $Name 2>$null
  if ($LASTEXITCODE -ne 0) { return $false }
  return ("$state".Trim() -eq 'running')
}

function Get-ExpectedIssuer { return "$($script:PublicBase)/realms/$($script:Realm)" }

function Get-Discovery {
  param([string]$BaseUrl)
  $r = Invoke-HttpProbe -Url "$BaseUrl/realms/$($script:Realm)/.well-known/openid-configuration" -TimeoutSeconds 8
  if (-not $r.Ok -or $r.Status -ne 200) { return $null }
  try { return ($r.Body | ConvertFrom-Json) } catch { return $null }
}

function Test-BackendHealthy {
  $r = Invoke-HttpProbe -Url "http://127.0.0.1:$($script:BackendPort)/actuator/health" -TimeoutSeconds 5
  return ($r.Ok -and $r.Status -eq 200 -and $r.Body -match '"status"\s*:\s*"UP"')
}

function Get-AuthorizationTarget {
  $r = Invoke-HttpProbe -Url "http://127.0.0.1:$($script:BackendPort)/oauth2/authorization/exam" -TimeoutSeconds 10 -NoRedirect
  if ($r.Ok -and $r.Status -ge 300 -and $r.Status -lt 400 -and $r.Location) { return $r.Location }
  return $null
}

function Restart-Backend {
  param([string]$Reason)
  if (-not (Test-RestartAllowed -Component 'backend')) {
    Write-RuntimeLog "backend restart throttled (restart storm guard): $Reason" -Level 'WARN'
    return $false
  }
  Write-RuntimeLog "restarting backend: $Reason" -Level 'HEAL'
  Save-RestartRecord -Component 'backend'
  Stop-OwnedProcess -Marker $script:BackendJar | Out-Null
  # Start the helper detached: piping a child that spawns a long-lived JVM can block on the pipe forever.
  $starterLog = Join-Path $script:RuntimeDir 'backend-starter.log'
  $proc = Start-Process -FilePath 'powershell' `
    -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $script:BackendScript) `
    -WorkingDirectory $script:Root -WindowStyle Hidden -PassThru `
    -RedirectStandardOutput $starterLog -RedirectStandardError ($starterLog + '.err')
  if (-not $proc.WaitForExit(90000)) {
    Write-RuntimeLog 'backend starter did not exit within 90s' -Level 'WARN'
  }
  return (Wait-Until -TimeoutSeconds 120 -IntervalSeconds 3 -Condition { Test-BackendHealthy })
}

function Restart-Gateway {
  param([string]$Reason)
  if (-not (Test-RestartAllowed -Component 'gateway')) {
    Write-RuntimeLog "gateway restart throttled (restart storm guard): $Reason" -Level 'WARN'
    return $false
  }
  Write-RuntimeLog "restarting gateway: $Reason" -Level 'HEAL'
  Save-RestartRecord -Component 'gateway'
  Stop-OwnedProcess -Marker $script:GatewayScript | Out-Null
  Start-HiddenProcess -FilePath 'node' -Arguments @($script:GatewayScript) -WorkingDirectory $script:Root `
    -StdOut (Join-Path $script:DemoDir 'gateway.log') -StdErr (Join-Path $script:DemoDir 'gateway-error.log') | Out-Null
  return (Wait-Until -TimeoutSeconds 45 -IntervalSeconds 1 -Condition { Test-TcpPort -Port $script:GatewayPort })
}

function Set-FunnelConfiguration {
  if (-not (Test-RestartAllowed -Component 'funnel' -MaxPerWindow 4)) {
    Write-RuntimeLog 'funnel reconfiguration throttled (restart storm guard)' -Level 'WARN'
    return $false
  }
  Save-RestartRecord -Component 'funnel'
  $svc = Get-Service -Name Tailscale -ErrorAction SilentlyContinue
  if ($svc -and $svc.Status -ne 'Running') {
    Write-RuntimeLog 'Tailscale service is not running; starting it' -Level 'HEAL'
    try { Start-Service -Name Tailscale } catch { Write-RuntimeLog "could not start Tailscale service: $($_.Exception.Message)" -Level 'ERROR' }
    Wait-Until -TimeoutSeconds 60 -IntervalSeconds 2 -Condition { (Get-Service -Name Tailscale).Status -eq 'Running' } | Out-Null
  }
  $script:PublicHost = Get-PublicHost
  if (-not $script:PublicHost) { return $false }
  if (-not (Test-FunnelConfigured -PublicHost $script:PublicHost -Port $script:GatewayPort)) {
    Write-RuntimeLog "configuring funnel $($script:PublicHost):$($script:FunnelHttpsPort) -> 127.0.0.1:$($script:GatewayPort)" -Level 'HEAL'
    $cmd = "`"$($script:TailscaleExe)`" funnel --bg --yes --https=$($script:FunnelHttpsPort) http://127.0.0.1:$($script:GatewayPort) < NUL 2>&1"
    $out = cmd /c $cmd
    Write-RuntimeLog ("tailscale funnel: " + (($out | Out-String).Trim())) -Level 'INFO'
  }
  return (Wait-Until -TimeoutSeconds 60 -IntervalSeconds 3 -Condition {
      $h = Get-PublicHost
      $h -and (Test-FunnelConfigured -PublicHost $h -Port $script:GatewayPort)
    })
}

# ---------------------------------------------------------------- 1. Docker engine
$dockerReady = $false
try {
  if (Test-DockerEngine) {
    $dockerReady = $true
    Add-Step 'docker-engine' $true 'docker engine available'
  } elseif ($CheckOnly) {
    Add-Step 'docker-engine' $false 'docker engine unavailable'
  } else {
    if (-not (Get-Process -Name 'Docker Desktop' -ErrorAction SilentlyContinue) -and (Test-Path -LiteralPath $script:DockerDesktopExe)) {
      Write-RuntimeLog 'starting Docker Desktop' -Level 'HEAL'
      Start-Process -FilePath $script:DockerDesktopExe | Out-Null
    }
    $dockerReady = Wait-Until -TimeoutSeconds $WaitSeconds -IntervalSeconds 5 -Condition { Test-DockerEngine }
    Add-Step 'docker-engine' $dockerReady $(if ($dockerReady) { 'docker engine started' } else { "docker engine did not become available within ${WaitSeconds}s" }) -Healed $dockerReady
  }
} catch { Add-Step 'docker-engine' $false $_.Exception.Message }

# ---------------------------------------------------------------- 2. SQL container
$sqlReady = $false
if ($dockerReady) {
  try {
    $sqlHealed = $false
    if (-not (Test-ContainerRunning -Name $script:SqlContainer)) {
      if ($CheckOnly) { throw "$($script:SqlContainer) is not running" }
      Write-RuntimeLog "starting $($script:SqlContainer)" -Level 'HEAL'
      & docker start $script:SqlContainer | Out-Null
      $sqlHealed = $true
    }
    $sqlReady = Wait-Until -TimeoutSeconds 120 -IntervalSeconds 3 -Condition { Test-TcpPort -Port $script:SqlPort }
    Add-Step 'container-sql' $sqlReady $(if ($sqlReady) { "SQL Server reachable on 127.0.0.1:$($script:SqlPort)" } else { 'SQL Server did not open its port' }) -Healed $sqlHealed
  } catch { Add-Step 'container-sql' $false $_.Exception.Message }
} else {
  Add-Step 'container-sql' $false 'skipped: docker engine unavailable'
}

# ---------------------------------------------------------------- 2b. Keycloak container
# The identity container must be started whenever it is not running, independently of any
# configuration change; otherwise a stopped container is never recovered.
if ($dockerReady) {
  try {
    $identityHealed = $false
    if (-not (Test-ContainerRunning -Name $script:IdentityContainer)) {
      if ($CheckOnly) { throw "$($script:IdentityContainer) is not running" }
      Write-RuntimeLog "starting $($script:IdentityContainer)" -Level 'HEAL'
      & docker start $script:IdentityContainer | Out-Null
      $identityHealed = $true
    }
    $identityListening = Wait-Until -TimeoutSeconds 120 -IntervalSeconds 3 -Condition { Test-TcpPort -Port $script:IdentityPort }
    Add-Step 'container-identity' $identityListening $(if ($identityListening) { "Keycloak reachable on 127.0.0.1:$($script:IdentityPort)" } else { 'Keycloak did not open its port' }) -Healed $identityHealed
  } catch { Add-Step 'container-identity' $false $_.Exception.Message }
} else {
  Add-Step 'container-identity' $false 'skipped: docker engine unavailable'
}

# ---------------------------------------------------------------- 3. Identity configuration + Keycloak container
try {
  if (-not (Test-Path -LiteralPath $script:KeycloakEnvFile)) { throw 'keycloak.env is missing; the isolated demo must be provisioned first' }
  $issuerExpected = Get-ExpectedIssuer

  $configChanged = $false
  $currentRuntime = $null
  if (Test-Path -LiteralPath $script:RuntimeJson) {
    try { $currentRuntime = Get-Content -LiteralPath $script:RuntimeJson -Raw | ConvertFrom-Json } catch { }
  }
  $runtimeDrift = (-not $currentRuntime) -or ($currentRuntime.tunnelUrl -ne $script:PublicBase) -or ($currentRuntime.issuer -ne $issuerExpected)

  $envLines = Get-Content -LiteralPath $script:KeycloakEnvFile
  $expectedHostLine = "KC_HOSTNAME=$($script:PublicBase)"
  $hostLine = @($envLines | Where-Object { $_ -match '^KC_HOSTNAME=(?!=)' }) | Select-Object -First 1
  $envDrift = ($hostLine -ne $expectedHostLine)

  if ($CheckOnly) {
    $discovery = Get-Discovery -BaseUrl "http://127.0.0.1:$($script:IdentityPort)"
    $ok = ($discovery -and $discovery.issuer -eq $issuerExpected) -and -not $runtimeDrift -and -not $envDrift
    $detail = if ($discovery) { "issuer=$($discovery.issuer)" } else { 'Keycloak discovery unavailable' }
    if (-not $ok) { $detail = "$detail; runtimeDrift=$runtimeDrift envDrift=$envDrift" }
    Add-Step 'identity-config' $ok $detail
  } else {
    if ($runtimeDrift) {
      if ($currentRuntime) {
        Copy-Item -LiteralPath $script:RuntimeJson -Destination (Join-Path $script:DemoDir ("runtime-before-{0}.json" -f (Get-Date -Format yyyyMMdd-HHmmss))) -Force
      }
      $payload = [ordered]@{
        tunnelUrl        = $script:PublicBase
        origin           = $script:PublicOrigin
        issuer           = $issuerExpected
        database         = $script:Database
        identityDatabase = $script:IdentityDatabase
        backendPort      = $script:BackendPort
        identityPort     = $script:IdentityPort
        gatewayPort      = $script:GatewayPort
        publicHost       = $script:PublicHost
        tunnelMode       = 'tailscale-funnel'
      }
      Write-TextFile -Path $script:RuntimeJson -Content ($payload | ConvertTo-Json)
      $configChanged = $true
      Write-RuntimeLog "runtime.json rebound to $($script:PublicBase)" -Level 'HEAL'
    }
    if ($envDrift) {
      $updated = @($envLines | Where-Object { $_ -notmatch '^KC_HOSTNAME=(?!=)' }) + $expectedHostLine
      Write-TextFile -Path $script:KeycloakEnvFile -Content (($updated -join "`r`n") + "`r`n")
      $configChanged = $true
      Write-RuntimeLog "keycloak.env rebound to $($script:PublicBase)" -Level 'HEAL'
    }
    if ($configChanged) {
      Write-RuntimeLog 'recreating the isolated identity container with the stable hostname' -Level 'HEAL'
      & docker compose --project-directory $script:Root -f $script:ComposeFile up -d --force-recreate --no-deps identity 2>&1 | Out-Null
    }
    $ok = Wait-Until -TimeoutSeconds 150 -IntervalSeconds 4 -Condition {
      $d = Get-Discovery -BaseUrl "http://127.0.0.1:$($script:IdentityPort)"
      return ($d -and $d.issuer -eq $issuerExpected)
    }
    $d2 = Get-Discovery -BaseUrl "http://127.0.0.1:$($script:IdentityPort)"
    if ($d2) { Add-Step 'identity-config' $ok "issuer=$($d2.issuer)" -Healed $configChanged }
    else { Add-Step 'identity-config' $false 'Keycloak discovery unavailable' }
  }
} catch { Add-Step 'identity-config' $false $_.Exception.Message }

# ---------------------------------------------------------------- 4. Gateway
try {
  $gatewayRunning = @(Get-OwnedProcess -Marker $script:GatewayScript -ProcessNames 'node.exe').Count -gt 0
  $gatewayListening = Test-TcpPort -Port $script:GatewayPort
  if ($gatewayRunning -and $gatewayListening) {
    Add-Step 'gateway' $true 'gateway listening on 127.0.0.1:8090'
  } elseif ($CheckOnly) {
    Add-Step 'gateway' $false 'gateway process is not serving 127.0.0.1:8090'
  } else {
    $healed = Restart-Gateway -Reason 'process or port missing'
    $ok = Test-TcpPort -Port $script:GatewayPort
    Add-Step 'gateway' $ok $(if ($ok) { 'gateway listening on 127.0.0.1:8090' } else { 'gateway did not open port 8090' }) -Healed $healed
  }
} catch { Add-Step 'gateway' $false $_.Exception.Message }

# ---------------------------------------------------------------- 5. Backend + OIDC issuer alignment
try {
  $backendRunning = @(Get-OwnedProcess -Marker $script:BackendJar -ProcessNames 'java.exe').Count -gt 0
  $healthy = Test-BackendHealthy
  $authTarget = Get-AuthorizationTarget
  $issuerExpected = Get-ExpectedIssuer
  $issuerAligned = [bool]($authTarget -and $authTarget.StartsWith($issuerExpected))

  $reason = $null
  if (-not $backendRunning) { $reason = 'managed backend process is not running' }
  elseif (-not $healthy) { $reason = 'health endpoint is not UP' }
  elseif (-not $issuerAligned) { $reason = "OIDC authorization target uses a stale issuer" }

  if (-not $reason) {
    Add-Step 'backend' $true "healthy, issuer=$issuerExpected"
  } elseif ($CheckOnly) {
    Add-Step 'backend' $false $reason
  } else {
    $healed = Restart-Backend -Reason $reason
    $healthy = Test-BackendHealthy
    $authTarget = Get-AuthorizationTarget
    $issuerAligned = [bool]($authTarget -and $authTarget.StartsWith($issuerExpected))
    $ok = ($healthy -and $issuerAligned)
    Add-Step 'backend' $ok $(if ($ok) { "healthy, issuer=$issuerExpected" } else { "restart did not restore the backend (health=$healthy issuerAligned=$issuerAligned)" }) -Healed $healed
  }
} catch { Add-Step 'backend' $false $_.Exception.Message }

# ---------------------------------------------------------------- 6. Tunnel / funnel
try {
  if ($CheckOnly) {
    $h = Get-PublicHost
    $ok = [bool]($h -and (Test-FunnelConfigured -PublicHost $h -Port $script:GatewayPort))
    Add-Step 'funnel' $ok $(if ($ok) { "funnel $h -> 127.0.0.1:$($script:GatewayPort)" } else { 'funnel is not configured for the gateway' })
  } else {
    $ok = Set-FunnelConfiguration
    $script:PublicHost = Get-PublicHost
    $script:PublicBase = Get-PublicBaseUrl
    Add-Step 'funnel' $ok $(if ($ok) { "funnel $($script:PublicHost) -> 127.0.0.1:$($script:GatewayPort)" } else { 'funnel could not be configured' })
  }
} catch { Add-Step 'funnel' $false $_.Exception.Message }

# ---------------------------------------------------------------- 7. Public surface through the internet ingress
try {
  if ($script:PublicBase) {
    $apiProbe = Invoke-ExternalProbe -Url "$($script:PublicBase)/api/me" -TimeoutSeconds 20
    $apiOk = ($apiProbe.Ok -and ($apiProbe.Status -eq 401 -or $apiProbe.Status -eq 200))
    Add-Step 'public-api' $apiOk $(if ($apiOk) { "HTTP $($apiProbe.Status) through public ingress $($apiProbe.Ip)" } else { "public /api/me failed: $($apiProbe.Error)" })

    $disc = Invoke-HttpProbe -Url "$($script:PublicBase)/realms/$($script:Realm)/.well-known/openid-configuration" -TimeoutSeconds 15
    $discIssuer = $null
    if ($disc.Ok -and $disc.Status -eq 200) { try { $discIssuer = ($disc.Body | ConvertFrom-Json).issuer } catch { } }
    $discOk = ($discIssuer -eq (Get-ExpectedIssuer))
    Add-Step 'public-identity' $discOk $(if ($discOk) { "discovery issuer=$discIssuer" } elseif ($discIssuer) { "discovery issuer=$discIssuer (expected $(Get-ExpectedIssuer))" } else { 'public discovery unavailable' })
  } else {
    Add-Step 'public-api' $false 'public hostname unknown'
    Add-Step 'public-identity' $false 'public hostname unknown'
  }
} catch { Add-Step 'public-api' $false $_.Exception.Message; Add-Step 'public-identity' $false 'not evaluated' }

# ---------------------------------------------------------------- 8. Vercel effective configuration
if (-not $SkipVercel) {
  try {
    $vercel = Get-VercelProductionBackendUrl
    if ($vercel.Ok) {
      $matches = [bool]($vercel.BackendUrl -and $script:PublicBase -and $vercel.BackendUrl.TrimEnd('/') -eq $script:PublicBase)
      Add-Step 'vercel-config' $matches $(if ($matches) { "production BACKEND_URL=$($vercel.BackendUrl)" } else { "production BACKEND_URL=$($vercel.BackendUrl) does not match $($script:PublicBase); redeploy required" })
    } else {
      Add-Step 'vercel-config' $false $vercel.Error
    }
  } catch { Add-Step 'vercel-config' $false $_.Exception.Message }

  try {
    $live = Invoke-HttpProbe -Url "$($script:PublicOrigin)/api/me" -TimeoutSeconds 25
    $liveOk = ($live.Ok -and ($live.Status -eq 401 -or $live.Status -eq 200))
    $liveDetail = if ($liveOk) { "production /api/me -> HTTP $($live.Status)" } elseif ($live.Ok) { "production /api/me -> HTTP $($live.Status) $($live.Body)" } else { "production /api/me -> $($live.Error)" }
    Add-Step 'vercel-live' $liveOk $liveDetail
  } catch { Add-Step 'vercel-live' $false $_.Exception.Message }
}

$required = @($steps | Where-Object { -not $_.optional })
$healthy = -not ($required | Where-Object { -not $_.ok })
$vercelStep = $steps | Where-Object { $_.name -eq 'vercel-config' } | Select-Object -First 1
$result = [pscustomobject]@{
  generatedAt      = (Get-Date).ToString('o')
  publicHost       = $script:PublicHost
  publicBaseUrl    = $script:PublicBase
  healthy          = $healthy
  dockerReady      = $dockerReady
  requiresRedeploy = [bool]($vercelStep -and -not $vercelStep.ok)
  steps            = $steps
}

if (-not $healthy -or -not $NoStepLog) {
  Write-RuntimeLog ("OVERALL healthy={0} public={1}" -f $healthy, $script:PublicBase) -Level $(if ($healthy) { 'INFO' } else { 'ERROR' })
}

$result | ConvertTo-Json -Depth 6 | ForEach-Object { Write-TextFile -Path (Join-Path $script:RuntimeDir 'last-run.json') -Content $_ }
if ($Json -or -not $Quiet) { $result | ConvertTo-Json -Depth 6 }

$mutex.ReleaseMutex()
$mutex.Dispose()
if ($healthy) { exit 0 } else { exit 1 }
