$ErrorActionPreference='Stop'
$root=(Resolve-Path "$PSScriptRoot/..").Path
$values=@{};foreach($line in Get-Content "$root/.env"){if($line -match '^([^#=]+)=(.*)$'){$values[$Matches[1]]=$Matches[2]}}
$env:SQLCMDPASSWORD=$values.SQL_SA_PASSWORD
$stamp=Get-Date -Format 'yyyyMMdd-HHmmss'
$receipts=@()
try{
 foreach($db in @('EnglishExamDB_Demo','EnglishExamDB_DemoIdentity')){
  $file="$db-$stamp.bak";$target=Join-Path $root ".local/demo/$file"
  if(Test-Path -LiteralPath $target){throw 'Backup target already exists'}
  & sqlcmd -S 'tcp:127.0.0.1,14339' -U sa -C -b -Q "BACKUP DATABASE [$db] TO DISK=N'/var/opt/mssql/data/$file' WITH COPY_ONLY,CHECKSUM; RESTORE VERIFYONLY FROM DISK=N'/var/opt/mssql/data/$file' WITH CHECKSUM;" -o "$root/.local/demo/$db-backup.log"
  if($LASTEXITCODE -ne 0){throw 'COPY_ONLY backup or VERIFYONLY failed'}
  & docker cp "english-exam-web-sql:/var/opt/mssql/data/$file" $target
  if($LASTEXITCODE -ne 0){throw 'Backup copy failed'}
  $receipts+=@{database=$db;path=$target;sha256=(Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash;verified=$true;copyOnly=$true}
 }
 $receipts|ConvertTo-Json|Set-Content "$root/evidence/production/backups-$stamp.json" -Encoding utf8
 Write-Output 'Both dedicated demo databases backed up and verified; no restore or overwrite performed.'
}finally{Remove-Item Env:SQLCMDPASSWORD -ErrorAction SilentlyContinue}
