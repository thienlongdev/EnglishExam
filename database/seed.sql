-- ============================================================================
-- EnglishExamWeb: Portable Demonstration Seed Data
-- Author: Teacher Minh (teacher@exam.local)
-- Students: An (student@exam.local - Enrolled), Binh (outsider@exam.local - Unenrolled)
-- Classrooms: WEB-ENG-01, WEB-ENG-02
-- Exams: WEB-FOUNDATION (Published & Assigned), DRAFT-ENG-01 (Draft, 5 questions)
-- ============================================================================

SET NOCOUNT ON;
SET XACT_ABORT ON;

IF DB_NAME() NOT IN ('EnglishExamDB_WebDev', 'EnglishExamDB_WebTest', 'EnglishExamDB_Demo')
    THROW 52000, 'Refuse seed outside isolated database.', 1;

BEGIN TRANSACTION;

-- 1. Users
IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE Email = 'teacher@exam.local')
    INSERT dbo.Users(Email, FirstName, LastName, IsTeacher, IsStudent, IsActive)
    VALUES ('teacher@exam.local', N'Minh', N'Nguyễn', 1, 0, 1);

IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE Email = 'student@exam.local')
    INSERT dbo.Users(Email, FirstName, LastName, IsStudent, IsTeacher, IsActive)
    VALUES ('student@exam.local', N'An', N'Trần', 1, 0, 1);

IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE Email = 'outsider@exam.local')
    INSERT dbo.Users(Email, FirstName, LastName, IsStudent, IsTeacher, IsActive)
    VALUES ('outsider@exam.local', N'Bình', N'Lê', 1, 0, 1);

-- Aliases for demo compatibility if needed
IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE Email = 'teacher.demo@englishexam.invalid')
    INSERT dbo.Users(Email, FirstName, LastName, IsTeacher, IsStudent, IsActive)
    VALUES ('teacher.demo@englishexam.invalid', N'Minh', N'Nguyễn', 1, 0, 1);

IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE Email = 'student.demo@englishexam.invalid')
    INSERT dbo.Users(Email, FirstName, LastName, IsStudent, IsTeacher, IsActive)
    VALUES ('student.demo@englishexam.invalid', N'An', N'Trần', 1, 0, 1);

IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE Email = 'outsider.demo@englishexam.invalid')
    INSERT dbo.Users(Email, FirstName, LastName, IsStudent, IsTeacher, IsActive)
    VALUES ('outsider.demo@englishexam.invalid', N'Bình', N'Lê', 1, 0, 1);

DECLARE @teacher int = (SELECT UserId FROM dbo.Users WHERE Email = 'teacher@exam.local');
DECLARE @student int = (SELECT UserId FROM dbo.Users WHERE Email = 'student@exam.local');
DECLARE @outsider int = (SELECT UserId FROM dbo.Users WHERE Email = 'outsider@exam.local');

-- 2. Classes
IF NOT EXISTS (SELECT 1 FROM dbo.Classes WHERE ClassCode = 'WEB-ENG-01')
    INSERT dbo.Classes(ClassCode, ClassName, TeacherId, IsActive)
    VALUES ('WEB-ENG-01', N'Tiếng Anh nền tảng · Lớp 01', @teacher, 1);

IF NOT EXISTS (SELECT 1 FROM dbo.Classes WHERE ClassCode = 'WEB-ENG-02')
    INSERT dbo.Classes(ClassCode, ClassName, TeacherId, IsActive)
    VALUES ('WEB-ENG-02', N'Tiếng Anh giao tiếp · Lớp 02', @teacher, 1);

DECLARE @class1 int = (SELECT ClassId FROM dbo.Classes WHERE ClassCode = 'WEB-ENG-01');
DECLARE @class2 int = (SELECT ClassId FROM dbo.Classes WHERE ClassCode = 'WEB-ENG-02');

-- 3. Class Enrollments
IF NOT EXISTS (SELECT 1 FROM dbo.ClassEnrollments WHERE StudentId = @student AND ClassId = @class1)
    INSERT dbo.ClassEnrollments(StudentId, ClassId, IsActive) VALUES (@student, @class1, 1);

