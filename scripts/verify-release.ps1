$ErrorActionPreference='Stop'
$root=(Resolve-Path "$PSScriptRoot\..").Path
Push-Location $root
try {
 foreach($line in Get-Content .env){$k,$v=$line.Split('=',2);[Environment]::SetEnvironmentVariable($k,$v,'Process')}
 & "$PSScriptRoot/snapshot.ps1" -Output original-recovery-after.json
 & "$PSScriptRoot/snapshot.ps1" -Server '127.0.0.1,14339' -Database EnglishExamDB_WebDev -SqlAuthentication -Output dev-recovery-after.json
 & "$PSScriptRoot/snapshot.ps1" -Server '127.0.0.1,14339' -Database EnglishExamDB_WebTest -SqlAuthentication -Output test-recovery-after.json
 & python -X utf8 "$PSScriptRoot/verify-contract.py" --phase after
 if($LASTEXITCODE -ne 0){throw 'Frozen contract comparison failed'}
} finally {Pop-Location}
