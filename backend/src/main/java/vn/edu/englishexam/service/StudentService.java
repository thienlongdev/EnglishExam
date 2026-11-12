package vn.edu.englishexam.service;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.dao.DataAccessException;
import vn.edu.englishexam.persistence.*;
import vn.edu.englishexam.api.ApiException;
@Service
public class StudentService {
 private final SqlStore db;private final ProcedureGateway procedures;
 public StudentService(SqlStore db,ProcedureGateway procedures){this.db=db;this.procedures=procedures;}
 public List<Map<String,Object>> classes(int user){return db.list("""
 SELECT c.ClassId,c.ClassCode,c.ClassName,c.IsActive,ce.IsActive EnrollmentActive,
 CONCAT(u.LastName,N' ',COALESCE(u.MiddleName+N' ',N''),u.FirstName) TeacherName,
 (SELECT COUNT(*) FROM dbo.ExamAssignments x JOIN dbo.Exams e ON e.ExamId=x.ExamId WHERE x.ClassId=c.ClassId AND e.Status='Published') ExamCount
 FROM dbo.Classes c JOIN dbo.ClassEnrollments ce ON ce.ClassId=c.ClassId JOIN dbo.Users u ON u.UserId=c.TeacherId
 WHERE ce.StudentId=? ORDER BY c.ClassCode
 """,user);}
 public List<Map<String,Object>> exams(int user){return db.list("""
 SELECT e.ExamId,e.ExamCode,e.Title,e.DurationMinutes,c.ClassId,c.ClassCode,c.ClassName,x.OpensAt,x.ClosesAt,x.MaxAttempts,
 (SELECT COUNT(*) FROM dbo.ExamQuestions q WHERE q.ExamId=e.ExamId) QuestionCount,
 (SELECT SUM(Points) FROM dbo.ExamQuestions q WHERE q.ExamId=e.ExamId) TotalPoints,
 (SELECT COUNT(*) FROM dbo.ExamAttempts a WHERE a.StudentId=ce.StudentId AND a.ExamId=e.ExamId AND a.ClassId=c.ClassId) AttemptsUsed,
 (SELECT TOP(1) a.AttemptId FROM dbo.ExamAttempts a WHERE a.StudentId=ce.StudentId AND a.ExamId=e.ExamId AND a.ClassId=c.ClassId AND a.Status='InProgress' ORDER BY a.AttemptId DESC) ResumeAttemptId,
 CASE WHEN ce.IsActive=0 OR c.IsActive=0 OR x.IsActive=0 THEN 'Inactive'
 WHEN SYSUTCDATETIME()<x.OpensAt THEN 'Upcoming' WHEN SYSUTCDATETIME()>=x.ClosesAt THEN 'Closed' ELSE 'Open' END Availability
 FROM dbo.Exams e JOIN dbo.ExamAssignments x ON x.ExamId=e.ExamId JOIN dbo.Classes c ON c.ClassId=x.ClassId
 JOIN dbo.ClassEnrollments ce ON ce.ClassId=c.ClassId WHERE ce.StudentId=? AND e.Status='Published' ORDER BY x.ClosesAt,e.Title
 """,user);}
 public Map<String,Object> owned(int user,int id){return db.one("""
 SELECT a.AttemptId,a.StudentId,a.ExamId,a.ClassId,a.AttemptNo,a.StartedAt,a.DeadlineAt,a.Status,a.SubmittedAt,a.EarnedPoints,
 e.Title,e.DurationMinutes,c.ClassName,c.ClassCode,
 (SELECT SUM(Points) FROM dbo.ExamQuestions q WHERE q.ExamId=a.ExamId) MaxPoints,
 (SELECT COUNT(*) FROM dbo.ExamQuestions q WHERE q.ExamId=a.ExamId) QuestionCount,
 (SELECT COUNT(*) FROM dbo.StudentAnswers s WHERE s.AttemptId=a.AttemptId) AnsweredCount
 FROM dbo.ExamAttempts a JOIN dbo.Exams e ON e.ExamId=a.ExamId JOIN dbo.Classes c ON c.ClassId=a.ClassId WHERE a.AttemptId=? AND a.StudentId=?
 """,id,user);}
 public Map<String,Object> attempt(int user,int id){
  var a=owned(user,id);a.put("serverNow",db.now());
  var questions=db.list("""
   SELECT q.QuestionId,q.QuestionText,q.Category,q.Difficulty,eq.QuestionOrder,eq.Points,s.SelectedOptionCode
   FROM dbo.ExamQuestions eq JOIN dbo.Questions q ON q.QuestionId=eq.QuestionId
   LEFT JOIN dbo.StudentAnswers s ON s.QuestionId=q.QuestionId AND s.AttemptId=?
   WHERE eq.ExamId=? ORDER BY eq.QuestionOrder
   """,id,a.get("examId"));
  var options=db.list("SELECT o.QuestionId,o.OptionCode,o.OptionText FROM dbo.AnswerOptions o JOIN dbo.ExamQuestions q ON q.QuestionId=o.QuestionId WHERE q.ExamId=? ORDER BY o.OptionCode",a.get("examId"));
  for(var q:questions)q.put("options",options.stream().filter(o->o.get("questionId").equals(q.get("questionId"))).toList());
  a.put("questions",questions);
  if("Submitted".equals(a.get("status")))a.put("result",result(user,id));
  return a;
 }
 public List<Map<String,Object>> history(int user,int page){return db.list("""
 SELECT a.AttemptId,a.ExamId,a.ClassId,e.Title,c.ClassCode,a.AttemptNo,a.Status,a.DeadlineAt,a.StartedAt,
 r.EarnedPoints,r.MaxPoints,r.ScorePercent,r.SubmittedAt FROM dbo.ExamAttempts a
 JOIN dbo.Exams e ON e.ExamId=a.ExamId JOIN dbo.Classes c ON c.ClassId=a.ClassId
 LEFT JOIN dbo.vw_StudentExamResults r ON r.AttemptId=a.AttemptId
 WHERE a.StudentId=? ORDER BY a.AttemptId DESC OFFSET ? ROWS FETCH NEXT 20 ROWS ONLY
 """,user,page*20);}
 public Map<String,Object> result(int user,int id){return db.one("SELECT AttemptId,Title,ClassCode,AttemptNo,EarnedPoints,MaxPoints,ScorePercent,SubmittedAt FROM dbo.vw_StudentExamResults WHERE AttemptId=? AND StudentId=?",id,user);}
 public int start(int user,int exam,int clazz){return procedures.start(user,exam,clazz);}
 public Map<String,Object> save(int user,int attempt,int question,String option){
  owned(user,attempt);procedures.save(attempt,question,option);
  return db.one("SELECT QuestionId,SelectedOptionCode,AnsweredAt FROM dbo.StudentAnswers WHERE AttemptId=? AND QuestionId=?",attempt,question);
 }
 public Map<String,Object> submit(int user,int id){
  var a=owned(user,id);if("Submitted".equals(a.get("status")))return result(user,id);
  try{procedures.submit(id);}catch(DataAccessException e){
   // The SQL procedure deliberately rejects duplicate submission. Only return
   // the persisted result when another request has actually committed it.
   if(!"Submitted".equals(owned(user,id).get("status")))throw e;
  }return result(user,id);
 }
}
