package vn.edu.englishexam.api;
import java.util.List;

public class AdminResponses {
 public record Account(
  String id,
  String username,
  String email,
  String firstName,
  String lastName,
  String fullName,
  boolean enabled,
  boolean emailVerified,
  long createdTimestamp,
  String assignedRole,
  String status,
  Integer sqlUserId,
  boolean isTeacher,
  boolean isStudent,
  Boolean sqlActive
 ){}

 public record AccountList(
  List<Account> items,
  int total,
  int page,
  int size,
  int pendingCount,
  int teacherCount,
  int studentCount,
  int disabledCount
 ){}
}
