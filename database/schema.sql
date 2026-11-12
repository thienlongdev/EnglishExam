-- ============================================================================
-- EnglishExamWeb: Authoritative Academic Database Schema
-- Academic Coursework Model: 10 Tables, 2 Views, 2 Indexes, 4 Stored Procedures, 10 Triggers
-- Target Database: EnglishExamDB_WebDev (Isolated Development / Laptop Demo)
-- ============================================================================

USE master;
GO
IF DB_ID(N'EnglishExamDB_WebDev') IS NULL
BEGIN
    CREATE DATABASE EnglishExamDB_WebDev;
END;
GO
ALTER DATABASE EnglishExamDB_WebDev SET RECOVERY SIMPLE;
ALTER DATABASE EnglishExamDB_WebDev SET READ_COMMITTED_SNAPSHOT ON;
GO
USE EnglishExamDB_WebDev;
GO
EXEC sys.sp_addextendedproperty @name=N'CourseworkOwner', @value=N'BTL-CSDL EnglishExamDatabaseCoursework 2026-10-12';
GO

-- SOURCE 01_Create_Tables.sql
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO
CREATE TABLE dbo.Users(
    UserId int IDENTITY(1,1) NOT NULL,
    Email nvarchar(200) NOT NULL,
    FirstName nvarchar(40) NOT NULL,
    MiddleName nvarchar(60) NULL,
    LastName nvarchar(40) NOT NULL,
    IsStudent bit NOT NULL DEFAULT 0,
    IsTeacher bit NOT NULL DEFAULT 0,
    IsActive bit NOT NULL DEFAULT 1,
    CONSTRAINT PK_Users PRIMARY KEY(UserId),
    CONSTRAINT UQ_Users_Email UNIQUE(Email),
    CONSTRAINT CK_Users_Email CHECK(Email LIKE N'%_@_%._%')
);
GO
CREATE TABLE dbo.Classes(
    ClassId int IDENTITY(1,1) NOT NULL,
    ClassCode varchar(20) NOT NULL,
    ClassName nvarchar(120) NOT NULL,
    TeacherId int NOT NULL,
    IsActive bit NOT NULL DEFAULT 1,
    CONSTRAINT PK_Classes PRIMARY KEY(ClassId),
    CONSTRAINT UQ_Classes_Code UNIQUE(ClassCode),
    CONSTRAINT FK_Classes_Teacher FOREIGN KEY(TeacherId) REFERENCES dbo.Users(UserId)
);
GO
CREATE TABLE dbo.Exams(
    ExamId int IDENTITY(1,1) NOT NULL,
    ExamCode varchar(20) NOT NULL,
    Title nvarchar(160) NOT NULL,
    DurationMinutes smallint NOT NULL,
    Status varchar(12) NOT NULL DEFAULT 'Draft',
    CreatedBy int NOT NULL,
    CONSTRAINT PK_Exams PRIMARY KEY(ExamId),
    CONSTRAINT UQ_Exams_Code UNIQUE(ExamCode),
    CONSTRAINT FK_Exams_Author FOREIGN KEY(CreatedBy) REFERENCES dbo.Users(UserId),
    CONSTRAINT CK_Exams_Status CHECK(Status IN ('Draft','Published')),
    CONSTRAINT CK_Exams_Duration CHECK(DurationMinutes BETWEEN 1 AND 180)
);
GO
CREATE TABLE dbo.Questions(
    QuestionId int IDENTITY(1,1) NOT NULL,
    QuestionText nvarchar(1000) NOT NULL,
    Category nvarchar(60) NOT NULL,
    Difficulty varchar(8) NOT NULL,
    CreatedBy int NOT NULL,
    CONSTRAINT PK_Questions PRIMARY KEY(QuestionId),
    CONSTRAINT FK_Questions_Author FOREIGN KEY(CreatedBy) REFERENCES dbo.Users(UserId),
    CONSTRAINT CK_Questions_Difficulty CHECK(Difficulty IN ('Easy','Medium','Hard'))
);
GO
CREATE TABLE dbo.AnswerOptions(
    QuestionId int NOT NULL,
    OptionCode char(1) NOT NULL,
    OptionText nvarchar(300) NOT NULL,
    IsCorrect bit NOT NULL,
    CONSTRAINT PK_AnswerOptions PRIMARY KEY(QuestionId,OptionCode),
    CONSTRAINT FK_AnswerOptions_Question FOREIGN KEY(QuestionId) REFERENCES dbo.Questions(QuestionId),
    CONSTRAINT CK_AnswerOptions_Code CHECK(OptionCode IN ('A','B','C','D'))
);
GO
CREATE TABLE dbo.ClassEnrollments(
    StudentId int NOT NULL,
    ClassId int NOT NULL,
    EnrolledAt datetime2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
    IsActive bit NOT NULL DEFAULT 1,
    CONSTRAINT PK_ClassEnrollments PRIMARY KEY(StudentId,ClassId),
    CONSTRAINT FK_Enrollments_Student FOREIGN KEY(StudentId) REFERENCES dbo.Users(UserId),
    CONSTRAINT FK_Enrollments_Class FOREIGN KEY(ClassId) REFERENCES dbo.Classes(ClassId)
);
GO
CREATE TABLE dbo.ExamQuestions(
    ExamId int NOT NULL,
    QuestionId int NOT NULL,
    QuestionOrder smallint NOT NULL,
    Points decimal(6,2) NOT NULL,
    CONSTRAINT PK_ExamQuestions PRIMARY KEY(ExamId,QuestionId),
    CONSTRAINT UQ_ExamQuestions_Order UNIQUE(ExamId,QuestionOrder),
    CONSTRAINT FK_ExamQuestions_Exam FOREIGN KEY(ExamId) REFERENCES dbo.Exams(ExamId),
    CONSTRAINT FK_ExamQuestions_Question FOREIGN KEY(QuestionId) REFERENCES dbo.Questions(QuestionId),
    CONSTRAINT CK_ExamQuestions_Values CHECK(QuestionOrder > 0 AND Points > 0)
);
GO
CREATE TABLE dbo.ExamAssignments(
    ExamId int NOT NULL,
    ClassId int NOT NULL,
    OpensAt datetime2(0) NOT NULL,
    ClosesAt datetime2(0) NOT NULL,
    MaxAttempts smallint NOT NULL,
    AuthorizedBy int NOT NULL,
    IsActive bit NOT NULL DEFAULT 1,
    CONSTRAINT PK_ExamAssignments PRIMARY KEY(ExamId,ClassId),
    CONSTRAINT FK_Assignments_Exam FOREIGN KEY(ExamId) REFERENCES dbo.Exams(ExamId),
    CONSTRAINT FK_Assignments_Class FOREIGN KEY(ClassId) REFERENCES dbo.Classes(ClassId),
    CONSTRAINT FK_Assignments_Authorizer FOREIGN KEY(AuthorizedBy) REFERENCES dbo.Users(UserId),
    CONSTRAINT CK_Assignments_Window CHECK(OpensAt < ClosesAt AND MaxAttempts BETWEEN 1 AND 10)
);
GO
CREATE TABLE dbo.ExamAttempts(
    AttemptId int IDENTITY(1,1) NOT NULL,
    StudentId int NOT NULL,
    ExamId int NOT NULL,
    ClassId int NOT NULL,
    AttemptNo smallint NOT NULL,
    StartedAt datetime2(0) NOT NULL,
    DeadlineAt datetime2(0) NOT NULL,
    Status varchar(12) NOT NULL DEFAULT 'InProgress',
    SubmittedAt datetime2(0) NULL,
    EarnedPoints decimal(9,2) NULL,
    CONSTRAINT PK_ExamAttempts PRIMARY KEY(AttemptId),
    CONSTRAINT UQ_ExamAttempts_Number UNIQUE(StudentId,ExamId,ClassId,AttemptNo),
    CONSTRAINT FK_Attempts_Enrollment FOREIGN KEY(StudentId,ClassId) REFERENCES dbo.ClassEnrollments(StudentId,ClassId),
    CONSTRAINT FK_Attempts_Assignment FOREIGN KEY(ExamId,ClassId) REFERENCES dbo.ExamAssignments(ExamId,ClassId),
    CONSTRAINT CK_Attempts_Times CHECK(StartedAt < DeadlineAt AND AttemptNo > 0),
    CONSTRAINT CK_Attempts_Result CHECK((Status='InProgress' AND SubmittedAt IS NULL AND EarnedPoints IS NULL) OR (Status='Submitted' AND SubmittedAt IS NOT NULL AND SubmittedAt >= StartedAt AND EarnedPoints IS NOT NULL AND EarnedPoints >= 0))
);
GO
CREATE TABLE dbo.StudentAnswers(
    AttemptId int NOT NULL,
    QuestionId int NOT NULL,
    SelectedOptionCode char(1) NOT NULL,
    AnsweredAt datetime2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_StudentAnswers PRIMARY KEY(AttemptId,QuestionId),
    CONSTRAINT FK_Answers_Attempt FOREIGN KEY(AttemptId) REFERENCES dbo.ExamAttempts(AttemptId),
    CONSTRAINT FK_Answers_Option FOREIGN KEY(QuestionId,SelectedOptionCode) REFERENCES dbo.AnswerOptions(QuestionId,OptionCode)
);
GO

