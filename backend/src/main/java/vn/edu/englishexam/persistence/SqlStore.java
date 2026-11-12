package vn.edu.englishexam.persistence;
import java.sql.*;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import vn.edu.englishexam.api.ApiException;
@Repository
public class SqlStore {
 private final JdbcTemplate jdbc;
 public JdbcTemplate jdbc(){return jdbc;}
 public SqlStore(JdbcTemplate jdbc){this.jdbc=jdbc;}
 public List<Map<String,Object>> list(String sql,Object... args){
  return jdbc.query(sql,(rs,n)->{
   Map<String,Object> row=new LinkedHashMap<>();ResultSetMetaData m=rs.getMetaData();
   for(int i=1;i<=m.getColumnCount();i++){String k=m.getColumnLabel(i);Object v=rs.getObject(i);
    if(v instanceof Timestamp ts)v=ts.toLocalDateTime().toInstant(java.time.ZoneOffset.UTC).toString();
    row.put(Character.toLowerCase(k.charAt(0))+k.substring(1),v);
   }return row;
  },args);
 }
 public Map<String,Object> one(String sql,Object... args){var rows=list(sql,args);if(rows.isEmpty())throw ApiException.missing();return rows.getFirst();}
 public boolean exists(String sql,Object... args){return Boolean.TRUE.equals(jdbc.queryForObject(sql,Boolean.class,args));}
 public int insertId(String sql,Object... args){return jdbc.queryForObject("SET NOCOUNT ON; "+sql,Integer.class,args);}
 public String now(){return (String)one("SELECT SYSUTCDATETIME() AS ServerNow").get("serverNow");}
}
