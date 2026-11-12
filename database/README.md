# EnglishExam — Academic Database Architecture

This directory contains the authoritative academic database design for the **EnglishExam** coursework and examination platform.

## 1. Academic ERD & Tables (Strict 3NF)

The database consists of **10 relational tables** in strict Third Normal Form (3NF):

| Table Name | Description | Key Constraints |
|---|---|---|
| `Users` | User profiles with identity mapping to external OIDC | `PK_Users`, `UQ_Users_Email`, `CK_Users_Email` |
| `Classes` | Classrooms managed by teachers | `PK_Classes`, `UQ_Classes_Code`, `FK_Classes_Teacher` |
| `Questions` | Question bank with category and difficulty level | `PK_Questions`, `FK_Questions_Author`, `CK_Questions_Difficulty` |
| `AnswerOptions` | 4 options (A, B, C, D) per question, exactly 1 correct | `PK_AnswerOptions`, `FK_AnswerOptions_Question`, `CK_AnswerOptions_Code` |
| `Exams` | Exam headers (Draft or Published status, duration) | `PK_Exams`, `UQ_Exams_Code`, `FK_Exams_Author`, `CK_Exams_Status` |
| `ExamQuestions` | Composition of questions in an exam with point weights | `PK_ExamQuestions`, `UQ_ExamQuestions_Order`, `FK_ExamQuestions_Exam` |
| `ClassEnrollments`| Student enrollment in specific classrooms | `PK_ClassEnrollments`, `FK_Enrollments_Student`, `FK_Enrollments_Class` |
| `ExamAssignments` | Classroom assignments with time windows and attempt limits | `PK_ExamAssignments`, `FK_Assignments_Exam`, `FK_Assignments_Class` |
| `ExamAttempts` | Student exam session tracking, deadlines, and final score | `PK_ExamAttempts`, `UQ_ExamAttempts_Student_Exam_AttemptNo` |
| `StudentAnswers` | Student's chosen answer option per question in an attempt | `PK_StudentAnswers`, `FK_StudentAnswers_Attempt`, `FK_StudentAnswers_Question` |

## 2. Views (2 Views)

1. `dbo.vw_StudentExamResults`:
   - Summarizes completed examinations: student name, exam title, class code, attempt number, earned points, maximum points, percentage score, and submission timestamp.
2. `dbo.vw_ExamStatistics`:
   - Aggregates metrics per exam: question count, total possible points, total attempts, submitted attempts, and average percentage score.

## 3. Indexes (2 Covering Indexes)

1. `IX_ExamAttempts_Exam_Status` on `dbo.ExamAttempts(ExamId, Status) INCLUDE (EarnedPoints, SubmittedAt, StudentId)`:
   - Accelerates reporting views, grade books, and statistics queries.
2. `IX_StudentAnswers_Question` on `dbo.StudentAnswers(QuestionId) INCLUDE (SelectedOptionCode, AttemptId)`:
   - Optimizes question item analysis and reverse lookup of student responses.

## 4. Stored Procedures (4 Stored Procedures)

1. `dbo.usp_PublishExam @ExamId`:
   - Enforces academic publication rules: requires Draft status, at least 5 questions, and every question must have exactly 4 answer options with exactly 1 correct answer.
2. `dbo.usp_StartExam @StudentId, @ExamId, @ClassId, @AttemptId OUTPUT`:
   - Validates student active enrollment, published exam status, open examination time window, and maximum attempt limits using `sp_getapplock` concurrency control.
3. `dbo.usp_SaveAnswer @AttemptId, @QuestionId, @OptionCode`:
   - Idempotently records or updates student answers during an active exam attempt before the deadline.
4. `dbo.usp_SubmitExam @AttemptId, @EarnedPoints OUTPUT, @ScorePercent OUTPUT`:
   - Automatically computes weighted score based on correct answers, calculates percentage, sets status to `Submitted`, and locks the attempt.

## 5. Triggers (10 Business Rule Guards)

- `trg_Users_Role`: Prevents revoking teacher or student roles while active dependencies exist.
- `trg_Classes_Role`: Enforces that classroom supervisors must be registered teachers.
- `trg_Enrollments_Role`: Enforces that enrolled members must have student roles.
- `trg_Assignments_Role`: Enforces that exam authorizations must be granted by teachers.
- `trg_Questions_Guard`: Ensures question authors are teachers and prevents modifying questions that belong to published exams.
- `trg_Options_Freeze`: Freezes answer options for questions belonging to published exams.
- `trg_ExamQuestions_Freeze`: Freezes question composition and point weights for published exams.
- `trg_Exams_Guard`: Enforces immutability of published exams and verifies publication integrity constraints.
- `trg_Attempts_Guard`: Enforces exam session constraints, deadlines, attempt limits, and verifies that submitted scores match database calculation.
- `trg_StudentAnswers_Guard`: Prohibits answering after the deadline or after submission, and checks question ownership.

## 6. Least-Privilege Security Model

The web application connects using the least-privilege login `exam_web`:
- Granted `EXECUTE` on the 4 stored procedures.
- Granted `SELECT` and `VIEW DEFINITION` on the `dbo` schema.
- Granted `INSERT` and `UPDATE` on `Classes`, `Exams`, `Questions`, `ExamAssignments`.
- Granted `INSERT`, `UPDATE`, `DELETE` on `AnswerOptions`, `ExamQuestions`, `ClassEnrollments`.
- **Explicitly `DENIED`** direct `INSERT`, `UPDATE`, or `DELETE` on `ExamAttempts` and `StudentAnswers` to guarantee that all exam starts, answer submissions, and scoring MUST pass through stored procedures and triggers.
- **Explicitly `DENIED`** `ALTER` and DDL modifications on `dbo`.
