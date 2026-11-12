package vn.edu.englishexam;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.dao.DataAccessException;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import vn.edu.englishexam.api.*;
import vn.edu.englishexam.persistence.*;
import vn.edu.englishexam.service.*;
@SpringBootTest
@AutoConfigureMockMvc
@EnabledIfEnvironmentVariable(named="EXAM_SQL_TESTS",matches="1")
class SqlWorkflowTest {
 @Autowired SqlStore db;@Autowired TeacherService teacher;@Autowired StudentService student;@Autowired ProcedureGateway proc;@Autowired MockMvc mvc;
 int teacherId,studentId,outsiderId,clazz;
 @BeforeEach void guard(){
  assertEquals("EnglishExamDB_WebTest",db.jdbc().queryForObject("SELECT DB_NAME()",String.class));
  teacherId=id("teacher@exam.local");studentId=id("student@exam.local");outsiderId=id("outsider@exam.local");
  clazz=db.jdbc().queryForObject("SELECT ClassId FROM dbo.Classes WHERE ClassCode='WEB-ENG-01'",Integer.class);
 }
 int id(String email){return db.jdbc().queryForObject("SELECT UserId FROM dbo.Users WHERE Email=?",Integer.class,email);}
 Requests.Question question(String text){return new Requests.Question(text,"Grammar","Easy",List.of(new Requests.Option("A","Correct",true),new Requests.Option("B","Incorrect",false),new Requests.Option("C","Also incorrect",false),new Requests.Option("D","Still incorrect",false)));}
 record Fixture(int exam,List<Integer> questions){}
 Fixture fixture(int limit,Instant open,Instant close){
  var questions=new ArrayList<Integer>();for(int i=0;i<5;i++)questions.add(teacher.saveQuestion(teacherId,null,question("Integration question "+UUID.randomUUID()+" "+i)));
  int exam=teacher.createExam(teacherId,new Requests.Exam("T"+UUID.randomUUID().toString().substring(0,15),"Integration exam",1));
  var weights=new ArrayList<Requests.Weight>();for(int i=0;i<5;i++)weights.add(new Requests.Weight(questions.get(i),i+1,BigDecimal.valueOf(i+1).setScale(2)));
  teacher.structure(teacherId,exam,new Requests.Structure(weights));teacher.publish(teacherId,exam);
  teacher.assign(teacherId,exam,new Requests.Assignment(clazz,open,close,limit,true));return new Fixture(exam,questions);
 }
 Fixture fixture(int limit){return fixture(limit,Instant.now().minusSeconds(60),Instant.now().plusSeconds(3600));}
 @Test void authoritativeScoringReplacementOutputsAndPersistence(){
  var f=fixture(2);int attempt=student.start(studentId,f.exam,clazz);
  var a=student.attempt(studentId,attempt);assertFalse(a.toString().toLowerCase().contains("iscorrect"));
  student.save(studentId,attempt,f.questions.get(0),"A");
  student.save(studentId,attempt,f.questions.get(1),"B");
  student.save(studentId,attempt,f.questions.get(2),"B");student.save(studentId,attempt,f.questions.get(2),"A");
  var output=proc.submit(attempt);assertEquals(new BigDecimal("4.00"),output.earnedPoints());assertEquals(new BigDecimal("26.67"),output.scorePercent());
  var result=student.result(studentId,attempt);assertEquals(output.earnedPoints(),result.get("earnedPoints"));assertEquals(new BigDecimal("15.00"),result.get("maxPoints"));
  assertEquals(result,student.submit(studentId,attempt));assertThrows(DataAccessException.class,()->student.save(studentId,attempt,f.questions.getFirst(),"B"));
 }
 @Test void concurrentStartsRespectLimitAndNumbering()throws Exception{
  var f=fixture(2);try(var pool=Executors.newFixedThreadPool(4)){
   var work=new ArrayList<Callable<Integer>>();for(int i=0;i<4;i++)work.add(()->{try{return student.start(studentId,f.exam,clazz);}catch(DataAccessException e){return -1;}});
   var ids=new ArrayList<Integer>();for(var future:pool.invokeAll(work))ids.add(future.get());
   assertEquals(2,ids.stream().filter(i->i>0).count());assertEquals(List.of((short)1,(short)2),db.jdbc().queryForList("SELECT AttemptNo FROM dbo.ExamAttempts WHERE ExamId=? ORDER BY AttemptNo",Short.class,f.exam));
  }
 }
 @Test void concurrentSubmitReturnsSamePersistedResult()throws Exception{
  var f=fixture(1);int a=student.start(studentId,f.exam,clazz);student.save(studentId,a,f.questions.getFirst(),"A");
  try(var pool=Executors.newFixedThreadPool(2)){var outputs=pool.invokeAll(List.<Callable<Map<String,Object>>>of(()->student.submit(studentId,a),()->student.submit(studentId,a)));assertEquals(outputs.get(0).get(),outputs.get(1).get());}
 }
 @Test void enrollmentScheduleAndInactiveAssignmentAreEnforced(){
  var f=fixture(1);assertThrows(DataAccessException.class,()->student.start(outsiderId,f.exam,clazz));
  teacher.assign(teacherId,f.exam,new Requests.Assignment(clazz,Instant.now().plusSeconds(3600),Instant.now().plusSeconds(7200),1,true));
  assertThrows(DataAccessException.class,()->student.start(studentId,f.exam,clazz));
  teacher.assign(teacherId,f.exam,new Requests.Assignment(clazz,Instant.now().minusSeconds(7200),Instant.now().minusSeconds(3600),1,true));
  assertThrows(DataAccessException.class,()->student.start(studentId,f.exam,clazz));
  teacher.assign(teacherId,f.exam,new Requests.Assignment(clazz,Instant.now().minusSeconds(60),Instant.now().plusSeconds(3600),1,false));
  assertThrows(DataAccessException.class,()->student.start(studentId,f.exam,clazz));
 }
 @Test void expiredAttemptRejectsSaveButCanSubmit()throws Exception{
  var f=fixture(1,Instant.now().minusSeconds(60),Instant.now().plusSeconds(4));int a=student.start(studentId,f.exam,clazz);
  Thread.sleep(4500);assertThrows(DataAccessException.class,()->student.save(studentId,a,f.questions.getFirst(),"A"));assertEquals(new BigDecimal("0.00"),student.submit(studentId,a).get("earnedPoints"));
 }
 @Test void invalidQuestionOptionAndOwnershipAreRejected(){
  var f=fixture(1);int a=student.start(studentId,f.exam,clazz);
  assertThrows(DataAccessException.class,()->student.save(studentId,a,1,"A"));
  assertThrows(DataAccessException.class,()->student.save(studentId,a,f.questions.getFirst(),"Z"));
  assertThrows(ApiException.class,()->student.attempt(outsiderId,a));
  assertThrows(ApiException.class,()->teacher.exam(outsiderId,f.exam));
  assertThrows(ApiException.class,()->teacher.structure(outsiderId,f.exam,new Requests.Structure(List.of())));
 }
 @Test void publishedContentFrozenAndApplicationCannotWriteResultsOrDDL(){
  var f=fixture(1);
  assertThrows(DataAccessException.class,()->teacher.editExam(teacherId,f.exam,new Requests.Exam("FROZEN","Changed",20)));
  assertThrows(DataAccessException.class,()->teacher.saveQuestion(teacherId,f.questions.getFirst(),question("Changed")));
  assertEquals(4,db.jdbc().queryForObject("SELECT COUNT(*) FROM dbo.AnswerOptions WHERE QuestionId=?",Integer.class,f.questions.getFirst()));
  assertEquals(0,db.jdbc().queryForObject("SELECT HAS_PERMS_BY_NAME('dbo','SCHEMA','ALTER')",Integer.class));
  assertEquals(0,db.jdbc().queryForObject("SELECT HAS_PERMS_BY_NAME('dbo.ExamAttempts','OBJECT','UPDATE')",Integer.class));
  assertEquals(0,db.jdbc().queryForObject("SELECT HAS_PERMS_BY_NAME('dbo.StudentAnswers','OBJECT','INSERT')",Integer.class));
 }
 @Test void httpAuthenticationRolesCsrfAndMassAssignment()throws Exception{
  mvc.perform(get("/api/me")).andExpect(status().isUnauthorized());
  mvc.perform(get("/api/teacher/exams").with(oidcLogin().idToken(t->t.claim("email","student@exam.local").claim("email_verified",true)))).andExpect(status().isForbidden());
  mvc.perform(get("/api/me").with(oidcLogin().idToken(t->t.claim("email","student@exam.local").claim("email_verified",false)))).andExpect(status().isForbidden());
  mvc.perform(get("/api/me").with(oidcLogin().idToken(t->t.claim("email","missing@exam.local").claim("email_verified",true)))).andExpect(status().isForbidden());
  mvc.perform(post("/api/student/attempts").with(oidcLogin().idToken(t->t.claim("email","student@exam.local").claim("email_verified",true))).contentType(MediaType.APPLICATION_JSON).content("{\"examId\":1,\"classId\":1}")).andExpect(status().isForbidden());
  mvc.perform(post("/api/student/attempts").with(csrf()).with(oidcLogin().idToken(t->t.claim("email","student@exam.local").claim("email_verified",true))).contentType(MediaType.APPLICATION_JSON).content("{\"examId\":1,\"classId\":1,\"studentId\":1}")).andExpect(status().isBadRequest());
  mvc.perform(get("/api/student/attempts?page=-1").with(oidcLogin().idToken(t->t.claim("email","student@exam.local").claim("email_verified",true)))).andExpect(status().isBadRequest());
 }
 @Test void sqlBusinessErrorsHaveStableSafeMessages()throws Exception{
  var f=fixture(1);
  mvc.perform(post("/api/student/attempts").with(csrf()).with(oidcLogin().idToken(t->t.claim("email","outsider@exam.local").claim("email_verified",true))).contentType(MediaType.APPLICATION_JSON).content("{\"examId\":"+f.exam+",\"classId\":"+clazz+"}"))
   .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("SQL_51112")).andExpect(jsonPath("$.message").value("Bạn chưa có ghi danh đang hoạt động."));
 }
 @Test void publicationNeedsFiveValidQuestionsAndUtcScheduleRoundTrips(){
  int exam=teacher.createExam(teacherId,new Requests.Exam("E"+UUID.randomUUID().toString().substring(0,12),"Empty",1));
  assertThrows(DataAccessException.class,()->teacher.publish(teacherId,exam));
  Instant open=Instant.parse("2026-11-02T05:00:00Z"),close=Instant.parse("2027-11-02T05:00:00Z");
  var f=fixture(1,open,close);
  var a=db.one("SELECT OpensAt,ClosesAt FROM dbo.ExamAssignments WHERE ExamId=? AND ClassId=?",f.exam,clazz);
  assertEquals(open.toString(),a.get("opensAt"));assertEquals(close.toString(),a.get("closesAt"));
 }
 @Test void inactiveAndDuplicateEnrollmentAndForeignClassOwnership(){
  var f=fixture(1);
  teacher.enroll(teacherId,clazz,new Requests.Enrollment("outsider@exam.local",false));
  teacher.enroll(teacherId,clazz,new Requests.Enrollment("outsider@exam.local",false));
  assertEquals(1,db.jdbc().queryForObject("SELECT COUNT(*) FROM dbo.ClassEnrollments WHERE StudentId=? AND ClassId=?",Integer.class,outsiderId,clazz));
  assertThrows(DataAccessException.class,()->student.start(outsiderId,f.exam,clazz));
  assertThrows(ApiException.class,()->teacher.enroll(teacherId,clazz,new Requests.Enrollment("teacher@exam.local",true)));
  int foreign=db.jdbc().queryForObject("SELECT TOP(1) ClassId FROM dbo.Classes WHERE TeacherId<>? ORDER BY ClassId",Integer.class,teacherId);
  assertThrows(ApiException.class,()->teacher.enroll(teacherId,foreign,new Requests.Enrollment("student@exam.local",true)));
 }
 @Test void malformedDraftCannotPublishUntilOneCorrectOptionIsRestored(){
  int exam=teacher.createExam(teacherId,new Requests.Exam("V"+UUID.randomUUID().toString().substring(0,12),"Invalid draft",1));
  var weights=new ArrayList<Requests.Weight>();
  for(int i=0;i<5;i++)weights.add(new Requests.Weight(teacher.saveQuestion(teacherId,null,question("Draft validation "+UUID.randomUUID())),i+1,BigDecimal.ONE));
  teacher.structure(teacherId,exam,new Requests.Structure(weights));
  int q=weights.getFirst().questionId();
  db.jdbc().update("UPDATE dbo.AnswerOptions SET IsCorrect=1 WHERE QuestionId=? AND OptionCode='B'",q);
  assertThrows(DataAccessException.class,()->teacher.publish(teacherId,exam));
  assertEquals("Draft",db.one("SELECT Status FROM dbo.Exams WHERE ExamId=?",exam).get("status"));
  teacher.saveQuestion(teacherId,q,question("Repaired draft "+UUID.randomUUID()));
  teacher.publish(teacherId,exam);
  assertEquals("Published",db.one("SELECT Status FROM dbo.Exams WHERE ExamId=?",exam).get("status"));
 }
 @Test void teacherCanCreateAndManageMultipleClasses(){
  String code1="A1-"+UUID.randomUUID().toString().substring(0,8);
  String code2="A2-"+UUID.randomUUID().toString().substring(0,8);
  String code3="B1-"+UUID.randomUUID().toString().substring(0,8);
  int c1=teacher.createClass(teacherId,new Requests.ClassRecord(code1,"English A1",true));
  int c2=teacher.createClass(teacherId,new Requests.ClassRecord(code2,"English A2",true));
  int c3=teacher.createClass(teacherId,new Requests.ClassRecord(code3,"English B1",true));
  assertEquals(teacherId,db.jdbc().queryForObject("SELECT TeacherId FROM dbo.Classes WHERE ClassId=?",Integer.class,c1));
  assertEquals(teacherId,db.jdbc().queryForObject("SELECT TeacherId FROM dbo.Classes WHERE ClassId=?",Integer.class,c2));
  assertEquals(teacherId,db.jdbc().queryForObject("SELECT TeacherId FROM dbo.Classes WHERE ClassId=?",Integer.class,c3));
  var list=teacher.classes(teacherId);
  assertTrue(list.stream().anyMatch(c->c.get("classCode").equals(code1)));
  assertTrue(list.stream().anyMatch(c->c.get("classCode").equals(code2)));
  assertTrue(list.stream().anyMatch(c->c.get("classCode").equals(code3)));
  teacher.editClass(teacherId,c1,new Requests.ClassRecord(code1,"English A1 Updated",false));
  var details=teacher.classDetails(teacherId,c1);
  assertEquals("English A1 Updated",details.get("className"));
  assertEquals(false,details.get("isActive"));
  assertThrows(ApiException.class,()->teacher.editClass(outsiderId,c1,new Requests.ClassRecord(code1,"Hacked",true)));
 }
 @Test void oneExamCanBeAssignedToMultipleClassesIndependently(){
  var f=fixture(1);
  String codeX="MX-"+UUID.randomUUID().toString().substring(0,8);
  int c2=teacher.createClass(teacherId,new Requests.ClassRecord(codeX,"Second Class",true));
  Instant open=Instant.now().minusSeconds(10),close=Instant.now().plusSeconds(3600);
  teacher.assign(teacherId,f.exam,new Requests.Assignment(c2,open,close,2,true));
  var assignments=db.list("SELECT ClassId,MaxAttempts,AuthorizedBy FROM dbo.ExamAssignments WHERE ExamId=? ORDER BY ClassId",f.exam);
  assertEquals(2,assignments.size());
  assertTrue(assignments.stream().allMatch(a->a.get("authorizedBy").equals(teacherId)));
  var classExams=teacher.classExams(teacherId,c2);
  assertEquals(1,classExams.size());
  assertEquals(f.exam,classExams.getFirst().get("examId"));
 }
 @Test void draftQuestionSupportsIncrementalOptionsUntilPublication(){
  var partialOptions=List.of(new Requests.Option("A","First draft option",true),new Requests.Option("B","Second draft option",false));
  int draftQ=teacher.saveQuestion(teacherId,null,new Requests.Question("Draft question "+UUID.randomUUID(),"Grammar","Easy",partialOptions));
  assertEquals(2,db.jdbc().queryForObject("SELECT COUNT(*) FROM dbo.AnswerOptions WHERE QuestionId=?",Integer.class,draftQ));
  int exam=teacher.createExam(teacherId,new Requests.Exam("DRF-"+UUID.randomUUID().toString().substring(0,10),"Incremental draft exam",30));
  var questions=new ArrayList<Integer>();
  questions.add(draftQ);
  for(int i=0;i<4;i++)questions.add(teacher.saveQuestion(teacherId,null,question("Other Q "+UUID.randomUUID())));
  var weights=new ArrayList<Requests.Weight>();
  for(int i=0;i<5;i++)weights.add(new Requests.Weight(questions.get(i),i+1,BigDecimal.ONE));
  teacher.structure(teacherId,exam,new Requests.Structure(weights));
  assertThrows(DataAccessException.class,()->teacher.publish(teacherId,exam));
  teacher.saveQuestion(teacherId,draftQ,question("Completed question "+UUID.randomUUID()));
  teacher.publish(teacherId,exam);
  assertEquals("Published",db.one("SELECT Status FROM dbo.Exams WHERE ExamId=?",exam).get("status"));
 }
 @Test void teacherResultsDistinguishesInProgressAndSubmittedWithFilters(){
  var f=fixture(1);
  int attempt=student.start(studentId,f.exam,clazz);
  var inProgressList=teacher.results(teacherId,0,clazz,f.exam,"InProgress","");
  assertEquals(1,inProgressList.size());
  assertEquals("InProgress",inProgressList.getFirst().get("status"));
  assertNull(inProgressList.getFirst().get("earnedPoints"));
  student.save(studentId,attempt,f.questions.getFirst(),"A");
  student.submit(studentId,attempt);
  var submittedList=teacher.results(teacherId,0,clazz,f.exam,"Submitted","");
  assertEquals(1,submittedList.size());
  assertEquals("Submitted",submittedList.getFirst().get("status"));
  assertNotNull(submittedList.getFirst().get("earnedPoints"));
  var otherClassList=teacher.results(teacherId,0,999999,f.exam,null,"");
  assertEquals(0,otherClassList.size());
 }
 @Test void safeEnrollmentManagementAndRemoval(){
  String code="ENR-"+UUID.randomUUID().toString().substring(0,8);
  int c=teacher.createClass(teacherId,new Requests.ClassRecord(code,"Enrollment Class",true));
  teacher.enroll(teacherId,c,new Requests.Enrollment("outsider@exam.local",true));
  assertEquals(1,db.jdbc().queryForObject("SELECT COUNT(*) FROM dbo.ClassEnrollments WHERE StudentId=? AND ClassId=?",Integer.class,outsiderId,c));
  teacher.enroll(teacherId,c,new Requests.Enrollment("outsider@exam.local",false));
  assertEquals(false,db.jdbc().queryForObject("SELECT IsActive FROM dbo.ClassEnrollments WHERE StudentId=? AND ClassId=?",Boolean.class,outsiderId,c));
  teacher.removeEnrollment(teacherId,c,outsiderId);
  assertEquals(0,db.jdbc().queryForObject("SELECT COUNT(*) FROM dbo.ClassEnrollments WHERE StudentId=? AND ClassId=?",Integer.class,outsiderId,c));
 }
}
