param([string]$Database='EnglishExamDB',[string]$Output='original-before.json',[string]$Server='.\SQLEXPRESS',[switch]$SqlAuthentication,[string]$ConnectionStringVariable='')
$ErrorActionPreference='Stop'
$builder=New-Object System.Data.SqlClient.SqlConnectionStringBuilder
$builder['Data Source']=$Server;$builder['Initial Catalog']=$Database;$builder['TrustServerCertificate']=$true
if($SqlAuthentication){$builder['User ID']='sa';$builder['Password']=$env:SQL_SA_PASSWORD}else{$builder['Integrated Security']=$true}
if($ConnectionStringVariable){$connectionValue=[Environment]::GetEnvironmentVariable($ConnectionStringVariable);if(-not $connectionValue){throw 'Named connection environment variable is missing'};$builder.set_ConnectionString($connectionValue)}
$c=New-Object System.Data.SqlClient.SqlConnection $builder.ConnectionString
$c.Open()
$queries=[ordered]@{
 columns="SELECT t.name AS [table],c.column_id,c.name,ty.name AS type,c.max_length,c.precision,c.scale,c.is_nullable,c.is_identity,c.collation_name,dc.definition AS default_value FROM sys.tables t JOIN sys.columns c ON c.object_id=t.object_id JOIN sys.types ty ON ty.user_type_id=c.user_type_id LEFT JOIN sys.default_constraints dc ON dc.object_id=c.default_object_id ORDER BY t.name,c.column_id"
 keys="SELECT t.name AS [table],i.name,i.type_desc,i.is_unique,i.is_primary_key,i.is_unique_constraint,i.has_filter,i.filter_definition,c.name AS [column],ic.key_ordinal,ic.is_descending_key,ic.is_included_column FROM sys.tables t JOIN sys.indexes i ON i.object_id=t.object_id JOIN sys.index_columns ic ON ic.object_id=i.object_id AND ic.index_id=i.index_id JOIN sys.columns c ON c.object_id=ic.object_id AND c.column_id=ic.column_id ORDER BY t.name,i.name,ic.index_column_id"
 foreign_keys="SELECT fk.name,OBJECT_NAME(fk.parent_object_id) AS [table],pc.name AS [column],OBJECT_NAME(fk.referenced_object_id) AS referenced_table,rc.name AS referenced_column,fc.constraint_column_id,fk.delete_referential_action_desc,fk.update_referential_action_desc,fk.is_disabled,fk.is_not_trusted FROM sys.foreign_keys fk JOIN sys.foreign_key_columns fc ON fc.constraint_object_id=fk.object_id JOIN sys.columns pc ON pc.object_id=fc.parent_object_id AND pc.column_id=fc.parent_column_id JOIN sys.columns rc ON rc.object_id=fc.referenced_object_id AND rc.column_id=fc.referenced_column_id ORDER BY fk.name,fc.constraint_column_id"
 checks="SELECT OBJECT_NAME(parent_object_id) AS [table],name,definition,is_disabled,is_not_trusted FROM sys.check_constraints ORDER BY name"
 modules="SELECT o.name,o.type,m.definition,m.uses_ansi_nulls,m.uses_quoted_identifier,COALESCE(t.is_disabled,0) AS is_disabled FROM sys.objects o JOIN sys.sql_modules m ON m.object_id=o.object_id LEFT JOIN sys.triggers t ON t.object_id=o.object_id WHERE o.is_ms_shipped=0 ORDER BY o.type,o.name"
 counts="SELECT t.name,SUM(p.rows) AS rows FROM sys.tables t JOIN sys.partitions p ON p.object_id=t.object_id AND p.index_id IN(0,1) GROUP BY t.name ORDER BY t.name"
}
$result=[ordered]@{}
try{foreach($entry in $queries.GetEnumerator()){
 $cmd=$c.CreateCommand();$cmd.CommandText=$entry.Value;$rd=$cmd.ExecuteReader();$rows=@()
 while($rd.Read()){$row=[ordered]@{};for($i=0;$i -lt $rd.FieldCount;$i++){$v=$rd.GetValue($i);if($v -is [DBNull]){$v=$null};$row[$rd.GetName($i)]=$v};$rows+=,[pscustomobject]$row};$rd.Close();$result[$entry.Key]=$rows
};$result|ConvertTo-Json -Depth 10|Set-Content -LiteralPath (Join-Path "$PSScriptRoot\..\evidence" $Output) -Encoding utf8;Write-Output "Snapshot $Database -> $Output"}finally{$c.Close()}
