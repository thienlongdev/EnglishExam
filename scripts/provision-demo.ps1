$ErrorActionPreference='Stop'
$root=(Resolve-Path "$PSScriptRoot/..").Path
$local=Join-Path $root '.local/demo'
$values=@{}
foreach($line in Get-Content -LiteralPath "$root/.env") { if($line -match '^([^#=]+)=(.*)$') { $values[$Matches[1]]=$Matches[2] } }
$secrets=Get-Content -LiteralPath "$local/secrets.json" -Raw | ConvertFrom-Json
$builder=New-Object System.Data.SqlClient.SqlConnectionStringBuilder
$builder['Data Source']='127.0.0.1,14339';$builder['Initial Catalog']='master'
$builder['User ID']='sa';$builder['Password']=$values['SQL_SA_PASSWORD'];$builder['TrustServerCertificate']=$true
$connection=New-Object System.Data.SqlClient.SqlConnection $builder.ConnectionString
$connection.Open()
try {
 $cmd=$connection.CreateCommand();$cmd.CommandText="SELECT COUNT(*) FROM sys.databases WHERE name='EnglishExamDB_Demo'"
 if([int]$cmd.ExecuteScalar() -eq 0) {
  $env:SQLCMDPASSWORD=$values['SQL_SA_PASSWORD']
  & sqlcmd -S 'tcp:127.0.0.1,14339' -U sa -C -b -f 65001 -i "$local/initialize-demo.sql" -o "$local/initialize-demo.log"
  if($LASTEXITCODE -ne 0){throw 'Isolated demo initialization failed; inspect private log'}
 }
 $dbPassword=$secrets.dbPassword.Replace("'","''")
 $identityPassword=$secrets.identityDbPassword.Replace("'","''")
 $cmd=$connection.CreateCommand();$cmd.CommandTimeout=90;$cmd.CommandText=@"
IF DB_ID(N'EnglishExamDB_DemoIdentity') IS NULL
BEGIN
 CREATE DATABASE EnglishExamDB_DemoIdentity;
 ALTER DATABASE EnglishExamDB_DemoIdentity SET READ_COMMITTED_SNAPSHOT ON;
END;
"@
 [void]$cmd.ExecuteNonQuery()
 $sql=@"
IF NOT EXISTS(SELECT 1 FROM sys.sql_logins WHERE name='exam_demo')
 CREATE LOGIN exam_demo WITH PASSWORD=N'$dbPassword',CHECK_POLICY=ON;
IF NOT EXISTS(SELECT 1 FROM sys.sql_logins WHERE name='exam_demo_identity')
 CREATE LOGIN exam_demo_identity WITH PASSWORD=N'$identityPassword',CHECK_POLICY=ON;
USE EnglishExamDB_DemoIdentity;
IF NOT EXISTS(SELECT 1 FROM sys.database_principals WHERE name='exam_demo_identity')
BEGIN
 CREATE USER exam_demo_identity FOR LOGIN exam_demo_identity;
 ALTER ROLE db_owner ADD MEMBER exam_demo_identity;
END;
USE EnglishExamDB_Demo;
IF DB_NAME() <> N'EnglishExamDB_Demo' THROW 52000,'Demo database guard failed',1;
IF NOT EXISTS(SELECT 1 FROM sys.database_principals WHERE name='exam_demo') CREATE USER exam_demo FOR LOGIN exam_demo;
GRANT SELECT,VIEW DEFINITION ON SCHEMA::dbo TO exam_demo;
GRANT EXECUTE ON dbo.usp_PublishExam TO exam_demo;
GRANT EXECUTE ON dbo.usp_StartExam TO exam_demo;
GRANT EXECUTE ON dbo.usp_SaveAnswer TO exam_demo;
GRANT EXECUTE ON dbo.usp_SubmitExam TO exam_demo;
GRANT INSERT,UPDATE ON dbo.Users TO exam_demo;
GRANT INSERT,UPDATE ON dbo.Classes TO exam_demo;
GRANT INSERT,UPDATE ON dbo.Exams TO exam_demo;
GRANT INSERT,UPDATE ON dbo.Questions TO exam_demo;
GRANT INSERT,UPDATE,DELETE ON dbo.AnswerOptions TO exam_demo;
GRANT INSERT,UPDATE,DELETE ON dbo.ExamQuestions TO exam_demo;
GRANT INSERT,UPDATE ON dbo.ExamAssignments TO exam_demo;
GRANT INSERT,UPDATE,DELETE ON dbo.ClassEnrollments TO exam_demo;
DENY INSERT,UPDATE,DELETE ON dbo.ExamAttempts TO exam_demo;
DENY INSERT,UPDATE,DELETE ON dbo.StudentAnswers TO exam_demo;
DENY ALTER ON SCHEMA::dbo TO exam_demo;
DENY CREATE TABLE,CREATE VIEW,CREATE PROCEDURE,CREATE FUNCTION TO exam_demo;
IF NOT EXISTS(SELECT 1 FROM dbo.Users WHERE Email='teacher.demo@englishexam.invalid')
 INSERT dbo.Users(Email,FirstName,LastName,IsTeacher) VALUES('teacher.demo@englishexam.invalid',N'Minh',N'Nguyễn',1);
IF NOT EXISTS(SELECT 1 FROM dbo.Users WHERE Email='student.demo@englishexam.invalid')
 INSERT dbo.Users(Email,FirstName,LastName,IsStudent) VALUES('student.demo@englishexam.invalid',N'An',N'Trần',1);
IF NOT EXISTS(SELECT 1 FROM dbo.Users WHERE Email='outsider.demo@englishexam.invalid')
 INSERT dbo.Users(Email,FirstName,LastName,IsStudent) VALUES('outsider.demo@englishexam.invalid',N'Bình',N'Lê',1);
IF NOT EXISTS(SELECT 1 FROM dbo.Classes WHERE ClassCode='DEMO-ENG-01')
 INSERT dbo.Classes(ClassCode,ClassName,TeacherId)
 SELECT 'DEMO-ENG-01',N'English Exam · Public demo classroom',UserId FROM dbo.Users WHERE Email='teacher.demo@englishexam.invalid';
"@
 $cmd=$connection.CreateCommand();$cmd.CommandTimeout=90;$cmd.CommandText=$sql
 [void]$cmd.ExecuteNonQuery()
 Write-Output 'Isolated demo databases, least-privilege app login and three dedicated QA identities ready. Existing data was not reset.'
}finally{$connection.Close();Remove-Item Env:SQLCMDPASSWORD -ErrorAction SilentlyContinue}