-- SOURCE 05_Views.sql
CREATE OR ALTER VIEW dbo.vw_StudentExamResults AS
WITH ExamTotals AS (
 SELECT ExamId,CONVERT(decimal(9,2),SUM(Points)) AS MaxPoints
 FROM dbo.ExamQuestions GROUP BY ExamId
)
SELECT a.AttemptId,a.StudentId,CONCAT(u.LastName,N' ',COALESCE(u.MiddleName+N' ',N''),u.FirstName) AS FullName,a.ExamId,e.Title,a.ClassId,c.ClassCode,a.AttemptNo,a.EarnedPoints,t.MaxPoints,CONVERT(decimal(6,2),100.0*a.EarnedPoints/NULLIF(t.MaxPoints,0)) AS ScorePercent,a.SubmittedAt
FROM dbo.ExamAttempts a JOIN dbo.Users u ON u.UserId=a.StudentId JOIN dbo.Exams e ON e.ExamId=a.ExamId JOIN dbo.Classes c ON c.ClassId=a.ClassId JOIN ExamTotals t ON t.ExamId=a.ExamId WHERE a.Status='Submitted';
GO
CREATE OR ALTER VIEW dbo.vw_ExamStatistics AS
SELECT e.ExamId,e.ExamCode,e.Title,e.Status,COALESCE(q.QuestionCount,0) AS QuestionCount,COALESCE(q.TotalPoints,0) AS TotalPoints,COUNT(a.AttemptId) AS AttemptCount,COUNT(a.SubmittedAt) AS SubmittedCount,AVG(CONVERT(decimal(6,2),100.0*a.EarnedPoints/NULLIF(q.TotalPoints,0))) AS AveragePercent
FROM dbo.Exams e LEFT JOIN (SELECT ExamId,COUNT(*) AS QuestionCount,SUM(Points) AS TotalPoints FROM dbo.ExamQuestions GROUP BY ExamId) q ON q.ExamId=e.ExamId LEFT JOIN dbo.ExamAttempts a ON a.ExamId=e.ExamId
GROUP BY e.ExamId,e.ExamCode,e.Title,e.Status,q.QuestionCount,q.TotalPoints;
GO