IF NOT EXISTS (SELECT 1 FROM dbo.ClassEnrollments WHERE StudentId = @student AND ClassId = @class2)
    INSERT dbo.ClassEnrollments(StudentId, ClassId, IsActive) VALUES (@student, @class2, 1);

-- 4. Question Bank (30 High Quality Questions)
SET IDENTITY_INSERT dbo.Questions ON;
IF NOT EXISTS (SELECT 1 FROM dbo.Questions WHERE QuestionId = 1)
    INSERT dbo.Questions(QuestionId, QuestionText, Category, Difficulty, CreatedBy) VALUES (1, N'Which word means "a scheduled meeting"?', N'Vocabulary', 'Easy', @teacher);
IF NOT EXISTS (SELECT 1 FROM dbo.Questions WHERE QuestionId = 2)
    INSERT dbo.Questions(QuestionId, QuestionText, Category, Difficulty, CreatedBy) VALUES (2, N'She booked an ___ with her dentist.', N'Vocabulary', 'Medium', @teacher);
IF NOT EXISTS (SELECT 1 FROM dbo.Questions WHERE QuestionId = 3)
    INSERT dbo.Questions(QuestionId, QuestionText, Category, Difficulty, CreatedBy) VALUES (3, N'Which word means "a document confirming payment"?', N'Vocabulary', 'Hard', @teacher);
IF NOT EXISTS (SELECT 1 FROM dbo.Questions WHERE QuestionId = 4)
    INSERT dbo.Questions(QuestionId, QuestionText, Category, Difficulty, CreatedBy) VALUES (4, N'Please keep the ___ as proof of payment.', N'Vocabulary', 'Easy', @teacher);
IF NOT EXISTS (SELECT 1 FROM dbo.Questions WHERE QuestionId = 5)
    INSERT dbo.Questions(QuestionId, QuestionText, Category, Difficulty, CreatedBy) VALUES (5, N'Which word means "money returned to a customer"?', N'Vocabulary', 'Medium', @teacher);
IF NOT EXISTS (SELECT 1 FROM dbo.Questions WHERE QuestionId = 6)
    INSERT dbo.Questions(QuestionId, QuestionText, Category, Difficulty, CreatedBy) VALUES (6, N'The damaged product qualified for a full ___.', N'Vocabulary', 'Hard', @teacher);
IF NOT EXISTS (SELECT 1 FROM dbo.Questions WHERE QuestionId = 7)
    INSERT dbo.Questions(QuestionId, QuestionText, Category, Difficulty, CreatedBy) VALUES (7, N'Which word means "the latest time for completing a task"?', N'Vocabulary', 'Easy', @teacher);
IF NOT EXISTS (SELECT 1 FROM dbo.Questions WHERE QuestionId = 8)
    INSERT dbo.Questions(QuestionId, QuestionText, Category, Difficulty, CreatedBy) VALUES (8, N'The application ___ is Friday at noon.', N'Vocabulary', 'Medium', @teacher);
IF NOT EXISTS (SELECT 1 FROM dbo.Questions WHERE QuestionId = 9)
    INSERT dbo.Questions(QuestionId, QuestionText, Category, Difficulty, CreatedBy) VALUES (9, N'Which word means "travel regularly between home and work"?', N'Vocabulary', 'Hard', @teacher);
IF NOT EXISTS (SELECT 1 FROM dbo.Questions WHERE QuestionId = 10)
    INSERT dbo.Questions(QuestionId, QuestionText, Category, Difficulty, CreatedBy) VALUES (10, N'My daily ___ to the office takes forty minutes.', N'Vocabulary', 'Easy', @teacher);
IF NOT EXISTS (SELECT 1 FROM dbo.Questions WHERE QuestionId = 11)
    INSERT dbo.Questions(QuestionId, QuestionText, Category, Difficulty, CreatedBy) VALUES (11, N'Which word means "bags used when travelling"?', N'Vocabulary', 'Medium', @teacher);
IF NOT EXISTS (SELECT 1 FROM dbo.Questions WHERE QuestionId = 12)
    INSERT dbo.Questions(QuestionId, QuestionText, Category, Difficulty, CreatedBy) VALUES (12, N'Passengers must collect their ___ after landing.', N'Vocabulary', 'Hard', @teacher);
