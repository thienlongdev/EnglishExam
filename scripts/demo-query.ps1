param([Parameter(Mandatory)][string]$QueryBase64)
$ErrorActionPreference='Stop'
$root=(Resolve-Path "$PSScriptRoot/..").Path
$query=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($QueryBase64))
$commands=[regex]::Replace($query,"'(?:''|[^'])*'","''")
if($commands -notmatch '^\s*SELECT\b' -or $commands -match '(?i)\b(INSERT|UPDATE|DELETE|TRUNCATE|DROP|ALTER|EXEC|MERGE|INTO|BACKUP|RESTORE)\b'){throw 'Only read-only SELECT evidence is accepted'}
$secrets=Get-Content -LiteralPath "$root/.local/demo/secrets.json" -Raw|ConvertFrom-Json
$b=New-Object System.Data.SqlClient.SqlConnectionStringBuilder
$b['Data Source']='127.0.0.1,14339';$b['Initial Catalog']='EnglishExamDB_Demo';$b['TrustServerCertificate']=$true
$b['User ID']='exam_demo';$b['Password']=$secrets.dbPassword
$c=New-Object System.Data.SqlClient.SqlConnection $b.ConnectionString;$c.Open()
try{
 $cmd=$c.CreateCommand();$cmd.CommandText='SELECT DB_NAME()'
 if($cmd.ExecuteScalar() -ne 'EnglishExamDB_Demo'){throw 'Dedicated demo database required'}
 $cmd.CommandText=$query+' FOR JSON PATH, INCLUDE_NULL_VALUES';$cmd.CommandTimeout=30
 $rd=$cmd.ExecuteReader();$text=New-Object System.Text.StringBuilder
 while($rd.Read()){[void]$text.Append($rd.GetString(0))};$rd.Close()
 [Console]::OutputEncoding=[Text.Encoding]::UTF8;[Console]::WriteLine($text.ToString())
}finally{$c.Close()}