-- SOURCE 06_Indexes.sql
-- Lượt theo đề và trạng thái, phục vụ Q05/Q06/Q07 và view thống kê.
CREATE INDEX IX_ExamAttempts_Exam_Status ON dbo.ExamAttempts(ExamId,Status) INCLUDE(EarnedPoints,SubmittedAt,StudentId);
-- Tra cứu các đáp án theo câu; PK bắt đầu bằng AttemptId không bao phủ đường truy cập này.
CREATE INDEX IX_StudentAnswers_Question ON dbo.StudentAnswers(QuestionId) INCLUDE(SelectedOptionCode,AttemptId);
GO

-- SOURCE 07_Stored_Procedures.sql
CREATE OR ALTER PROCEDURE dbo.usp_PublishExam @ExamId int
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 BEGIN TRY
  BEGIN TRAN;
  IF NOT EXISTS(SELECT 1 FROM dbo.Exams WITH(UPDLOCK,HOLDLOCK) WHERE ExamId=@ExamId AND Status='Draft') THROW 51101,N'Đề không tồn tại hoặc đã công bố.',1;
  IF (SELECT COUNT(*) FROM dbo.ExamQuestions WHERE ExamId=@ExamId)<5 THROW 51102,N'Đề cần ít nhất 5 câu.',1;
  IF EXISTS(SELECT q.QuestionId FROM dbo.ExamQuestions q LEFT JOIN dbo.AnswerOptions o ON o.QuestionId=q.QuestionId WHERE q.ExamId=@ExamId GROUP BY q.QuestionId HAVING COUNT(o.OptionCode)<>4 OR SUM(CONVERT(int,o.IsCorrect))<>1) THROW 51103,N'Mỗi câu cần 4 lựa chọn và đúng 1 đáp án.',1;
  UPDATE dbo.Exams SET Status='Published' WHERE ExamId=@ExamId;
  COMMIT;
 END TRY
 BEGIN CATCH
  IF @@TRANCOUNT>0 ROLLBACK;
  THROW;
 END CATCH