IF NOT EXISTS (SELECT 1 FROM dbo.Questions WHERE QuestionId = 13)
    INSERT dbo.Questions(QuestionId, QuestionText, Category, Difficulty, CreatedBy) VALUES (13, N'Which word means "a detailed travel plan"?', N'Vocabulary', 'Easy', @teacher);
IF NOT EXISTS (SELECT 1 FROM dbo.Questions WHERE QuestionId = 14)
    INSERT dbo.Questions(QuestionId, QuestionText, Category, Difficulty, CreatedBy) VALUES (14, N'Our ___ lists every city we will visit.', N'Vocabulary', 'Medium', @teacher);
IF NOT EXISTS (SELECT 1 FROM dbo.Questions WHERE QuestionId = 15)
    INSERT dbo.Questions(QuestionId, QuestionText, Category, Difficulty, CreatedBy) VALUES (15, N'Which word means "the area beside a railway track where passengers board"?', N'Vocabulary', 'Hard', @teacher);
IF NOT EXISTS (SELECT 1 FROM dbo.Questions WHERE QuestionId = 16)
    INSERT dbo.Questions(QuestionId, QuestionText, Category, Difficulty, CreatedBy) VALUES (16, N'The train leaves from ___ three.', N'Vocabulary', 'Easy', @teacher);
IF NOT EXISTS (SELECT 1 FROM dbo.Questions WHERE QuestionId = 17)
    INSERT dbo.Questions(QuestionId, QuestionText, Category, Difficulty, CreatedBy) VALUES (17, N'Which word means "the act of leaving"?', N'Vocabulary', 'Medium', @teacher);
IF NOT EXISTS (SELECT 1 FROM dbo.Questions WHERE QuestionId = 18)
    INSERT dbo.Questions(QuestionId, QuestionText, Category, Difficulty, CreatedBy) VALUES (18, N'Check the ___ time before going to the airport.', N'Vocabulary', 'Hard', @teacher);
IF NOT EXISTS (SELECT 1 FROM dbo.Questions WHERE QuestionId = 19)
    INSERT dbo.Questions(QuestionId, QuestionText, Category, Difficulty, CreatedBy) VALUES (19, N'Which word means "the place someone is travelling to"?', N'Vocabulary', 'Easy', @teacher);
IF NOT EXISTS (SELECT 1 FROM dbo.Questions WHERE QuestionId = 20)
    INSERT dbo.Questions(QuestionId, QuestionText, Category, Difficulty, CreatedBy) VALUES (20, N'Our final ___ is the city of Hanoi.', N'Vocabulary', 'Medium', @teacher);
IF NOT EXISTS (SELECT 1 FROM dbo.Questions WHERE QuestionId = 21)
    INSERT dbo.Questions(QuestionId, QuestionText, Category, Difficulty, CreatedBy) VALUES (21, N'Which word means "an arrangement to hold a room or seat"?', N'Vocabulary', 'Hard', @teacher);
IF NOT EXISTS (SELECT 1 FROM dbo.Questions WHERE QuestionId = 22)
    INSERT dbo.Questions(QuestionId, QuestionText, Category, Difficulty, CreatedBy) VALUES (22, N'We made a hotel ___ for two nights.', N'Vocabulary', 'Easy', @teacher);
IF NOT EXISTS (SELECT 1 FROM dbo.Questions WHERE QuestionId = 23)
    INSERT dbo.Questions(QuestionId, QuestionText, Category, Difficulty, CreatedBy) VALUES (23, N'Which word means "a position available for someone to fill"?', N'Vocabulary', 'Medium', @teacher);
IF NOT EXISTS (SELECT 1 FROM dbo.Questions WHERE QuestionId = 24)
    INSERT dbo.Questions(QuestionId, QuestionText, Category, Difficulty, CreatedBy) VALUES (24, N'The company has a ___ for an accountant.', N'Vocabulary', 'Hard', @teacher);
