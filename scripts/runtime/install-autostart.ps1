# Registers the EnglishExamWeb runtime with Windows Task Scheduler.
# Tasks: bring-up at sign-in, a long-lived self-healing watchdog, and a keepalive guard.
param(
  [int]$StackDelaySeconds = 30,
  [int]$WatchdogDelaySeconds = 90,
  [switch]$Quiet
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'config.ps1')
. (Join-Path $PSScriptRoot 'common.ps1')
$script:Quiet = [bool]$Quiet
$script:LogName = 'autostart'

$user = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$stackScript = Join-Path $PSScriptRoot 'stack.ps1'
$watchdogScript = Join-Path $PSScriptRoot 'watchdog.ps1'
$keepaliveScript = Join-Path $PSScriptRoot 'keepalive.ps1'

function New-HiddenPowerShellAction {
  param([Parameter(Mandatory)][string]$ScriptPath, [string]$ScriptArguments = '')
  $argument = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$ScriptPath`""
  if ($ScriptArguments) { $argument = $argument + ' ' + $ScriptArguments }
  New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $argument -WorkingDirectory $script:Root
}

function New-LogonTrigger {
  param([int]$DelaySeconds)
  $trigger = New-ScheduledTaskTrigger -AtLogOn -User $user
  $trigger.Delay = "PT${DelaySeconds}S"
  return $trigger
}

$principal = New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive -RunLevel Highest

# 1. Bring-up at sign-in.
$stackSettings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 20) `
  -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 2)
Register-ScheduledTask -TaskName 'EnglishExamWeb Stack' -TaskPath '\' `
  -Description 'Starts and repairs the EnglishExamWeb production runtime (Docker containers, Keycloak, gateway, backend, Tailscale Funnel).' `
  -Action (New-HiddenPowerShellAction -ScriptPath $stackScript -ScriptArguments '-Quiet') `
  -Trigger (New-LogonTrigger -DelaySeconds $StackDelaySeconds) `
  -Settings $stackSettings -Principal $principal -Force | Out-Null
Write-RuntimeLog 'registered scheduled task: EnglishExamWeb Stack' -Level 'INFO'

# 2. Long-lived watchdog.
$watchdogSettings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 0) `
  -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1)
Register-ScheduledTask -TaskName 'EnglishExamWeb Watchdog' -TaskPath '\' `
  -Description 'Self-healing watchdog for EnglishExamWeb: verifies and repairs the runtime every 30 seconds.' `
  -Action (New-HiddenPowerShellAction -ScriptPath $watchdogScript) `
  -Trigger (New-LogonTrigger -DelaySeconds $WatchdogDelaySeconds) `
  -Settings $watchdogSettings -Principal $principal -Force | Out-Null
Write-RuntimeLog 'registered scheduled task: EnglishExamWeb Watchdog' -Level 'INFO'

# 3. Keepalive guard: restarts the watchdog if its heartbeat goes stale.
$keepaliveSettings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 5)
$repetition = New-ScheduledTaskTrigger -Once -At ((Get-Date).AddMinutes(1)) -RepetitionInterval (New-TimeSpan -Minutes 5) -RepetitionDuration (New-TimeSpan -Days 3650)
Register-ScheduledTask -TaskName 'EnglishExamWeb Keepalive' -TaskPath '\' `
  -Description 'Restarts the EnglishExamWeb watchdog when its heartbeat is stale.' `
  -Action (New-HiddenPowerShellAction -ScriptPath $keepaliveScript) `
  -Trigger $repetition `
  -Settings $keepaliveSettings -Principal $principal -Force | Out-Null
Write-RuntimeLog 'registered scheduled task: EnglishExamWeb Keepalive' -Level 'INFO'

# Docker Desktop must start with the user session so the engine is available after sign-in.
$runKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
$runValue = (Get-ItemProperty -Path $runKey -Name 'Docker Desktop' -ErrorAction SilentlyContinue).'Docker Desktop'
if (-not $runValue) {
  if (Test-Path -LiteralPath $script:DockerDesktopExe) {
    New-ItemProperty -Path $runKey -Name 'Docker Desktop' -Value ('"' + $script:DockerDesktopExe + '"') -PropertyType String -Force | Out-Null
    Write-RuntimeLog 'added Docker Desktop to the per-user Run key' -Level 'HEAL'
  } else {
    Write-RuntimeLog 'Docker Desktop executable not found; engine startup depends on the existing configuration' -Level 'WARN'
  }
} else {
  Write-RuntimeLog ("Docker Desktop already auto-starts: " + $runValue) -Level 'INFO'
}

$summary = Get-ScheduledTask -TaskName 'EnglishExamWeb *' | Select-Object TaskName, State
$summary | Format-Table -AutoSize | Out-String | Write-Host