END;
GO
CREATE OR ALTER PROCEDURE dbo.usp_StartExam @StudentId int,@ExamId int,@ClassId int,@AttemptId int OUTPUT
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON; SET @AttemptId=NULL;
 BEGIN TRY
  BEGIN TRAN;
  DECLARE @resource nvarchar(255)=CONCAT(N'StartExam:',@StudentId,':',@ExamId,':',@ClassId),@lock int;
  EXEC @lock=sys.sp_getapplock @Resource=@resource,@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=10000;
  IF @lock<0 THROW 51110,N'Không lấy được khóa bắt đầu thi.',1;
  DECLARE @now datetime2(0)=SYSUTCDATETIME(),@close datetime2(0),@duration int,@limit int,@n int;
  IF NOT EXISTS(SELECT 1 FROM dbo.Users WITH(UPDLOCK,HOLDLOCK) WHERE UserId=@StudentId AND IsStudent=1 AND IsActive=1) THROW 51111,N'Học viên không hợp lệ.',1;
  IF NOT EXISTS(SELECT 1 FROM dbo.ClassEnrollments ce WITH(UPDLOCK,HOLDLOCK) JOIN dbo.Classes c ON c.ClassId=ce.ClassId WHERE ce.StudentId=@StudentId AND ce.ClassId=@ClassId AND ce.IsActive=1 AND c.IsActive=1) THROW 51112,N'Học viên chưa ghi danh hoạt động.',1;
  SELECT @close=a.ClosesAt,@limit=a.MaxAttempts,@duration=e.DurationMinutes FROM dbo.ExamAssignments a WITH(UPDLOCK,HOLDLOCK) JOIN dbo.Exams e WITH(UPDLOCK,HOLDLOCK) ON e.ExamId=a.ExamId WHERE a.ExamId=@ExamId AND a.ClassId=@ClassId AND a.IsActive=1 AND e.Status='Published' AND @now>=a.OpensAt AND @now<a.ClosesAt;
  IF @limit IS NULL THROW 51113,N'Đề chưa sẵn sàng hoặc ngoài cửa sổ thi.',1;
  SELECT @n=COUNT(*) FROM dbo.ExamAttempts WHERE StudentId=@StudentId AND ExamId=@ExamId AND ClassId=@ClassId;
  IF @n>=@limit THROW 51114,N'Đã đạt giới hạn lượt thi.',1;
  DECLARE @deadline datetime2(0)=DATEADD(minute,@duration,@now);
  IF @close<@deadline SET @deadline=@close;
  INSERT dbo.ExamAttempts(StudentId,ExamId,ClassId,AttemptNo,StartedAt,DeadlineAt) VALUES(@StudentId,@ExamId,@ClassId,@n+1,@now,@deadline);
  SET @AttemptId=CONVERT(int,SCOPE_IDENTITY());
  COMMIT;
 END TRY
 BEGIN CATCH
  IF @@TRANCOUNT>0 ROLLBACK;
  SET @AttemptId=NULL;
  THROW;
 END CATCH
