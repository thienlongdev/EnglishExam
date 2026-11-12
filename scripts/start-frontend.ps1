param([switch]$Build)
$ErrorActionPreference='Stop'
$root=(Resolve-Path "$PSScriptRoot\..").Path
if($Build){Push-Location "$root\frontend";try{& npm run build;if($LASTEXITCODE -ne 0){throw 'Frontend build failed'}}finally{Pop-Location}}
if(-not (Test-Path "$root/frontend/.next/standalone/server.js") -or -not (Test-Path "$root/frontend/.next/static")){throw 'No complete production build. Run npm run build first.'}
$buildId=(Get-Content "$root/frontend/.next/BUILD_ID").Trim()
if($buildId -notmatch '^[A-Za-z0-9_-]+$'){throw 'Unexpected build identifier'}
$runtime=Join-Path "$root/.local" "frontend-runtime-$buildId"
New-Item -ItemType Directory -Path $runtime -Force|Out-Null
Get-ChildItem "$root/frontend/.next/standalone" -Force | Copy-Item -Destination $runtime -Recurse -Force
Copy-Item -LiteralPath "$root/frontend/.next/static" -Destination "$runtime/.next" -Recurse -Force
$listeners=Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
foreach($listener in $listeners){
 $running=Get-CimInstance Win32_Process -Filter "ProcessId = $($listener.OwningProcess)"
 $recorded=Test-Path "$root/.local/frontend.pid"
 $isOurs=($running.CommandLine -like "*$root*frontend*next*start*") -or ($running.CommandLine -like "*$root*frontend*.next*standalone*server.js*") -or ($running.CommandLine -like "*$root*.local*frontend-runtime-*server.js*") -or ($recorded -and $running.ProcessId -eq [int](Get-Content "$root/.local/frontend.pid") -and $running.CommandLine -like '*node_modules/next/dist/bin/next*start*')
 if(-not $isOurs){throw 'Port 3000 belongs to another process; refusing to stop it.'}
 Stop-Process -Id $running.ProcessId
}
$env:HOSTNAME='127.0.0.1';$env:PORT='3000'
$process=Start-Process -FilePath (Get-Command node).Source -ArgumentList @("$runtime/server.js") -WorkingDirectory "$root\frontend" -WindowStyle Hidden -PassThru -RedirectStandardOutput "$root/.local/frontend.log" -RedirectStandardError "$root/.local/frontend-error.log"
$process.Id|Set-Content "$root/.local/frontend.pid"
Write-Output "Frontend PID $($process.Id); http://localhost:3000"
