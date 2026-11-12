-- Run only against the isolated development/test DB. No schema operations.
SET NOCOUNT ON;
IF DB_NAME() NOT IN('EnglishExamDB_WebDev','EnglishExamDB_WebTest') THROW 52000,'Refuse seed outside isolated database.',1;
BEGIN TRANSACTION;
IF NOT EXISTS(SELECT 1 FROM dbo.Users WHERE Email='teacher@exam.local')
 INSERT dbo.Users(Email,FirstName,LastName,IsTeacher) VALUES('teacher@exam.local',N'Minh',N'Nguyễn',1);
IF NOT EXISTS(SELECT 1 FROM dbo.Users WHERE Email='student@exam.local')
 INSERT dbo.Users(Email,FirstName,LastName,IsStudent) VALUES('student@exam.local',N'An',N'Trần',1);
IF NOT EXISTS(SELECT 1 FROM dbo.Users WHERE Email='outsider@exam.local')
 INSERT dbo.Users(Email,FirstName,LastName,IsStudent) VALUES('outsider@exam.local',N'Bình',N'Lê',1);
DECLARE @teacher int=(SELECT UserId FROM dbo.Users WHERE Email='teacher@exam.local'),@student int=(SELECT UserId FROM dbo.Users WHERE Email='student@exam.local');
IF NOT EXISTS(SELECT 1 FROM dbo.Classes WHERE ClassCode='WEB-ENG-01')
 INSERT dbo.Classes(ClassCode,ClassName,TeacherId) VALUES('WEB-ENG-01',N'Tiếng Anh nền tảng · Lớp 01',@teacher);
DECLARE @class int=(SELECT ClassId FROM dbo.Classes WHERE ClassCode='WEB-ENG-01');
IF NOT EXISTS(SELECT 1 FROM dbo.ClassEnrollments WHERE StudentId=@student AND ClassId=@class)
 INSERT dbo.ClassEnrollments(StudentId,ClassId) VALUES(@student,@class);
-- Reuse authored coursework questions in a new, legitimate demonstration exam.
IF NOT EXISTS(SELECT 1 FROM dbo.Exams WHERE ExamCode='WEB-FOUNDATION')
BEGIN
 INSERT dbo.Exams(ExamCode,Title,DurationMinutes,CreatedBy) VALUES('WEB-FOUNDATION',N'English foundations: Everyday language',20,@teacher);
 DECLARE @exam int=CONVERT(int,SCOPE_IDENTITY());
 INSERT dbo.ExamQuestions(ExamId,QuestionId,QuestionOrder,Points)
 SELECT TOP(10) @exam,QuestionId,ROW_NUMBER() OVER(ORDER BY QuestionId),1.00 FROM dbo.Questions ORDER BY QuestionId;
 EXEC dbo.usp_PublishExam @exam;
 INSERT dbo.ExamAssignments(ExamId,ClassId,OpensAt,ClosesAt,MaxAttempts,AuthorizedBy)
 VALUES(@exam,@class,DATEADD(day,-1,SYSUTCDATETIME()),DATEADD(day,180,SYSUTCDATETIME()),10,@teacher);
END;
COMMIT;