END;
GO
CREATE OR ALTER PROCEDURE dbo.usp_SaveAnswer @AttemptId int,@QuestionId int,@OptionCode char(1)
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 BEGIN TRY
  BEGIN TRAN;
  DECLARE @exam int;
  SELECT @exam=ExamId FROM dbo.ExamAttempts WITH(UPDLOCK,HOLDLOCK) WHERE AttemptId=@AttemptId AND Status='InProgress' AND SYSUTCDATETIME()<DeadlineAt;
  IF @exam IS NULL THROW 51120,N'Lượt thi không còn nhận đáp án.',1;
  IF NOT EXISTS(SELECT 1 FROM dbo.ExamQuestions WHERE ExamId=@exam AND QuestionId=@QuestionId) THROW 51121,N'Câu không thuộc đề.',1;
  IF NOT EXISTS(SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId=@QuestionId AND OptionCode=@OptionCode) THROW 51122,N'Lựa chọn không hợp lệ.',1;
  UPDATE dbo.StudentAnswers SET SelectedOptionCode=@OptionCode,AnsweredAt=SYSUTCDATETIME() WHERE AttemptId=@AttemptId AND QuestionId=@QuestionId;
  IF @@ROWCOUNT=0 INSERT dbo.StudentAnswers(AttemptId,QuestionId,SelectedOptionCode) VALUES(@AttemptId,@QuestionId,@OptionCode);
  COMMIT;
 END TRY
 BEGIN CATCH
  IF @@TRANCOUNT>0 ROLLBACK;
  THROW;
 END CATCH
END;
GO
CREATE OR ALTER PROCEDURE dbo.usp_SubmitExam @AttemptId int,@EarnedPoints decimal(9,2) OUTPUT,@ScorePercent decimal(6,2) OUTPUT
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON; SET @EarnedPoints=NULL; SET @ScorePercent=NULL;
 BEGIN TRY
  BEGIN TRAN;
  DECLARE @exam int,@max decimal(9,2);
  SELECT @exam=ExamId FROM dbo.ExamAttempts WITH(UPDLOCK,HOLDLOCK) WHERE AttemptId=@AttemptId AND Status='InProgress';
  IF @exam IS NULL THROW 51130,N'Lượt thi không tồn tại hoặc đã nộp.',1;
  SELECT @max=SUM(q.Points),@EarnedPoints=SUM(CASE WHEN o.IsCorrect=1 THEN q.Points ELSE 0 END) FROM dbo.ExamQuestions q LEFT JOIN dbo.StudentAnswers a ON a.QuestionId=q.QuestionId AND a.AttemptId=@AttemptId LEFT JOIN dbo.AnswerOptions o ON o.QuestionId=a.QuestionId AND o.OptionCode=a.SelectedOptionCode WHERE q.ExamId=@exam;
  IF @max IS NULL OR @max<=0 THROW 51131,N'Đề không có thang điểm hợp lệ.',1;
  SET @ScorePercent=CONVERT(decimal(6,2),100.0*@EarnedPoints/@max);
  UPDATE dbo.ExamAttempts SET Status='Submitted',SubmittedAt=SYSUTCDATETIME(),EarnedPoints=@EarnedPoints WHERE AttemptId=@AttemptId;
  COMMIT;
 END TRY
 BEGIN CATCH
  IF @@TRANCOUNT>0 ROLLBACK;
  SET @EarnedPoints=NULL; SET @ScorePercent=NULL;
  THROW;
 END CATCH
