package vn.edu.englishexam.persistence;
import java.util.*;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
@Component
public class SchemaGuard implements ApplicationRunner {
 private final SqlStore db;
 public SchemaGuard(SqlStore db){this.db=db;}
 public void run(ApplicationArguments args){
  var database=db.jdbc().queryForObject("SELECT DB_NAME()",String.class);
  if("EnglishExamDB".equalsIgnoreCase(database))throw new IllegalStateException("The coursework database is protected. Configure an isolated application database.");
  var expected=Set.of("Users","Classes","Exams","Questions","AnswerOptions","ClassEnrollments","ExamQuestions","ExamAssignments","ExamAttempts","StudentAnswers");
  if(!new HashSet<>(db.jdbc().queryForList("SELECT name FROM sys.tables WHERE is_ms_shipped=0",String.class)).equals(expected))throw new IllegalStateException("Frozen database table contract does not match.");
  if(db.jdbc().queryForObject("SELECT COUNT(*) FROM sys.columns WHERE object_id=OBJECT_ID('dbo.ExamAttempts') AND name='MaxPoints'",Integer.class)!=0)throw new IllegalStateException("Unsupported stale coursework schema with stored MaxPoints.");
 }
}
