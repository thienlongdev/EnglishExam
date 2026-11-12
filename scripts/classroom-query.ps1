param([Parameter(Mandatory)][string]$QueryBase64,[switch]$ApplicationLogin)
$ErrorActionPreference='Stop'
$root=(Resolve-Path "$PSScriptRoot/..").Path
$query=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($QueryBase64))
$commands=[regex]::Replace($query,"'(?:''|[^'])*'","''")
if($commands -notmatch '^\s*SELECT\b' -or $commands -match '(?i)\b(INSERT|UPDATE|DELETE|TRUNCATE|DROP|ALTER|EXEC|MERGE|INTO|BACKUP|RESTORE)\b'){throw 'Only read-only SELECT evidence is accepted'}
$values=@{}
foreach($line in (Get-Content -LiteralPath "$root/.env")){if($line -match '^([^#=]+)=(.*)$'){$values[$Matches[1]]=$Matches[2]}}
$b=New-Object System.Data.SqlClient.SqlConnectionStringBuilder
$b['Data Source']='127.0.0.1,14339';$b['Initial Catalog']='EnglishExamDB_WebDev';$b['TrustServerCertificate']=$true
if($ApplicationLogin){$b['User ID']='exam_web';$b['Password']=$values['SQL_APP_PASSWORD']}
else{$b['User ID']='sa';$b['Password']=$values['SQL_SA_PASSWORD']}
$c=New-Object System.Data.SqlClient.SqlConnection $b.ConnectionString
$c.Open()
try{
 $cmd=$c.CreateCommand();$cmd.CommandText=$query+' FOR JSON PATH, INCLUDE_NULL_VALUES';$cmd.CommandTimeout=30
 $rd=$cmd.ExecuteReader();$text=New-Object System.Text.StringBuilder
 while($rd.Read()){[void]$text.Append($rd.GetString(0))}
 $rd.Close();[Console]::OutputEncoding=[Text.Encoding]::UTF8;[Console]::WriteLine($text.ToString())
}finally{$c.Close()}