END;
GO

-- SOURCE 08_Triggers.sql
CREATE OR ALTER TRIGGER dbo.trg_Users_Role ON dbo.Users AFTER UPDATE AS
BEGIN
 SET NOCOUNT ON;
 IF EXISTS(SELECT 1 FROM inserted u WHERE u.IsTeacher=0 AND (EXISTS(SELECT 1 FROM dbo.Classes WHERE TeacherId=u.UserId) OR EXISTS(SELECT 1 FROM dbo.Exams WHERE CreatedBy=u.UserId) OR EXISTS(SELECT 1 FROM dbo.Questions WHERE CreatedBy=u.UserId) OR EXISTS(SELECT 1 FROM dbo.ExamAssignments WHERE AuthorizedBy=u.UserId))) THROW 51201,N'Giáo viên đang có quan hệ nghiệp vụ.',1;
 IF EXISTS(SELECT 1 FROM inserted u JOIN dbo.ClassEnrollments ce ON ce.StudentId=u.UserId WHERE u.IsStudent=0) THROW 51202,N'Học viên đang có ghi danh.',1;
END;
GO
CREATE OR ALTER TRIGGER dbo.trg_Classes_Role ON dbo.Classes AFTER INSERT,UPDATE AS
BEGIN
 SET NOCOUNT ON;
 IF EXISTS(SELECT 1 FROM inserted i JOIN dbo.Users u ON u.UserId=i.TeacherId WHERE u.IsTeacher=0) THROW 51203,N'Người phụ trách phải là giáo viên.',1;
END;
GO
CREATE OR ALTER TRIGGER dbo.trg_Enrollments_Role ON dbo.ClassEnrollments AFTER INSERT,UPDATE AS
BEGIN
 SET NOCOUNT ON;
 IF EXISTS(SELECT 1 FROM inserted i JOIN dbo.Users u ON u.UserId=i.StudentId WHERE u.IsStudent=0) THROW 51204,N'Ghi danh cần vai trò học viên.',1;
END;
GO
CREATE OR ALTER TRIGGER dbo.trg_Assignments_Role ON dbo.ExamAssignments AFTER INSERT,UPDATE AS
BEGIN
 SET NOCOUNT ON;
 IF EXISTS(SELECT 1 FROM inserted i JOIN dbo.Users u ON u.UserId=i.AuthorizedBy WHERE u.IsTeacher=0) THROW 51205,N'Người duyệt phải là giáo viên.',1;
END;
GO
CREATE OR ALTER TRIGGER dbo.trg_Questions_Guard ON dbo.Questions AFTER INSERT,UPDATE,DELETE AS
BEGIN
 SET NOCOUNT ON;
 IF EXISTS(SELECT 1 FROM inserted i JOIN dbo.Users u ON u.UserId=i.CreatedBy WHERE u.IsTeacher=0) THROW 51206,N'Tác giả câu hỏi phải là giáo viên.',1;
 IF EXISTS(SELECT 1 FROM deleted d JOIN dbo.ExamQuestions q ON q.QuestionId=d.QuestionId JOIN dbo.Exams e ON e.ExamId=q.ExamId WHERE e.Status='Published') THROW 51207,N'Không sửa câu thuộc đề công bố.',1;
END;
GO
CREATE OR ALTER TRIGGER dbo.trg_Options_Freeze ON dbo.AnswerOptions AFTER INSERT,UPDATE,DELETE AS
BEGIN
 SET NOCOUNT ON;
 IF EXISTS(SELECT 1 FROM (SELECT QuestionId FROM inserted UNION SELECT QuestionId FROM deleted) i JOIN dbo.ExamQuestions q ON q.QuestionId=i.QuestionId JOIN dbo.Exams e ON e.ExamId=q.ExamId WHERE e.Status='Published') THROW 51208,N'Không sửa lựa chọn thuộc đề công bố.',1;
