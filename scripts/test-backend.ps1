$ErrorActionPreference='Stop'
$root=Resolve-Path "$PSScriptRoot\.."
foreach($line in (Get-Content "$root\.env")){$k,$v=$line.Split('=',2);[Environment]::SetEnvironmentVariable($k,$v,'Process')}
$env:SQLCMDPASSWORD=$env:SQL_SA_PASSWORD
$exists=& sqlcmd -S 'tcp:127.0.0.1,14339' -U sa -C -h -1 -W -Q "SET NOCOUNT ON;SELECT COUNT(*) FROM sys.databases WHERE name='EnglishExamDB_WebTest'"
if($LASTEXITCODE -ne 0){throw 'SQL connection failed'}
if([int]$exists.Trim() -eq 0){
 $source=Get-Content -LiteralPath "$root\.local\initialize-dev.sql" -Raw
 [System.IO.File]::WriteAllText("$root\.local\initialize-test.sql",$source.Replace('EnglishExamDB_WebDev','EnglishExamDB_WebTest'))
 & sqlcmd -S 'tcp:127.0.0.1,14339' -U sa -C -b -f 65001 -i "$root\.local\initialize-test.sql" -o "$root\.local\initialize-test.log"
 if($LASTEXITCODE -ne 0){throw 'Test database initialization failed'}
}
# Reuse security provisioning against test DB only; it never drops or changes domain objects.
$provision=Get-Content "$root\scripts\provision-local.ps1" -Raw
$security=$provision.Substring($provision.IndexOf('$password=')).Replace('EnglishExamDB_WebDev','EnglishExamDB_WebTest')
Invoke-Expression $security
& sqlcmd -S 'tcp:127.0.0.1,14339' -U sa -C -d EnglishExamDB_WebTest -b -f 65001 -i "$root\scripts\seed-demo.sql"
if($LASTEXITCODE -ne 0){throw 'Seed failed'}
$env:DB_URL='jdbc:sqlserver://127.0.0.1:14339;databaseName=EnglishExamDB_WebTest;encrypt=true;trustServerCertificate=true'
$env:DB_PASSWORD=$env:SQL_APP_PASSWORD
$env:EXAM_SQL_TESTS='1'
& mvn -B -f "$root\backend\pom.xml" test '-DargLine=-Djava.net.preferIPv4Stack=true'
if($LASTEXITCODE -ne 0){throw 'Backend tests failed'}
