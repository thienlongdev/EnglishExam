$ErrorActionPreference='Stop'
$root=(Resolve-Path "$PSScriptRoot/..").Path
$profile=Get-Content -LiteralPath "$root/.local/demo/approval-profile.json" -Raw|ConvertFrom-Json
if($profile.role -notin @('teacher','student')){throw 'Unknown role'}
$values=@{};foreach($line in Get-Content -LiteralPath "$root/.env"){if($line -match '^([^#=]+)=(.*)$'){$values[$Matches[1]]=$Matches[2]}}
$b=New-Object System.Data.SqlClient.SqlConnectionStringBuilder
$b['Data Source']='127.0.0.1,14339';$b['Initial Catalog']='EnglishExamDB_Demo';$b['User ID']='sa';$b['Password']=$values.SQL_SA_PASSWORD;$b['TrustServerCertificate']=$true
$c=New-Object System.Data.SqlClient.SqlConnection $b.ConnectionString;$c.Open()
try{
 $cmd=$c.CreateCommand();$cmd.CommandText=@'
IF DB_NAME() <> N'EnglishExamDB_Demo' THROW 52000,'Dedicated demo guard failed',1;
SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF NOT EXISTS(SELECT 1 FROM dbo.Users WHERE Email=@email)
 INSERT dbo.Users(Email,FirstName,LastName,IsStudent,IsTeacher) VALUES(@email,@first,@last,@student,@teacher);
ELSE
 UPDATE dbo.Users SET IsActive=1,IsTeacher=CASE WHEN @teacher=1 THEN 1 ELSE IsTeacher END,
 IsStudent=CASE WHEN @student=1 THEN 1 ELSE IsStudent END WHERE Email=@email;
DECLARE @id int=(SELECT UserId FROM dbo.Users WHERE Email=@email);
IF @teacher=1 AND NOT EXISTS(SELECT 1 FROM dbo.Classes WHERE TeacherId=@id)
 INSERT dbo.Classes(ClassCode,ClassName,TeacherId) VALUES(CONCAT('DEMO-T-',@id),N'Teacher demo class',@id);
COMMIT;
'@
 [void]$cmd.Parameters.AddWithValue('@email',[string]$profile.email)
 [void]$cmd.Parameters.AddWithValue('@first',[string]$profile.firstName)
 [void]$cmd.Parameters.AddWithValue('@last',[string]$profile.lastName)
 [void]$cmd.Parameters.AddWithValue('@teacher',[bool]($profile.role -eq 'teacher'))
 [void]$cmd.Parameters.AddWithValue('@student',[bool]($profile.role -eq 'student'))
 [void]$cmd.ExecuteNonQuery();Write-Output 'Approved account mapped only in the dedicated demo database.'
}finally{$c.Close()}