END;
GO
CREATE OR ALTER TRIGGER dbo.trg_ExamQuestions_Freeze ON dbo.ExamQuestions AFTER INSERT,UPDATE,DELETE AS
BEGIN
 SET NOCOUNT ON;
 IF EXISTS(SELECT 1 FROM (SELECT ExamId FROM inserted UNION SELECT ExamId FROM deleted) i JOIN dbo.Exams e ON e.ExamId=i.ExamId WHERE e.Status='Published') THROW 51209,N'Không sửa cấu trúc đề công bố.',1;
END;
GO
CREATE OR ALTER TRIGGER dbo.trg_Exams_Guard ON dbo.Exams AFTER INSERT,UPDATE,DELETE AS
BEGIN
 SET NOCOUNT ON;
 IF EXISTS(SELECT 1 FROM inserted i JOIN dbo.Users u ON u.UserId=i.CreatedBy WHERE u.IsTeacher=0) THROW 51210,N'Tác giả đề phải là giáo viên.',1;
 IF EXISTS(SELECT 1 FROM deleted WHERE Status='Published') THROW 51211,N'Đề đã công bố bất biến.',1;
 IF EXISTS(SELECT 1 FROM inserted i WHERE i.Status='Published' AND ((SELECT COUNT(*) FROM dbo.ExamQuestions q WHERE q.ExamId=i.ExamId)<5 OR EXISTS(SELECT q.QuestionId FROM dbo.ExamQuestions q LEFT JOIN dbo.AnswerOptions o ON o.QuestionId=q.QuestionId WHERE q.ExamId=i.ExamId GROUP BY q.QuestionId HAVING COUNT(o.OptionCode)<>4 OR SUM(CONVERT(int,o.IsCorrect))<>1))) THROW 51212,N'Đề công bố cần >=5 câu hợp lệ.',1;
END;
GO
CREATE OR ALTER TRIGGER dbo.trg_Attempts_Guard ON dbo.ExamAttempts AFTER INSERT,UPDATE,DELETE AS
BEGIN
 SET NOCOUNT ON;
 IF EXISTS(SELECT 1 FROM deleted WHERE Status='Submitted') THROW 51213,N'Kết quả đã nộp bất biến.',1;
 IF EXISTS(SELECT 1 FROM inserted i JOIN deleted d ON d.AttemptId=i.AttemptId WHERE i.StudentId<>d.StudentId OR i.ExamId<>d.ExamId OR i.ClassId<>d.ClassId OR i.AttemptNo<>d.AttemptNo OR i.StartedAt<>d.StartedAt OR i.DeadlineAt<>d.DeadlineAt) THROW 51214,N'Không đổi định danh hoặc mốc thời gian lượt.',1;
 IF EXISTS(SELECT 1 FROM inserted i LEFT JOIN deleted d ON d.AttemptId=i.AttemptId WHERE d.AttemptId IS NULL AND i.Status<>'InProgress') THROW 51215,N'Lượt mới phải đang làm.',1;
 IF EXISTS(SELECT 1 FROM inserted i LEFT JOIN deleted d ON d.AttemptId=i.AttemptId JOIN dbo.Users u ON u.UserId=i.StudentId JOIN dbo.Classes c ON c.ClassId=i.ClassId JOIN dbo.ClassEnrollments ce ON ce.StudentId=i.StudentId AND ce.ClassId=i.ClassId JOIN dbo.ExamAssignments x ON x.ExamId=i.ExamId AND x.ClassId=i.ClassId JOIN dbo.Exams e ON e.ExamId=i.ExamId WHERE d.AttemptId IS NULL AND (u.IsStudent=0 OR u.IsActive=0 OR c.IsActive=0 OR ce.IsActive=0 OR x.IsActive=0 OR e.Status<>'Published' OR i.StartedAt<x.OpensAt OR i.StartedAt>=x.ClosesAt OR i.DeadlineAt<>CASE WHEN DATEADD(minute,e.DurationMinutes,i.StartedAt)<x.ClosesAt THEN DATEADD(minute,e.DurationMinutes,i.StartedAt) ELSE x.ClosesAt END OR i.AttemptNo>x.MaxAttempts OR (SELECT COUNT(*) FROM dbo.ExamAttempts a WHERE a.StudentId=i.StudentId AND a.ExamId=i.ExamId AND a.ClassId=i.ClassId)>x.MaxAttempts)) THROW 51216,N'Lượt vi phạm ghi danh, giao thi, hạn hoặc số lượt.',1;
 IF EXISTS(SELECT 1 FROM inserted i CROSS APPLY(SELECT SUM(q.Points) AS MaxP,SUM(CASE WHEN o.IsCorrect=1 THEN q.Points ELSE 0 END) AS EarnedP FROM dbo.ExamQuestions q LEFT JOIN dbo.StudentAnswers a ON a.AttemptId=i.AttemptId AND a.QuestionId=q.QuestionId LEFT JOIN dbo.AnswerOptions o ON o.QuestionId=a.QuestionId AND o.OptionCode=a.SelectedOptionCode WHERE q.ExamId=i.ExamId) s WHERE i.Status='Submitted' AND (s.MaxP IS NULL OR i.EarnedPoints<>s.EarnedP OR i.EarnedPoints<0 OR i.EarnedPoints>s.MaxP)) THROW 51217,N'Điểm không khớp dữ liệu chấm.',1;
