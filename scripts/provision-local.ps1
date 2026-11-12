$ErrorActionPreference='Stop'
foreach($line in (Get-Content -LiteralPath "$PSScriptRoot\..\.env")){$k,$v=$line.Split('=',2);[Environment]::SetEnvironmentVariable($k,$v,'Process')}
$env:SQLCMDPASSWORD=$env:SQL_SA_PASSWORD
$root=Resolve-Path "$PSScriptRoot\.."
$exists=& sqlcmd -S 'tcp:127.0.0.1,14339' -U sa -C -h -1 -W -Q "SET NOCOUNT ON;SELECT COUNT(*) FROM sys.databases WHERE name='EnglishExamDB_WebDev'"
if($LASTEXITCODE -ne 0){throw 'SQL Server not ready'}
if([int]$exists.Trim() -eq 0){
 & sqlcmd -S 'tcp:127.0.0.1,14339' -U sa -C -b -i "$root\.local\initialize-dev.sql" -o "$root\.local\initialize-dev.log" -f 65001
 if($LASTEXITCODE -ne 0){throw 'Initialization failed; inspect .local/initialize-dev.log'}
}
$password=$env:SQL_APP_PASSWORD.Replace("'","''")
$sql=@"
USE master;
IF NOT EXISTS(SELECT 1 FROM sys.sql_logins WHERE name='exam_web')
 CREATE LOGIN exam_web WITH PASSWORD=N'$password',CHECK_POLICY=ON;
USE EnglishExamDB_WebDev;
IF NOT EXISTS(SELECT 1 FROM sys.database_principals WHERE name='exam_web') CREATE USER exam_web FOR LOGIN exam_web;
GRANT SELECT, VIEW DEFINITION ON SCHEMA::dbo TO exam_web;
GRANT EXECUTE ON dbo.usp_PublishExam TO exam_web;
GRANT EXECUTE ON dbo.usp_StartExam TO exam_web;
GRANT EXECUTE ON dbo.usp_SaveAnswer TO exam_web;
GRANT EXECUTE ON dbo.usp_SubmitExam TO exam_web;
GRANT INSERT,UPDATE ON dbo.Classes TO exam_web;
GRANT INSERT,UPDATE ON dbo.Exams TO exam_web;
GRANT INSERT,UPDATE ON dbo.Questions TO exam_web;
GRANT INSERT,UPDATE,DELETE ON dbo.AnswerOptions TO exam_web;
GRANT INSERT,UPDATE,DELETE ON dbo.ExamQuestions TO exam_web;
GRANT INSERT,UPDATE ON dbo.ExamAssignments TO exam_web;
GRANT INSERT,UPDATE,DELETE ON dbo.ClassEnrollments TO exam_web;
DENY INSERT,UPDATE,DELETE ON dbo.ExamAttempts TO exam_web;
DENY INSERT,UPDATE,DELETE ON dbo.StudentAnswers TO exam_web;
DENY ALTER ON SCHEMA::dbo TO exam_web;
DENY CREATE TABLE,CREATE VIEW,CREATE PROCEDURE,CREATE FUNCTION TO exam_web;
"@
$c=[System.Data.SqlClient.SqlConnection]::new("Server=127.0.0.1,14339;Database=master;User ID=sa;Password=$env:SQL_SA_PASSWORD;TrustServerCertificate=True")
$c.Open();try{$cmd=$c.CreateCommand();$cmd.CommandText=$sql;[void]$cmd.ExecuteNonQuery()}finally{$c.Close()}
Write-Output 'Dedicated SQL database and least-privilege application login ready.'
