# Legacy manual entry point. It is no longer required for normal use: Windows starts the runtime
# automatically. Kept as a documented, idempotent recovery command.
#
# This never initializes, resets or reseeds a database; it only starts and repairs services.
param(
  [switch]$CheckOnly,
  [switch]$SkipVercel
)

$ErrorActionPreference = 'Stop'
$stack = Join-Path $PSScriptRoot 'runtime\stack.ps1'
if (-not (Test-Path -LiteralPath $stack)) { throw "Runtime automation is missing: $stack" }

Write-Host 'Delegating to scripts\runtime\stack.ps1 (idempotent, dependency-aware).'
$arguments = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $stack)
if ($CheckOnly) { $arguments += '-CheckOnly' }
if ($SkipVercel) { $arguments += '-SkipVercel' }

$process = Start-Process -FilePath 'powershell' -ArgumentList $arguments -WorkingDirectory (Split-Path -Parent $PSScriptRoot) -NoNewWindow -PassThru -Wait
exit $process.ExitCode