IF NOT EXISTS (SELECT 1 FROM dbo.Questions WHERE QuestionId = 25)
    INSERT dbo.Questions(QuestionId, QuestionText, Category, Difficulty, CreatedBy) VALUES (25, N'Which word means "a person you work with"?', N'Vocabulary', 'Easy', @teacher);
IF NOT EXISTS (SELECT 1 FROM dbo.Questions WHERE QuestionId = 26)
    INSERT dbo.Questions(QuestionId, QuestionText, Category, Difficulty, CreatedBy) VALUES (26, N'My ___ and I share the same office.', N'Vocabulary', 'Medium', @teacher);
IF NOT EXISTS (SELECT 1 FROM dbo.Questions WHERE QuestionId = 27)
    INSERT dbo.Questions(QuestionId, QuestionText, Category, Difficulty, CreatedBy) VALUES (27, N'Which word means "a person who oversees other workers"?', N'Vocabulary', 'Hard', @teacher);
IF NOT EXISTS (SELECT 1 FROM dbo.Questions WHERE QuestionId = 28)
    INSERT dbo.Questions(QuestionId, QuestionText, Category, Difficulty, CreatedBy) VALUES (28, N'Ask your ___ to approve the shift change.', N'Vocabulary', 'Easy', @teacher);
IF NOT EXISTS (SELECT 1 FROM dbo.Questions WHERE QuestionId = 29)
    INSERT dbo.Questions(QuestionId, QuestionText, Category, Difficulty, CreatedBy) VALUES (29, N'Which word means "a temporary work placement for gaining experience"?', N'Vocabulary', 'Medium', @teacher);
IF NOT EXISTS (SELECT 1 FROM dbo.Questions WHERE QuestionId = 30)
    INSERT dbo.Questions(QuestionId, QuestionText, Category, Difficulty, CreatedBy) VALUES (30, N'She completed a summer ___ at a law firm.', N'Vocabulary', 'Hard', @teacher);
SET IDENTITY_INSERT dbo.Questions OFF;