END;
GO
CREATE OR ALTER TRIGGER dbo.trg_StudentAnswers_Guard ON dbo.StudentAnswers AFTER INSERT,UPDATE,DELETE AS
BEGIN
 SET NOCOUNT ON;
 IF EXISTS(SELECT 1 FROM (SELECT AttemptId FROM inserted UNION SELECT AttemptId FROM deleted) i JOIN dbo.ExamAttempts a WITH(UPDLOCK,HOLDLOCK) ON a.AttemptId=i.AttemptId WHERE a.Status<>'InProgress' OR SYSUTCDATETIME()>=a.DeadlineAt) THROW 51218,N'Lượt đã nộp hoặc hết hạn, không sửa đáp án.',1;
 IF EXISTS(SELECT 1 FROM inserted i JOIN dbo.ExamAttempts a ON a.AttemptId=i.AttemptId WHERE NOT EXISTS(SELECT 1 FROM dbo.ExamQuestions q WHERE q.ExamId=a.ExamId AND q.QuestionId=i.QuestionId) OR i.AnsweredAt<a.StartedAt OR i.AnsweredAt>=a.DeadlineAt) THROW 51219,N'Câu ngoài đề hoặc thời gian đáp án không hợp lệ.',1;
END;
GO
CREATE ROLE ExamOperator;
GRANT EXECUTE ON dbo.usp_StartExam TO ExamOperator;
GRANT EXECUTE ON dbo.usp_SaveAnswer TO ExamOperator;
GRANT EXECUTE ON dbo.usp_SubmitExam TO ExamOperator;
GRANT SELECT ON dbo.vw_StudentExamResults TO ExamOperator;
GRANT SELECT ON dbo.vw_ExamStatistics TO ExamOperator;
DENY INSERT,UPDATE,DELETE ON SCHEMA::dbo TO ExamOperator;
GO

-- ============================================================================
-- Role and Security Configuration: ExamOperator
-- ============================================================================
IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = 'ExamOperator' AND type = 'R')
BEGIN
    CREATE ROLE ExamOperator;
END;
GO
GRANT EXECUTE ON dbo.usp_PublishExam TO ExamOperator;
GRANT EXECUTE ON dbo.usp_StartExam TO ExamOperator;
GRANT EXECUTE ON dbo.usp_SaveAnswer TO ExamOperator;
GRANT EXECUTE ON dbo.usp_SubmitExam TO ExamOperator;
GRANT SELECT ON dbo.vw_StudentExamResults TO ExamOperator;
GRANT SELECT ON dbo.vw_ExamStatistics TO ExamOperator;
DENY INSERT,UPDATE,DELETE ON SCHEMA::dbo TO ExamOperator;
GO
