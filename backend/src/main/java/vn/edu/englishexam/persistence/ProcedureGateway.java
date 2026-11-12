package vn.edu.englishexam.persistence;
import java.sql.*;
import java.math.BigDecimal;
import org.springframework.jdbc.core.ConnectionCallback;
import org.springframework.stereotype.Repository;
@Repository
public class ProcedureGateway {
 private final SqlStore db;
 public ProcedureGateway(SqlStore db){this.db=db;}
 public void publish(int exam){db.jdbc().execute((ConnectionCallback<Void>)c->{try(var s=c.prepareCall("{call dbo.usp_PublishExam(?)}")){s.setInt(1,exam);s.execute();return null;}});}
 public int start(int student,int exam,int clazz){
  return db.jdbc().execute((ConnectionCallback<Integer>)c->{try(var s=c.prepareCall("{call dbo.usp_StartExam(?,?,?,?)}")){
   s.setInt(1,student);s.setInt(2,exam);s.setInt(3,clazz);s.registerOutParameter(4,Types.INTEGER);s.execute();return s.getInt(4);
  }});
 }
 public void save(int attempt,int question,String option){
  db.jdbc().execute((ConnectionCallback<Void>)c->{try(var s=c.prepareCall("{call dbo.usp_SaveAnswer(?,?,?)}")){s.setInt(1,attempt);s.setInt(2,question);s.setString(3,option);s.execute();return null;}});
 }
 public record Score(BigDecimal earnedPoints,BigDecimal scorePercent){}
 public Score submit(int attempt){
  return db.jdbc().execute((ConnectionCallback<Score>)c->{try(var s=c.prepareCall("{call dbo.usp_SubmitExam(?,?,?)}")){
   s.setInt(1,attempt);s.registerOutParameter(2,Types.DECIMAL,2);s.registerOutParameter(3,Types.DECIMAL,2);s.execute();return new Score(s.getBigDecimal(2),s.getBigDecimal(3));
  }});
 }
}
