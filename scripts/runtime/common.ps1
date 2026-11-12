# Shared helpers for the EnglishExamWeb runtime automation.
# No helper here mutates database content; everything is process and HTTP level.

try { Add-Type -AssemblyName System.Net.Http -ErrorAction SilentlyContinue } catch { }

function Write-TextFile {
  # Writes UTF-8 without a BOM: a BOM would corrupt keycloak.env keys and runtime.json parsing.
  param([Parameter(Mandatory)][string]$Path, [Parameter(Mandatory)][string]$Content)
  $dir = Split-Path -Parent $Path
  if ($dir -and -not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
  [System.IO.File]::WriteAllText($Path, $Content, (New-Object System.Text.UTF8Encoding($false)))
}

function Initialize-RuntimeDirs {
  foreach ($d in @($script:RuntimeDir, $script:LogDir)) {
    if (-not (Test-Path -LiteralPath $d)) { New-Item -ItemType Directory -Force -Path $d | Out-Null }
  }
}

function Write-RuntimeLog {
  param(
    [Parameter(Mandatory)][string]$Message,
    [ValidateSet('INFO', 'WARN', 'ERROR', 'STEP', 'HEAL')][string]$Level = 'INFO',
    [string]$Name
  )
  if (-not $PSBoundParameters.ContainsKey('Name')) {
    $Name = if ($script:LogName) { $script:LogName } else { 'runtime' }
  }
  Initialize-RuntimeDirs
  $line = '{0:yyyy-MM-ddTHH:mm:ss.fffzzz} [{1}] {2}' -f (Get-Date), $Level, $Message
  $file = Join-Path $script:LogDir ("{0}.log" -f $Name)
  try {
    if ((Test-Path -LiteralPath $file) -and ((Get-Item -LiteralPath $file).Length -gt 2MB)) {
      Move-Item -LiteralPath $file -Destination ($file + '.1') -Force
    }
    Add-Content -LiteralPath $file -Value $line -Encoding utf8
  } catch { }
  if (-not $script:Quiet) { Write-Host $line }
}

function Wait-Until {
  param(
    [Parameter(Mandatory)][scriptblock]$Condition,
    [int]$TimeoutSeconds = 60,
    [int]$IntervalSeconds = 2
  )
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  do {
    try { if (& $Condition) { return $true } } catch { }
    Start-Sleep -Seconds $IntervalSeconds
  } while ((Get-Date) -lt $deadline)
  return $false
}

function Test-TcpPort {
  param([int]$Port, [string]$TargetHost = '127.0.0.1', [int]$TimeoutMs = 1500)
  $client = New-Object System.Net.Sockets.TcpClient
  try {
    $task = $client.ConnectAsync($TargetHost, $Port)
    if (-not $task.Wait($TimeoutMs)) { return $false }
    return $client.Connected
  } catch { return $false } finally { $client.Dispose() }
}

function Get-OwnedProcess {
  param(
    [Parameter(Mandatory)][string]$Marker,
    [string[]]$ProcessNames = @('java.exe', 'node.exe')
  )
  $needle = $Marker.Replace('\', '/')
  $filter = ($ProcessNames | ForEach-Object { "Name='$_'" }) -join ' OR '
  @(
    Get-CimInstance Win32_Process -Filter $filter -ErrorAction SilentlyContinue |
      Where-Object { $_.CommandLine -and $_.CommandLine.Replace('\', '/').Contains($needle) }
  )
}

function Stop-OwnedProcess {
  param([Parameter(Mandatory)][string]$Marker, [int]$WaitSeconds = 20)
  $stopped = 0
  foreach ($p in Get-OwnedProcess -Marker $Marker) {
    try { Stop-Process -Id $p.ProcessId -Force -ErrorAction Stop; $stopped++ } catch { }
  }
  if ($stopped -gt 0) {
    $deadline = (Get-Date).AddSeconds($WaitSeconds)
    while ((Get-Date) -lt $deadline) {
      if (-not (Get-OwnedProcess -Marker $Marker)) { break }
      Start-Sleep -Milliseconds 400
    }
  }
  return $stopped
}

function Start-HiddenProcess {
  param(
    [Parameter(Mandatory)][string]$FilePath,
    [string[]]$Arguments = @(),
    [Parameter(Mandatory)][string]$WorkingDirectory,
    [string]$StdOut,
    [string]$StdErr
  )
  $params = @{
    FilePath         = $FilePath
    ArgumentList     = $Arguments
    WorkingDirectory = $WorkingDirectory
    WindowStyle      = 'Hidden'
    PassThru         = $true
  }
  if ($StdOut) { $params.RedirectStandardOutput = $StdOut }
  if ($StdErr) { $params.RedirectStandardError = $StdErr }
  $p = Start-Process @params
  return $p
}

function Invoke-HttpProbe {
  param(
    [Parameter(Mandatory)][string]$Url,
    [int]$TimeoutSeconds = 10,
    [switch]$NoRedirect,
    [hashtable]$Headers = @{}
  )
  $handler = New-Object System.Net.Http.HttpClientHandler
  $handler.AllowAutoRedirect = -not $NoRedirect
  $handler.UseProxy = $false
  $client = New-Object System.Net.Http.HttpClient($handler)
  $client.Timeout = [TimeSpan]::FromSeconds($TimeoutSeconds)
  foreach ($k in $Headers.Keys) { [void]$client.DefaultRequestHeaders.TryAddWithoutValidation($k, $Headers[$k]) }
  try {
    $response = $client.GetAsync($Url).GetAwaiter().GetResult()
    $body = ''
    try { $body = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult() } catch { }
    $location = $null
    if ($response.Headers.Location) { $location = $response.Headers.Location.ToString() }
    return [pscustomobject]@{
      Ok       = $true
      Status   = [int]$response.StatusCode
      Body     = $body
      Location = $location
      Error    = $null
    }
  } catch {
    return [pscustomobject]@{ Ok = $false; Status = 0; Body = ''; Location = $null; Error = $_.Exception.Message }
  } finally {
    $client.Dispose()
    $handler.Dispose()
  }
}

function Resolve-PublicIngressIps {
  param([Parameter(Mandatory)][string]$HostName)
  try {
    $r = Invoke-RestMethod "https://cloudflare-dns.com/dns-query?name=$HostName&type=A" -Headers @{ accept = 'application/dns-json' } -TimeoutSec 10
    @($r.Answer | Where-Object { $_.type -eq 1 } | ForEach-Object { $_.data })
  } catch { @() }
}

function Invoke-ExternalProbe {
  # Reaches the public hostname through the real internet ingress (ignores MagicDNS).
  param([Parameter(Mandatory)][string]$Url, [int]$TimeoutSeconds = 20)
  $uri = [uri]$Url
  if ($uri.Scheme -ne 'https') { return [pscustomobject]@{ Ok = $false; Status = 0; Ip = $null; Error = 'external probe requires https' } }
  $ips = Resolve-PublicIngressIps -HostName $uri.Host
  if (-not $ips -or $ips.Count -eq 0) {
    return [pscustomobject]@{ Ok = $false; Status = 0; Ip = $null; Error = 'public DNS returned no ingress address' }
  }
  $lastError = 'no ingress address reachable'
  foreach ($ip in $ips) {
    $out = & curl.exe -sS -o NUL -w '%{http_code}' --resolve "$($uri.Host):443:$ip" --max-time $TimeoutSeconds $Url 2>&1
    if ($LASTEXITCODE -eq 0 -and "$out" -match '^\d{3}$') {
      return [pscustomobject]@{ Ok = $true; Status = [int]$out; Ip = $ip; Error = $null }
    }
    $lastError = "$ip -> $out"
  }
  return [pscustomobject]@{ Ok = $false; Status = 0; Ip = $null; Error = $lastError }
}

function Get-TailscaleSelf {
  $raw = & $script:TailscaleExe status --json 2>$null
  if (-not $raw) { return $null }
  try { ($raw | ConvertFrom-Json).Self } catch { $null }
}

function Get-PublicHost {
  $self = Get-TailscaleSelf
  if (-not $self -or -not $self.DNSName) { return $null }
  return $self.DNSName.TrimEnd('.')
}

function Get-PublicBaseUrl {
  $hostName = Get-PublicHost
  if (-not $hostName) { return $null }
  return "https://$hostName"
}

function Get-FunnelStatusText {
  & $script:TailscaleExe funnel status 2>&1 | Out-String
}

function Test-FunnelConfigured {
  param([Parameter(Mandatory)][string]$PublicHost, [int]$Port = 8090)
  $text = Get-FunnelStatusText
  if (-not $text) { return $false }
  $hasHost = $text.Contains($PublicHost) -and $text.Contains('Funnel on')
  $hasProxy = $text.Contains("proxy http://127.0.0.1:$Port")
  return ($hasHost -and $hasProxy)
}

function Get-RuntimeState {
  if (-not (Test-Path -LiteralPath $script:StateFile)) { return @{} }
  try { (Get-Content -LiteralPath $script:StateFile -Raw | ConvertFrom-Json).restarts } catch { @{} }
}

function Save-RestartRecord {
  param([Parameter(Mandatory)][string]$Component)
  Initialize-RuntimeDirs
  $record = @{}
  if (Test-Path -LiteralPath $script:StateFile) {
    try {
      $existing = Get-Content -LiteralPath $script:StateFile -Raw | ConvertFrom-Json
      foreach ($p in $existing.restarts.PSObject.Properties) { $record[$p.Name] = @($p.Value) }
    } catch { }
  }
  $now = Get-Date
  $window = $record[$Component] | Where-Object { $_ -and (([datetime]$_).AddMinutes(10) -gt $now) }
  $window = @($window) + $now.ToString('o')
  $record[$Component] = @($window)
  $payload = [pscustomobject]@{ updatedAt = $now.ToString('o'); restarts = $record }
  Write-TextFile -Path $script:StateFile -Content ($payload | ConvertTo-Json -Depth 6)
}

function Test-RestartAllowed {
  # Bounded restarts: at most 8 per component in any rolling 10 minute window.
  param([Parameter(Mandatory)][string]$Component, [int]$MaxPerWindow = 8, [int]$WindowMinutes = 10)
  $record = Get-RuntimeState
  $timestamps = @($record[$Component] | Where-Object { $_ })
  if ($timestamps.Count -eq 0) { return $true }
  $now = Get-Date
  $recent = @($timestamps | Where-Object { ([datetime]$_).AddMinutes($WindowMinutes) -gt $now })
  return ($recent.Count -lt $MaxPerWindow)
}

function Get-VercelToken {
  if ($env:VERCEL_TOKEN) { return $env:VERCEL_TOKEN }
  $authFile = Join-Path $env:APPDATA 'com.vercel.cli\Data\auth.json'
  if (Test-Path -LiteralPath $authFile) {
    try { return (Get-Content -LiteralPath $authFile -Raw | ConvertFrom-Json).token } catch { }
  }
  return $null
}

function Get-VercelProductionBackendUrl {
  # Reads the *effective* production configuration from the Vercel API, never a local file.
  $token = Get-VercelToken
  if (-not $token) {
    return [pscustomobject]@{ Ok = $false; BackendUrl = $null; Error = 'no Vercel credential available (VERCEL_TOKEN or Vercel CLI auth.json)' }
  }
  $headers = @{ Authorization = "Bearer $token" }
  $base = "https://api.vercel.com/v9/projects/$($script:VercelProjectId)/env?teamId=$($script:VercelTeamId)"
  try {
    $envs = (Invoke-RestMethod $base -Headers $headers -TimeoutSec 30).envs
  } catch {
    return [pscustomobject]@{ Ok = $false; BackendUrl = $null; Error = "Vercel API unavailable: $($_.Exception.Message)" }
  }
  $entry = $envs | Where-Object { $_.key -eq 'BACKEND_URL' -and ($_.target -contains 'production') } | Select-Object -First 1
  if (-not $entry) {
    return [pscustomobject]@{ Ok = $true; BackendUrl = $null; Error = 'BACKEND_URL is not set for production' }
  }
  try {
    $detail = Invoke-RestMethod "https://api.vercel.com/v1/projects/$($script:VercelProjectId)/env/$($entry.id)?teamId=$($script:VercelTeamId)" -Headers $headers -TimeoutSec 30
    return [pscustomobject]@{ Ok = $true; BackendUrl = $detail.value; Error = $null; EnvId = $entry.id }
  } catch {
    return [pscustomobject]@{ Ok = $false; BackendUrl = $null; Error = "could not read BACKEND_URL value: $($_.Exception.Message)" }
  }
}
