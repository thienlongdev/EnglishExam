package vn.edu.englishexam.service;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.englishexam.api.*;
import vn.edu.englishexam.persistence.*;
@Service
public class TeacherService {
 private final SqlStore db;private final ProcedureGateway proc;
 private static Timestamp utc(Instant value){return Timestamp.valueOf(LocalDateTime.ofInstant(value,ZoneOffset.UTC));}
 public TeacherService(SqlStore db,ProcedureGateway proc){this.db=db;this.proc=proc;}
 private Map<String,Object> ownedExam(int user,int id){return db.one("SELECT ExamId,ExamCode,Title,DurationMinutes,Status FROM dbo.Exams WHERE ExamId=? AND CreatedBy=?",id,user);}
 private void ownClass(int user,int id){db.one("SELECT ClassId FROM dbo.Classes WHERE ClassId=? AND TeacherId=?",id,user);}
 public List<Map<String,Object>> classes(int user){return db.list("""
 SELECT c.ClassId,c.ClassCode,c.ClassName,c.IsActive,
 (SELECT COUNT(*) FROM dbo.ClassEnrollments ce WHERE ce.ClassId=c.ClassId AND ce.IsActive=1) StudentCount,
 (SELECT COUNT(*) FROM dbo.ExamAssignments a WHERE a.ClassId=c.ClassId AND a.IsActive=1) ActiveExamCount
 FROM dbo.Classes c WHERE c.TeacherId=? ORDER BY c.ClassCode
 """,user);}
 @Transactional public int createClass(int user,Requests.ClassRecord c){
  return db.insertId("INSERT dbo.Classes(ClassCode,ClassName,TeacherId,IsActive) VALUES(?,?,?,?); SELECT CONVERT(int,SCOPE_IDENTITY());",c.classCode(),c.className(),user,c.isActive());
 }
 @Transactional public void editClass(int user,int id,Requests.ClassRecord c){
  ownClass(user,id);
  db.jdbc().update("UPDATE dbo.Classes SET ClassCode=?,ClassName=?,IsActive=? WHERE ClassId=? AND TeacherId=?",c.classCode(),c.className(),c.isActive(),id,user);
 }
 public Map<String,Object> classDetails(int user,int id){
  ownClass(user,id);
  return db.one("""
  SELECT c.ClassId,c.ClassCode,c.ClassName,c.IsActive,
  (SELECT COUNT(*) FROM dbo.ClassEnrollments ce WHERE ce.ClassId=c.ClassId AND ce.IsActive=1) StudentCount,
  (SELECT COUNT(*) FROM dbo.ExamAssignments a WHERE a.ClassId=c.ClassId AND a.IsActive=1) ActiveExamCount
  FROM dbo.Classes c WHERE c.ClassId=? AND c.TeacherId=?
  """,id,user);
 }
 public List<Map<String,Object>> classExams(int user,int id){
  ownClass(user,id);
  return db.list("""
  SELECT e.ExamId,e.ExamCode,e.Title,e.DurationMinutes,e.Status,
         a.OpensAt,a.ClosesAt,a.MaxAttempts,a.IsActive,a.AuthorizedBy,
         CONCAT(u.LastName,N' ',COALESCE(u.MiddleName+N' ',N''),u.FirstName) AuthorizedByName,
         (SELECT COUNT(*) FROM dbo.ExamQuestions eq WHERE eq.ExamId=e.ExamId) QuestionCount,
         (SELECT SUM(Points) FROM dbo.ExamQuestions eq WHERE eq.ExamId=e.ExamId) TotalPoints
  FROM dbo.ExamAssignments a
  JOIN dbo.Exams e ON e.ExamId=a.ExamId
  JOIN dbo.Users u ON u.UserId=a.AuthorizedBy
  WHERE a.ClassId=?
  ORDER BY a.OpensAt DESC
  """,id);
 }
 @Transactional public void assignToClass(int user,int classId,Requests.ClassAssignment a){
  ownClass(user,classId);
  var e=ownedExam(user,a.examId());
  if(!"Published".equals(e.get("status")))throw new ApiException(409,"DRAFT","Hãy công bố đề trước khi giao cho lớp.");
  if(!a.opensAt().isBefore(a.closesAt()))throw new ApiException(400,"WINDOW","Giờ đóng phải sau giờ mở.");
  var existing=db.list("SELECT ExamId FROM dbo.ExamAssignments WITH(UPDLOCK,HOLDLOCK) WHERE ExamId=? AND ClassId=?",a.examId(),classId);
  if(existing.isEmpty())db.jdbc().update("INSERT dbo.ExamAssignments(ExamId,ClassId,OpensAt,ClosesAt,MaxAttempts,AuthorizedBy,IsActive) VALUES(?,?,?,?,?,?,?)",a.examId(),classId,utc(a.opensAt()),utc(a.closesAt()),a.maxAttempts(),user,a.isActive());
  else db.jdbc().update("UPDATE dbo.ExamAssignments SET OpensAt=?,ClosesAt=?,MaxAttempts=?,AuthorizedBy=?,IsActive=? WHERE ExamId=? AND ClassId=?",utc(a.opensAt()),utc(a.closesAt()),a.maxAttempts(),user,a.isActive(),a.examId(),classId);
 }
 public List<Map<String,Object>> exams(int user,int page){return db.list("""
 SELECT s.*,e.DurationMinutes FROM dbo.vw_ExamStatistics s JOIN dbo.Exams e ON e.ExamId=s.ExamId
 WHERE e.CreatedBy=? ORDER BY e.ExamId DESC OFFSET ? ROWS FETCH NEXT 20 ROWS ONLY
 """,user,page*20);}
 public Map<String,Object> exam(int user,int id){
  var e=ownedExam(user,id);
  e.put("questions",db.list("SELECT q.QuestionId,q.QuestionText,q.Category,q.Difficulty,eq.QuestionOrder,eq.Points FROM dbo.ExamQuestions eq JOIN dbo.Questions q ON q.QuestionId=eq.QuestionId WHERE eq.ExamId=? ORDER BY eq.QuestionOrder",id));
  e.put("assignments",db.list("""
  SELECT a.ClassId,c.ClassCode,c.ClassName,a.OpensAt,a.ClosesAt,a.MaxAttempts,a.IsActive,a.AuthorizedBy,
         CONCAT(u.LastName,N' ',COALESCE(u.MiddleName+N' ',N''),u.FirstName) AuthorizedByName
  FROM dbo.ExamAssignments a
  JOIN dbo.Classes c ON c.ClassId=a.ClassId
  JOIN dbo.Users u ON u.UserId=a.AuthorizedBy
  WHERE a.ExamId=? AND c.TeacherId=? ORDER BY c.ClassCode
  """,id,user));
  return e;
 }
 public List<Map<String,Object>> questions(int user,int page,String search){return db.list("""
 SELECT q.QuestionId,q.QuestionText,q.Category,q.Difficulty,
 CONVERT(bit,CASE WHEN EXISTS(SELECT 1 FROM dbo.ExamQuestions x JOIN dbo.Exams e ON e.ExamId=x.ExamId WHERE x.QuestionId=q.QuestionId AND e.Status='Published') THEN 1 ELSE 0 END) Frozen
 FROM dbo.Questions q WHERE q.CreatedBy=? AND q.QuestionText LIKE ? ESCAPE '~'
 ORDER BY q.QuestionId DESC OFFSET ? ROWS FETCH NEXT 20 ROWS ONLY
 """,user,"%"+search.replace("~","~~").replace("%","~%").replace("_","~_").replace("[","~[")+"%",page*20);}
 public Map<String,Object> question(int user,int id){
  var q=db.one("SELECT QuestionId,QuestionText,Category,Difficulty FROM dbo.Questions WHERE QuestionId=? AND CreatedBy=?",id,user);
  q.put("options",db.list("SELECT OptionCode,OptionText,IsCorrect FROM dbo.AnswerOptions WHERE QuestionId=? ORDER BY OptionCode",id));return q;
 }
 private void validateOptions(Requests.Question q){
  if(q.options().stream().map(Requests.Option::optionCode).distinct().count()!=q.options().size())
   throw new ApiException(400,"OPTIONS","Mã lựa chọn không được trùng nhau.");
  if(q.options().stream().filter(Requests.Option::isCorrect).count()>1)
   throw new ApiException(400,"OPTIONS","Mỗi câu chỉ được có tối đa một đáp án đúng.");
 }
 @Transactional public int saveQuestion(int user,Integer id,Requests.Question q){
  validateOptions(q);
  if(id==null){
   id=db.insertId("INSERT dbo.Questions(QuestionText,Category,Difficulty,CreatedBy) VALUES(?,?,?,?); SELECT CONVERT(int,SCOPE_IDENTITY());",q.questionText(),q.category(),q.difficulty(),user);
  }else{
   db.one("SELECT QuestionId FROM dbo.Questions WITH(UPDLOCK,HOLDLOCK) WHERE QuestionId=? AND CreatedBy=?",id,user);
   db.jdbc().update("UPDATE dbo.Questions SET QuestionText=?,Category=?,Difficulty=? WHERE QuestionId=?",q.questionText(),q.category(),q.difficulty(),id);
   db.jdbc().update("DELETE FROM dbo.AnswerOptions WHERE QuestionId=?",id);
  }
  for(var o:q.options())db.jdbc().update("INSERT dbo.AnswerOptions(QuestionId,OptionCode,OptionText,IsCorrect) VALUES(?,?,?,?)",id,o.optionCode(),o.optionText(),o.isCorrect());
  return id;
 }
 @Transactional public int createExam(int user,Requests.Exam e){return db.insertId("INSERT dbo.Exams(ExamCode,Title,DurationMinutes,CreatedBy) VALUES(?,?,?,?); SELECT CONVERT(int,SCOPE_IDENTITY());",e.examCode(),e.title(),e.durationMinutes(),user);}
 @Transactional public void editExam(int user,int id,Requests.Exam e){
  ownedExam(user,id);db.jdbc().update("UPDATE dbo.Exams SET ExamCode=?,Title=?,DurationMinutes=? WHERE ExamId=? AND CreatedBy=?",e.examCode(),e.title(),e.durationMinutes(),id,user);
 }
 @Transactional public void structure(int user,int id,Requests.Structure data){
  var e=db.one("SELECT Status FROM dbo.Exams WITH(UPDLOCK,HOLDLOCK) WHERE ExamId=? AND CreatedBy=?",id,user);
  if(!"Draft".equals(e.get("status")))throw new ApiException(409,"FROZEN","Đề đã công bố không thể thay đổi.");
  for(var q:data.questions())db.one("SELECT QuestionId FROM dbo.Questions WHERE QuestionId=? AND CreatedBy=?",q.questionId(),user);
  db.jdbc().update("DELETE FROM dbo.ExamQuestions WHERE ExamId=?",id);
  for(var q:data.questions())db.jdbc().update("INSERT dbo.ExamQuestions(ExamId,QuestionId,QuestionOrder,Points) VALUES(?,?,?,?)",id,q.questionId(),q.questionOrder(),q.points());
 }
 public void publish(int user,int id){ownedExam(user,id);proc.publish(id);}
 @Transactional public void assign(int user,int id,Requests.Assignment a){
  var e=ownedExam(user,id);ownClass(user,a.classId());
  if(!"Published".equals(e.get("status")))throw new ApiException(409,"DRAFT","Hãy công bố đề trước khi giao cho lớp.");
  if(!a.opensAt().isBefore(a.closesAt()))throw new ApiException(400,"WINDOW","Giờ đóng phải sau giờ mở.");
  var existing=db.list("SELECT ExamId FROM dbo.ExamAssignments WITH(UPDLOCK,HOLDLOCK) WHERE ExamId=? AND ClassId=?",id,a.classId());
  if(existing.isEmpty())db.jdbc().update("INSERT dbo.ExamAssignments(ExamId,ClassId,OpensAt,ClosesAt,MaxAttempts,AuthorizedBy,IsActive) VALUES(?,?,?,?,?,?,?)",id,a.classId(),utc(a.opensAt()),utc(a.closesAt()),a.maxAttempts(),user,a.isActive());
  else db.jdbc().update("UPDATE dbo.ExamAssignments SET OpensAt=?,ClosesAt=?,MaxAttempts=?,AuthorizedBy=?,IsActive=? WHERE ExamId=? AND ClassId=?",utc(a.opensAt()),utc(a.closesAt()),a.maxAttempts(),user,a.isActive(),id,a.classId());
 }
 @Transactional public void enroll(int user,int clazz,Requests.Enrollment e){
  ownClass(user,clazz);
  int student=(int)db.one("SELECT UserId FROM dbo.Users WHERE Email=? AND IsStudent=1 AND IsActive=1",e.email()).get("userId");
  var existing=db.list("SELECT StudentId FROM dbo.ClassEnrollments WITH(UPDLOCK,HOLDLOCK) WHERE StudentId=? AND ClassId=?",student,clazz);
  if(existing.isEmpty())db.jdbc().update("INSERT dbo.ClassEnrollments(StudentId,ClassId,IsActive) VALUES(?,?,?)",student,clazz,e.isActive());
  else db.jdbc().update("UPDATE dbo.ClassEnrollments SET IsActive=? WHERE StudentId=? AND ClassId=?",e.isActive(),student,clazz);
 }
 @Transactional public void removeEnrollment(int user,int clazz,int studentId){
  ownClass(user,clazz);
  int count=db.jdbc().update("DELETE FROM dbo.ClassEnrollments WHERE StudentId=? AND ClassId=?",studentId,clazz);
  if(count==0)throw ApiException.missing();
 }
 public List<Map<String,Object>> results(int user,int page,Integer classId,Integer examId,String status,String search){
  String searchPattern=(search==null||search.isBlank())?null:"%"+search.trim()+"%";
  return db.list("""
  SELECT a.AttemptId, a.AttemptNo, a.StartedAt, a.DeadlineAt, a.Status, a.SubmittedAt,
         a.EarnedPoints,
         (SELECT SUM(eq.Points) FROM dbo.ExamQuestions eq WHERE eq.ExamId = a.ExamId) MaxPoints,
         CASE
           WHEN a.Status = 'Submitted' AND (SELECT SUM(eq.Points) FROM dbo.ExamQuestions eq WHERE eq.ExamId = a.ExamId) > 0
           THEN CONVERT(decimal(6,2), 100.0 * a.EarnedPoints / (SELECT SUM(eq.Points) FROM dbo.ExamQuestions eq WHERE eq.ExamId = a.ExamId))
           ELSE NULL
         END ScorePercent,
         e.ExamId, e.ExamCode, e.Title,
         c.ClassId, c.ClassCode, c.ClassName,
         u.UserId StudentId, u.Email,
         CONCAT(u.LastName,N' ',COALESCE(u.MiddleName+N' ',N''),u.FirstName) FullName
  FROM dbo.ExamAttempts a
  JOIN dbo.Exams e ON e.ExamId = a.ExamId
  JOIN dbo.Classes c ON c.ClassId = a.ClassId
  JOIN dbo.Users u ON u.UserId = a.StudentId
  WHERE c.TeacherId = ?
    AND (? IS NULL OR a.ClassId = ?)
    AND (? IS NULL OR a.ExamId = ?)
    AND (? IS NULL OR a.Status = ?)
    AND (? IS NULL OR u.Email LIKE ? OR u.FirstName LIKE ? OR u.LastName LIKE ?)
  ORDER BY CASE WHEN a.Status='InProgress' THEN 0 ELSE 1 END,
           COALESCE(a.SubmittedAt, a.StartedAt) DESC,
           a.AttemptId DESC
  OFFSET ? ROWS FETCH NEXT 20 ROWS ONLY
  """,user,classId,classId,examId,examId,status,status,searchPattern,searchPattern,searchPattern,searchPattern,page*20);
 }
 public List<Map<String,Object>> participants(int user,int clazz){
  ownClass(user,clazz);return db.list("""
  SELECT u.UserId,CONCAT(u.LastName,N' ',COALESCE(u.MiddleName+N' ',N''),u.FirstName) FullName,u.Email,ce.IsActive
  FROM dbo.ClassEnrollments ce JOIN dbo.Users u ON u.UserId=ce.StudentId WHERE ce.ClassId=? ORDER BY u.UserId
  """,clazz);
 }
}
