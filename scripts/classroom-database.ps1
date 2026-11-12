param([ValidateSet('before','after')][string]$Phase='before')
$ErrorActionPreference='Stop'
$root=(Resolve-Path "$PSScriptRoot/..").Path
$out=Join-Path $root 'evidence/classroom'
foreach($line in (Get-Content -LiteralPath "$root/.env")){
 if($line -match '^([^#=]+)=(.*)$'){[Environment]::SetEnvironmentVariable($Matches[1],$Matches[2],'Process')}
}
function Connect-Database([string]$database,[switch]$Original){
 $b=New-Object System.Data.SqlClient.SqlConnectionStringBuilder
 $b['Initial Catalog']=$database;$b['TrustServerCertificate']=$true
 if($Original){$b['Data Source']='.\SQLEXPRESS';$b['Integrated Security']=$true}
 else{$b['Data Source']='127.0.0.1,14339';$b['User ID']='sa';$b['Password']=$env:SQL_SA_PASSWORD}
 $c=New-Object System.Data.SqlClient.SqlConnection $b.ConnectionString
 $c.Open();return $c
}
function Query-Json($connection,[string]$query){
 $cmd=$connection.CreateCommand();$cmd.CommandText=$query;$cmd.CommandTimeout=120
 $rd=$cmd.ExecuteReader();$text=New-Object System.Text.StringBuilder
 try{while($rd.Read()){[void]$text.Append($rd.GetString(0))}}finally{$rd.Close()}
 return $text.ToString()
}
foreach($dbName in @('EnglishExamDB','EnglishExamDB_WebDev','EnglishExamDB_WebTest')){
 $original=$dbName -eq 'EnglishExamDB'
 $c=Connect-Database $dbName -Original:$original
 try{
  if($Phase -eq 'before' -and -not $original){
   $stamp=Get-Date -Format 'yyyyMMdd-HHmmss'
   $filename="$dbName-classroom-before-$stamp.bak"
   $cmd=$c.CreateCommand();$cmd.CommandTimeout=120
   $cmd.CommandText="BACKUP DATABASE [$dbName] TO DISK=N'/var/opt/mssql/data/$filename' WITH COPY_ONLY,CHECKSUM; RESTORE VERIFYONLY FROM DISK=N'/var/opt/mssql/data/$filename' WITH CHECKSUM;"
   [void]$cmd.ExecuteNonQuery()
   & docker cp "english-exam-web-sql:/var/opt/mssql/data/$filename" "$root/.local/$filename"
   if($LASTEXITCODE -ne 0){throw 'Backup copy failed'}
   Write-Output "Verified COPY_ONLY backup: .local/$filename"
  }
  $tables=Query-Json $c "SELECT name FROM sys.tables WHERE is_ms_shipped=0 ORDER BY name FOR JSON PATH"
  $data=[ordered]@{}
  foreach($table in ($tables|ConvertFrom-Json)){
   $name=$table.name
   $json=Query-Json $c "SELECT * FROM dbo.[$name] ORDER BY 1,2 FOR JSON PATH, INCLUDE_NULL_VALUES"
   $sha=[Convert]::ToHexString([System.Security.Cryptography.SHA256]::HashData([Text.Encoding]::UTF8.GetBytes($json))).ToLowerInvariant()
   $data[$name]=@{sha256=$sha;rows=@($json|ConvertFrom-Json).Count}
  }
  $data|ConvertTo-Json -Depth 8|Set-Content -LiteralPath "$out/$dbName-data-$Phase.json" -Encoding utf8
 }finally{$c.Close()}
 if($original){& "$PSScriptRoot/snapshot.ps1" -Database $dbName -Output "classroom/$dbName-schema-$Phase.json"}
 else{& "$PSScriptRoot/snapshot.ps1" -Database $dbName -Output "classroom/$dbName-schema-$Phase.json" -Server 'tcp:127.0.0.1,14339' -SqlAuthentication}
}
