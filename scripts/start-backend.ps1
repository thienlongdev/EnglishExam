$ErrorActionPreference='Stop'
$root=Resolve-Path "$PSScriptRoot\.."
foreach($line in (Get-Content -LiteralPath "$root\.env")){$k,$v=$line.Split('=',2);[Environment]::SetEnvironmentVariable($k,$v,'Process')}
$env:DB_PASSWORD=$env:SQL_APP_PASSWORD
$env:DB_URL='jdbc:sqlserver://127.0.0.1:14339;databaseName=EnglishExamDB_WebDev;encrypt=true;trustServerCertificate=true'
$env:APP_ORIGIN='http://localhost:3000'
Set-Location $root
# On Windows the running JVM locks its JAR. Stop only this project's process
# before Maven repackages; Java launch shims can make the recorded PID a parent.
$jar=Join-Path $root 'backend/target/english-exam-api-1.0.0.jar'
$owned=@(Get-CimInstance Win32_Process -Filter "name='java.exe'" | Where-Object { $_.CommandLine -and ($_.CommandLine.Replace('\','/') -like "*$($jar.Replace('\','/'))*") })
foreach($running in $owned){Stop-Process -Id $running.ProcessId -ErrorAction Stop;Wait-Process -Id $running.ProcessId -Timeout 15 -ErrorAction SilentlyContinue}
& mvn -B -q -f backend/pom.xml package -DskipTests
if($LASTEXITCODE -ne 0){throw 'Backend build failed'}
$pidFile=Join-Path $root '.local/backend.pid'
$process=Start-Process -FilePath 'java' -ArgumentList @('-Djava.net.preferIPv4Stack=true','-Duser.timezone=UTC','-Xms128m','-Xmx384m','-jar',"$root/backend/target/english-exam-api-1.0.0.jar") -WorkingDirectory $root -WindowStyle Hidden -PassThru -RedirectStandardOutput "$root/.local/backend.log" -RedirectStandardError "$root/.local/backend-error.log"
$process.Id|Set-Content $pidFile
Write-Output "Backend started; PID $($process.Id), http://127.0.0.1:8081/actuator/health"
