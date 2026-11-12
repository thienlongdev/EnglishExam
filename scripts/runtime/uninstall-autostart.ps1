# Removes the EnglishExamWeb scheduled tasks. Running processes and containers are left untouched.
$ErrorActionPreference = 'Continue'
foreach ($name in @('EnglishExamWeb Stack', 'EnglishExamWeb Watchdog', 'EnglishExamWeb Keepalive')) {
  $task = Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue
  if ($task) {
    try {
      Unregister-ScheduledTask -TaskName $name -Confirm:$false -ErrorAction Stop
      Write-Host "removed scheduled task: $name"
    } catch {
      Write-Host "could not remove ${name}: $($_.Exception.Message)"
    }
  } else {
    Write-Host "not present: $name"
  }
}