-- Answer Options
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 1 AND OptionCode = 'A')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (1, 'A', N'appointment', 1);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 1 AND OptionCode = 'B')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (1, 'B', N'accident', 0);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 1 AND OptionCode = 'C')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (1, 'C', N'argument', 0);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 1 AND OptionCode = 'D')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (1, 'D', N'adventure', 0);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 2 AND OptionCode = 'A')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (2, 'A', N'accident', 0);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 2 AND OptionCode = 'B')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (2, 'B', N'appointment', 1);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 2 AND OptionCode = 'C')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (2, 'C', N'argument', 0);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 2 AND OptionCode = 'D')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (2, 'D', N'adventure', 0);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 3 AND OptionCode = 'A')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (3, 'A', N'recipe', 0);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 3 AND OptionCode = 'B')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (3, 'B', N'request', 0);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 3 AND OptionCode = 'C')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (3, 'C', N'receipt', 1);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 3 AND OptionCode = 'D')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (3, 'D', N'report', 0);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 4 AND OptionCode = 'A')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (4, 'A', N'recipe', 0);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 4 AND OptionCode = 'B')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (4, 'B', N'request', 0);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 4 AND OptionCode = 'C')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (4, 'C', N'report', 0);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 4 AND OptionCode = 'D')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (4, 'D', N'receipt', 1);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 5 AND OptionCode = 'A')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (5, 'A', N'refund', 1);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 5 AND OptionCode = 'B')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (5, 'B', N'salary', 0);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 5 AND OptionCode = 'C')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (5, 'C', N'deposit', 0);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 5 AND OptionCode = 'D')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (5, 'D', N'profit', 0);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 6 AND OptionCode = 'A')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (6, 'A', N'salary', 0);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 6 AND OptionCode = 'B')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (6, 'B', N'refund', 1);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 6 AND OptionCode = 'C')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (6, 'C', N'deposit', 0);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 6 AND OptionCode = 'D')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (6, 'D', N'profit', 0);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 7 AND OptionCode = 'A')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (7, 'A', N'headline', 0);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 7 AND OptionCode = 'B')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (7, 'B', N'outline', 0);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 7 AND OptionCode = 'C')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (7, 'C', N'deadline', 1);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 7 AND OptionCode = 'D')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (7, 'D', N'baseline', 0);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 8 AND OptionCode = 'A')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (8, 'A', N'headline', 0);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 8 AND OptionCode = 'B')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (8, 'B', N'outline', 0);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 8 AND OptionCode = 'C')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (8, 'C', N'baseline', 0);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 8 AND OptionCode = 'D')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (8, 'D', N'deadline', 1);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 9 AND OptionCode = 'A')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (9, 'A', N'commute', 1);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 9 AND OptionCode = 'B')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (9, 'B', N'vacation', 0);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 9 AND OptionCode = 'C')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (9, 'C', N'ceremony', 0);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 9 AND OptionCode = 'D')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (9, 'D', N'interview', 0);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 10 AND OptionCode = 'A')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (10, 'A', N'vacation', 0);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 10 AND OptionCode = 'B')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (10, 'B', N'commute', 1);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 10 AND OptionCode = 'C')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (10, 'C', N'ceremony', 0);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 10 AND OptionCode = 'D')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (10, 'D', N'interview', 0);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 11 AND OptionCode = 'A')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (11, 'A', N'furniture', 0);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 11 AND OptionCode = 'B')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (11, 'B', N'equipment', 0);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 11 AND OptionCode = 'C')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (11, 'C', N'luggage', 1);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 11 AND OptionCode = 'D')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (11, 'D', N'stationery', 0);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 12 AND OptionCode = 'A')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (12, 'A', N'furniture', 0);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 12 AND OptionCode = 'B')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (12, 'B', N'equipment', 0);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 12 AND OptionCode = 'C')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (12, 'C', N'stationery', 0);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 12 AND OptionCode = 'D')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (12, 'D', N'luggage', 1);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 13 AND OptionCode = 'A')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (13, 'A', N'itinerary', 1);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 13 AND OptionCode = 'B')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (13, 'B', N'inventory', 0);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 13 AND OptionCode = 'C')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (13, 'C', N'invoice', 0);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 13 AND OptionCode = 'D')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (13, 'D', N'identity', 0);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 14 AND OptionCode = 'A')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (14, 'A', N'inventory', 0);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 14 AND OptionCode = 'B')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (14, 'B', N'itinerary', 1);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 14 AND OptionCode = 'C')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (14, 'C', N'invoice', 0);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 14 AND OptionCode = 'D')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (14, 'D', N'identity', 0);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 15 AND OptionCode = 'A')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (15, 'A', N'harbour', 0);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 15 AND OptionCode = 'B')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (15, 'B', N'runway', 0);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 15 AND OptionCode = 'C')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (15, 'C', N'platform', 1);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 15 AND OptionCode = 'D')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (15, 'D', N'garage', 0);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 16 AND OptionCode = 'A')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (16, 'A', N'harbour', 0);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 16 AND OptionCode = 'B')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (16, 'B', N'runway', 0);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 16 AND OptionCode = 'C')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (16, 'C', N'garage', 0);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 16 AND OptionCode = 'D')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (16, 'D', N'platform', 1);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 17 AND OptionCode = 'A')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (17, 'A', N'departure', 1);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 17 AND OptionCode = 'B')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (17, 'B', N'arrival', 0);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 17 AND OptionCode = 'C')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (17, 'C', N'reunion', 0);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 17 AND OptionCode = 'D')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (17, 'D', N'delivery', 0);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 18 AND OptionCode = 'A')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (18, 'A', N'arrival', 0);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 18 AND OptionCode = 'B')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (18, 'B', N'departure', 1);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 18 AND OptionCode = 'C')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (18, 'C', N'reunion', 0);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 18 AND OptionCode = 'D')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (18, 'D', N'delivery', 0);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 19 AND OptionCode = 'A')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (19, 'A', N'direction', 0);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 19 AND OptionCode = 'B')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (19, 'B', N'distance', 0);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 19 AND OptionCode = 'C')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (19, 'C', N'destination', 1);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 19 AND OptionCode = 'D')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (19, 'D', N'departure', 0);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 20 AND OptionCode = 'A')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (20, 'A', N'direction', 0);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 20 AND OptionCode = 'B')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (20, 'B', N'distance', 0);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 20 AND OptionCode = 'C')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (20, 'C', N'departure', 0);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 20 AND OptionCode = 'D')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (20, 'D', N'destination', 1);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 21 AND OptionCode = 'A')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (21, 'A', N'reservation', 1);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 21 AND OptionCode = 'B')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (21, 'B', N'recommendation', 0);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 21 AND OptionCode = 'C')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (21, 'C', N'registration', 0);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 21 AND OptionCode = 'D')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (21, 'D', N'reputation', 0);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 22 AND OptionCode = 'A')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (22, 'A', N'recommendation', 0);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 22 AND OptionCode = 'B')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (22, 'B', N'reservation', 1);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 22 AND OptionCode = 'C')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (22, 'C', N'registration', 0);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 22 AND OptionCode = 'D')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (22, 'D', N'reputation', 0);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 23 AND OptionCode = 'A')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (23, 'A', N'vacation', 0);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 23 AND OptionCode = 'B')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (23, 'B', N'volunteer', 0);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 23 AND OptionCode = 'C')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (23, 'C', N'vacancy', 1);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 23 AND OptionCode = 'D')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (23, 'D', N'vehicle', 0);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 24 AND OptionCode = 'A')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (24, 'A', N'vacation', 0);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 24 AND OptionCode = 'B')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (24, 'B', N'volunteer', 0);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 24 AND OptionCode = 'C')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (24, 'C', N'vehicle', 0);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 24 AND OptionCode = 'D')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (24, 'D', N'vacancy', 1);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 25 AND OptionCode = 'A')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (25, 'A', N'colleague', 1);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 25 AND OptionCode = 'B')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (25, 'B', N'customer', 0);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 25 AND OptionCode = 'C')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (25, 'C', N'relative', 0);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 25 AND OptionCode = 'D')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (25, 'D', N'passenger', 0);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 26 AND OptionCode = 'A')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (26, 'A', N'customer', 0);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 26 AND OptionCode = 'B')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (26, 'B', N'colleague', 1);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 26 AND OptionCode = 'C')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (26, 'C', N'relative', 0);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 26 AND OptionCode = 'D')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (26, 'D', N'passenger', 0);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 27 AND OptionCode = 'A')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (27, 'A', N'spectator', 0);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 27 AND OptionCode = 'B')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (27, 'B', N'supplier', 0);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 27 AND OptionCode = 'C')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (27, 'C', N'supervisor', 1);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 27 AND OptionCode = 'D')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (27, 'D', N'subscriber', 0);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 28 AND OptionCode = 'A')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (28, 'A', N'spectator', 0);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 28 AND OptionCode = 'B')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (28, 'B', N'supplier', 0);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 28 AND OptionCode = 'C')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (28, 'C', N'subscriber', 0);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 28 AND OptionCode = 'D')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (28, 'D', N'supervisor', 1);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 29 AND OptionCode = 'A')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (29, 'A', N'internship', 1);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 29 AND OptionCode = 'B')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (29, 'B', N'membership', 0);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 29 AND OptionCode = 'C')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (29, 'C', N'scholarship', 0);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 29 AND OptionCode = 'D')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (29, 'D', N'friendship', 0);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 30 AND OptionCode = 'A')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (30, 'A', N'membership', 0);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 30 AND OptionCode = 'B')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (30, 'B', N'internship', 1);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 30 AND OptionCode = 'C')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (30, 'C', N'scholarship', 0);
IF NOT EXISTS (SELECT 1 FROM dbo.AnswerOptions WHERE QuestionId = 30 AND OptionCode = 'D')
    INSERT dbo.AnswerOptions(QuestionId, OptionCode, OptionText, IsCorrect) VALUES (30, 'D', N'friendship', 0);

