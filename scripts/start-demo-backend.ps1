$ErrorActionPreference='Stop'
$root=(Resolve-Path "$PSScriptRoot/..").Path
$demo=Join-Path $root '.local/demo'
$state=Get-Content -LiteralPath "$demo/runtime.json" -Raw | ConvertFrom-Json
$secrets=Get-Content -LiteralPath "$demo/secrets.json" -Raw | ConvertFrom-Json
if($state.database -ne 'EnglishExamDB_Demo'){throw 'Dedicated database guard failed'}
$jar=Join-Path $demo 'english-exam-demo-api.jar'
$owned=@(Get-CimInstance Win32_Process -Filter "name='java.exe'" | Where-Object { $_.CommandLine -and $_.CommandLine.Replace('\','/').Contains($jar.Replace('\','/')) })
foreach($running in $owned){Stop-Process -Id $running.ProcessId -ErrorAction Stop;Wait-Process -Id $running.ProcessId -Timeout 15 -ErrorAction SilentlyContinue}
Copy-Item -LiteralPath "$root/backend/target/english-exam-api-1.0.0.jar" -Destination $jar -Force
$env:DB_URL='jdbc:sqlserver://127.0.0.1:14339;databaseName=EnglishExamDB_Demo;encrypt=true;trustServerCertificate=true'
$env:DB_USERNAME='exam_demo';$env:DB_PASSWORD=$secrets.dbPassword
$env:OIDC_ISSUER=$state.issuer;$env:OIDC_CLIENT_ID='english-exam-demo';$env:OIDC_CLIENT_SECRET=$secrets.clientSecret
$env:APP_ORIGIN=$state.origin;$env:COOKIE_SECURE='true';$env:SERVER_ADDRESS='127.0.0.1';$env:PORT='8082'
$argsList = @('"-Djava.net.preferIPv4Stack=true"', '"-Duser.timezone=UTC"', '-Xms128m', '-Xmx384m', '-jar', "`"$jar`"")
$process=Start-Process -FilePath 'java' -ArgumentList $argsList -WorkingDirectory $root -WindowStyle Hidden -PassThru -RedirectStandardOutput "$demo/backend.log" -RedirectStandardError "$demo/backend-error.log"
$process.Id|Set-Content "$demo/backend.pid"
Write-Output 'Isolated demo backend started on loopback.'