-- 5. Published Exam: WEB-FOUNDATION
IF NOT EXISTS (SELECT 1 FROM dbo.Exams WHERE ExamCode = 'WEB-FOUNDATION')
BEGIN
    INSERT dbo.Exams(ExamCode, Title, DurationMinutes, Status, CreatedBy)
    VALUES ('WEB-FOUNDATION', N'English foundations: Everyday language', 20, 'Draft', @teacher);
    DECLARE @pubExam int = SCOPE_IDENTITY();

    -- Attach 10 questions (1.00 pt each)
    INSERT dbo.ExamQuestions(ExamId, QuestionId, QuestionOrder, Points)
    SELECT @pubExam, QuestionId, QuestionId, 1.00
    FROM dbo.Questions
    WHERE QuestionId BETWEEN 1 AND 10;

    -- Publish via stored procedure
    EXEC dbo.usp_PublishExam @pubExam;

    -- Assign to Class 1 (Open for 180 days, 10 attempts allowed)
    INSERT dbo.ExamAssignments(ExamId, ClassId, OpensAt, ClosesAt, MaxAttempts, AuthorizedBy, IsActive)
    VALUES (@pubExam, @class1, DATEADD(day, -1, SYSUTCDATETIME()), DATEADD(day, 180, SYSUTCDATETIME()), 10, @teacher, 1);

    -- Assign to Class 2 (Open for 180 days, 5 attempts allowed)
    INSERT dbo.ExamAssignments(ExamId, ClassId, OpensAt, ClosesAt, MaxAttempts, AuthorizedBy, IsActive)
    VALUES (@pubExam, @class2, DATEADD(day, -1, SYSUTCDATETIME()), DATEADD(day, 180, SYSUTCDATETIME()), 5, @teacher, 1);

    -- 6. Pre-seeded Demonstration Attempt (Score: 8 / 10 = 80%)
    DECLARE @sampleAttempt int;
    EXEC dbo.usp_StartExam @student, @pubExam, @class1, @sampleAttempt OUTPUT;

    -- Save 8 correct answers and 2 incorrect answers
    EXEC dbo.usp_SaveAnswer @sampleAttempt, 1, 'A'; -- Correct (appointment)
    EXEC dbo.usp_SaveAnswer @sampleAttempt, 2, 'B'; -- Correct (appointment)
    EXEC dbo.usp_SaveAnswer @sampleAttempt, 3, 'A'; -- Incorrect
    EXEC dbo.usp_SaveAnswer @sampleAttempt, 4, 'B'; -- Incorrect
    EXEC dbo.usp_SaveAnswer @sampleAttempt, 5, 'A'; -- Correct (refund)
    EXEC dbo.usp_SaveAnswer @sampleAttempt, 6, 'B'; -- Correct (refund)
    EXEC dbo.usp_SaveAnswer @sampleAttempt, 7, 'C'; -- Correct
    EXEC dbo.usp_SaveAnswer @sampleAttempt, 8, 'D'; -- Correct
    EXEC dbo.usp_SaveAnswer @sampleAttempt, 9, 'A'; -- Correct (commute)
    EXEC dbo.usp_SaveAnswer @sampleAttempt, 10, 'B'; -- Correct (commute)

    DECLARE @earnedPoints decimal(9,2), @scorePercent decimal(6,2);
    EXEC dbo.usp_SubmitExam @sampleAttempt, @earnedPoints OUTPUT, @scorePercent OUTPUT;
END;

-- 7. Draft Exam: DRAFT-ENG-01 (Ready for Teacher to demonstrate Publish)
IF NOT EXISTS (SELECT 1 FROM dbo.Exams WHERE ExamCode = 'DRAFT-ENG-01')
BEGIN
    INSERT dbo.Exams(ExamCode, Title, DurationMinutes, Status, CreatedBy)
    VALUES ('DRAFT-ENG-01', N'Intermediate English Grammar Practice', 15, 'Draft', @teacher);
    DECLARE @draftExam int = SCOPE_IDENTITY();

    -- Attach 5 questions (2.00 pts each)
    INSERT dbo.ExamQuestions(ExamId, QuestionId, QuestionOrder, Points)
    SELECT @draftExam, QuestionId, ROW_NUMBER() OVER (ORDER BY QuestionId), 2.00
    FROM dbo.Questions
    WHERE QuestionId BETWEEN 11 AND 15;
END;

COMMIT TRANSACTION;
