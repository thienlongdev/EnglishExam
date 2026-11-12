package vn.edu.englishexam.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.englishexam.api.ApiException;
import vn.edu.englishexam.api.AdminResponses.*;
import vn.edu.englishexam.persistence.SqlStore;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class KeycloakAdminService {
 private static final Logger audit = LoggerFactory.getLogger("ADMIN_AUDIT");
 private static final Logger log = LoggerFactory.getLogger(KeycloakAdminService.class);

 private final String adminUrl;
 private final String realm;
 private final String adminUsername;
 private final String adminPassword;
 private final SqlStore db;
 private final ObjectMapper mapper;
 private final HttpClient client;

 private String cachedToken;
 private Instant tokenExpiresAt = Instant.MIN;

 public KeycloakAdminService(
  @Value("${keycloak.admin.url:http://127.0.0.1:8280}") String adminUrl,
  @Value("${keycloak.admin.realm:english-exam-demo}") String realm,
  @Value("${keycloak.admin.username:demo-owner}") String adminUsername,
  @Value("${keycloak.admin.password:}") String adminPassword,
  SqlStore db,
  ObjectMapper mapper
 ) {
  this.adminUrl = adminUrl.replaceAll("/+$", "");
  this.realm = realm;
  this.adminUsername = adminUsername;
  this.adminPassword = adminPassword;
  this.db = db;
  this.mapper = mapper;
  this.client = HttpClient.newBuilder()
   .connectTimeout(Duration.ofSeconds(10))
   .build();
 }

 private synchronized String getAdminToken() {
  if (cachedToken != null && Instant.now().isBefore(tokenExpiresAt.minusSeconds(10))) {
   return cachedToken;
  }
  if (adminPassword == null || adminPassword.isBlank()) {
   throw new ApiException(500, "KEYCLOAK_CONFIG_ERROR", "Keycloak admin password is not configured.");
  }
  try {
   String form = "grant_type=password&client_id=admin-cli&username=" +
    URLEncoder.encode(adminUsername, StandardCharsets.UTF_8) +
    "&password=" + URLEncoder.encode(adminPassword, StandardCharsets.UTF_8);

   HttpRequest request = HttpRequest.newBuilder()
    .uri(URI.create(adminUrl + "/realms/master/protocol/openid-connect/token"))
    .timeout(Duration.ofSeconds(15))
    .header("Content-Type", "application/x-www-form-urlencoded")
    .POST(HttpRequest.BodyPublishers.ofString(form))
    .build();

   HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
   if (response.statusCode() != 200) {
    log.error("Failed to obtain Keycloak admin token: HTTP {} {}", response.statusCode(), response.body());
    throw new ApiException(502, "KEYCLOAK_AUTH_FAILED", "Không thể xác thực với Keycloak Admin API.");
   }
   Map<String, Object> data = mapper.readValue(response.body(), new TypeReference<>() {});
   cachedToken = (String) data.get("access_token");
   long expiresIn = ((Number) data.getOrDefault("expires_in", 60)).longValue();
   tokenExpiresAt = Instant.now().plusSeconds(expiresIn);
   return cachedToken;
  } catch (IOException | InterruptedException e) {
   if (e instanceof InterruptedException) Thread.currentThread().interrupt();
   log.error("Network error obtaining Keycloak admin token: {}", e.getMessage());
   throw new ApiException(502, "KEYCLOAK_UNAVAILABLE", "Không thể kết nối đến Keycloak Admin API.");
  }
 }

 private <T> T sendKeycloak(String path, String method, Object body, TypeReference<T> responseType) {
  String token = getAdminToken();
  HttpRequest.Builder builder = HttpRequest.newBuilder()
   .uri(URI.create(adminUrl + "/admin/realms/" + realm + path))
   .timeout(Duration.ofSeconds(15))
   .header("Authorization", "Bearer " + token)
   .header("Accept", "application/json");

  try {
   if ("GET".equalsIgnoreCase(method)) {
    builder.GET();
   } else if ("DELETE".equalsIgnoreCase(method)) {
    builder.DELETE();
   } else {
    String json = body != null ? mapper.writeValueAsString(body) : "";
    builder.header("Content-Type", "application/json");
    if ("POST".equalsIgnoreCase(method)) {
     builder.POST(HttpRequest.BodyPublishers.ofString(json));
    } else if ("PUT".equalsIgnoreCase(method)) {
     builder.PUT(HttpRequest.BodyPublishers.ofString(json));
    }
   }

   HttpResponse<String> response = client.send(builder.build(), HttpResponse.BodyHandlers.ofString());
   if (response.statusCode() == 404) {
    return null;
   }
   if (response.statusCode() >= 400) {
    log.error("Keycloak admin request failed: {} {} -> HTTP {} {}", method, path, response.statusCode(), response.body());
    throw new ApiException(502, "KEYCLOAK_ERROR", "Keycloak API trả về lỗi: " + response.statusCode());
   }
   if (responseType == null || response.body() == null || response.body().isBlank()) {
    return null;
   }
   return mapper.readValue(response.body(), responseType);
  } catch (IOException | InterruptedException e) {
   if (e instanceof InterruptedException) Thread.currentThread().interrupt();
   log.error("Error communicating with Keycloak: {}", e.getMessage());
   throw new ApiException(502, "KEYCLOAK_UNAVAILABLE", "Không thể kết nối tới Keycloak: " + e.getMessage());
  }
 }

 public AccountList listAccounts(String search, String status, String role, int page, int size) {
  String query = "/users?max=1000";
  if (search != null && !search.isBlank()) {
   query += "&search=" + URLEncoder.encode(search.trim(), StandardCharsets.UTF_8);
  }
  List<Map<String, Object>> kcUsers = sendKeycloak(query, "GET", null, new TypeReference<>() {});
  if (kcUsers == null) kcUsers = List.of();

  // Load all SQL users to correlate
  var sqlUsers = db.list("SELECT UserId, Email, FirstName, MiddleName, LastName, IsStudent, IsTeacher, IsActive FROM dbo.Users");
  Map<String, Map<String, Object>> sqlByEmail = new HashMap<>();
  for (var u : sqlUsers) {
   String email = (String) u.get("email");
   if (email != null) sqlByEmail.put(email.toLowerCase(), u);
  }

  List<Account> allAccounts = new ArrayList<>();
  int pendingCount = 0;
  int teacherCount = 0;
  int studentCount = 0;
  int disabledCount = 0;

  for (var ku : kcUsers) {
   String id = (String) ku.get("id");
   String username = (String) ku.get("username");
   String email = (String) ku.get("email");
   String firstName = (String) ku.get("firstName");
   String lastName = (String) ku.get("lastName");
   boolean enabled = Boolean.TRUE.equals(ku.get("enabled"));
   boolean emailVerified = Boolean.TRUE.equals(ku.get("emailVerified"));
   long createdTimestamp = ((Number) ku.getOrDefault("createdTimestamp", 0L)).longValue();

   String fullName = "";
   if (lastName != null && !lastName.isBlank()) fullName += lastName + " ";
   if (firstName != null && !firstName.isBlank()) fullName += firstName;
   fullName = fullName.trim();
   if (fullName.isBlank()) fullName = username != null ? username : (email != null ? email : id);

   // Fetch realm roles for this user
   List<Map<String, Object>> userRoles = sendKeycloak("/users/" + id + "/role-mappings/realm", "GET", null, new TypeReference<>() {});
   Set<String> roleNames = new HashSet<>();
   if (userRoles != null) {
    for (var r : userRoles) {
     roleNames.add((String) r.get("name"));
    }
   }

   Map<String, Object> sqlUser = email != null ? sqlByEmail.get(email.toLowerCase()) : null;
   Integer sqlUserId = sqlUser != null ? (Integer) sqlUser.get("userId") : null;
   boolean isTeacher = (sqlUser != null && Boolean.TRUE.equals(sqlUser.get("isTeacher"))) || roleNames.contains("teacher");
   boolean isStudent = (sqlUser != null && Boolean.TRUE.equals(sqlUser.get("isStudent"))) || roleNames.contains("student");
   Boolean sqlActive = sqlUser != null ? (Boolean) sqlUser.get("isActive") : null;

   String assignedRole = "none";
   if (roleNames.contains("admin")) assignedRole = "admin";
   else if (isTeacher) assignedRole = "teacher";
   else if (isStudent) assignedRole = "student";

   String accountStatus;
   if (!enabled) {
    accountStatus = "disabled";
    disabledCount++;
   } else if (!emailVerified) {
    accountStatus = "pending";
    pendingCount++;
   } else {
    accountStatus = "approved";
   }

   if (assignedRole.equals("teacher")) teacherCount++;
   if (assignedRole.equals("student")) studentCount++;

   Account acc = new Account(
    id, username, email, firstName, lastName, fullName,
    enabled, emailVerified, createdTimestamp, assignedRole, accountStatus,
    sqlUserId, isTeacher, isStudent, sqlActive
   );
   allAccounts.add(acc);
  }

  // Filter accounts
  List<Account> filtered = allAccounts.stream().filter(a -> {
   if (status != null && !status.isBlank() && !"all".equalsIgnoreCase(status)) {
    if (!a.status().equalsIgnoreCase(status)) return false;
   }
   if (role != null && !role.isBlank() && !"all".equalsIgnoreCase(role)) {
    if (!a.assignedRole().equalsIgnoreCase(role)) return false;
   }
   return true;
  }).sorted(Comparator.comparing(Account::createdTimestamp).reversed()).collect(Collectors.toList());

  int total = filtered.size();
  int fromIndex = Math.min(page * size, total);
  int toIndex = Math.min(fromIndex + size, total);
  List<Account> paged = filtered.subList(fromIndex, toIndex);

  return new AccountList(paged, total, page, size, pendingCount, teacherCount, studentCount, disabledCount);
 }

 public Account getAccount(String userId) {
  Map<String, Object> ku = sendKeycloak("/users/" + userId, "GET", null, new TypeReference<>() {});
  if (ku == null) throw new ApiException(404, "USER_NOT_FOUND", "Không tìm thấy tài khoản người dùng.");

  String id = (String) ku.get("id");
  String username = (String) ku.get("username");
  String email = (String) ku.get("email");
  String firstName = (String) ku.get("firstName");
  String lastName = (String) ku.get("lastName");
  boolean enabled = Boolean.TRUE.equals(ku.get("enabled"));
  boolean emailVerified = Boolean.TRUE.equals(ku.get("emailVerified"));
  long createdTimestamp = ((Number) ku.getOrDefault("createdTimestamp", 0L)).longValue();

  String fullName = "";
  if (lastName != null && !lastName.isBlank()) fullName += lastName + " ";
  if (firstName != null && !firstName.isBlank()) fullName += firstName;
  fullName = fullName.trim();
  if (fullName.isBlank()) fullName = username != null ? username : id;

  List<Map<String, Object>> userRoles = sendKeycloak("/users/" + id + "/role-mappings/realm", "GET", null, new TypeReference<>() {});
  Set<String> roleNames = new HashSet<>();
  if (userRoles != null) {
   for (var r : userRoles) roleNames.add((String) r.get("name"));
  }

  var sqlRows = email != null ? db.list("SELECT UserId, Email, FirstName, MiddleName, LastName, IsStudent, IsTeacher, IsActive FROM dbo.Users WHERE Email=?", email) : List.<Map<String, Object>>of();
  Map<String, Object> sqlUser = !sqlRows.isEmpty() ? sqlRows.getFirst() : null;
  Integer sqlUserId = sqlUser != null ? (Integer) sqlUser.get("userId") : null;
  boolean isTeacher = (sqlUser != null && Boolean.TRUE.equals(sqlUser.get("isTeacher"))) || roleNames.contains("teacher");
  boolean isStudent = (sqlUser != null && Boolean.TRUE.equals(sqlUser.get("isStudent"))) || roleNames.contains("student");
  Boolean sqlActive = sqlUser != null ? (Boolean) sqlUser.get("isActive") : null;

  String assignedRole = "none";
  if (roleNames.contains("admin")) assignedRole = "admin";
  else if (isTeacher) assignedRole = "teacher";
  else if (isStudent) assignedRole = "student";

  String accountStatus = !enabled ? "disabled" : (!emailVerified ? "pending" : "approved");

  return new Account(id, username, email, firstName, lastName, fullName, enabled, emailVerified, createdTimestamp, assignedRole, accountStatus, sqlUserId, isTeacher, isStudent, sqlActive);
 }

 @Transactional
 public void approveUser(String userId, String role, String currentAdminEmail) {
  if (!"teacher".equalsIgnoreCase(role) && !"student".equalsIgnoreCase(role)) {
   throw new ApiException(400, "INVALID_ROLE", "Vai trò phê duyệt phải là 'teacher' hoặc 'student'.");
  }
  Map<String, Object> ku = sendKeycloak("/users/" + userId, "GET", null, new TypeReference<>() {});
  if (ku == null) throw new ApiException(404, "USER_NOT_FOUND", "Không tìm thấy tài khoản người dùng.");

  String email = (String) ku.get("email");
  String username = (String) ku.get("username");
  if (email == null || email.isBlank()) {
   throw new ApiException(400, "MISSING_EMAIL", "Tài khoản không có email, không thể phê duyệt.");
  }
  if (currentAdminEmail != null && email.equalsIgnoreCase(currentAdminEmail)) {
   throw new ApiException(400, "SELF_APPROVAL_FORBIDDEN", "Quản trị viên không thể tự phê duyệt chính mình.");
  }

  String targetRoleName = role.toLowerCase();
  Map<String, Object> roleObj = sendKeycloak("/roles/" + targetRoleName, "GET", null, new TypeReference<>() {});
  if (roleObj == null) {
   sendKeycloak("/roles", "POST", Map.of("name", targetRoleName, "description", "EnglishExam " + targetRoleName + " role"), null);
   roleObj = sendKeycloak("/roles/" + targetRoleName, "GET", null, new TypeReference<>() {});
  }
  if (roleObj != null) {
   sendKeycloak("/users/" + userId + "/role-mappings/realm", "POST", List.of(Map.of("id", roleObj.get("id"), "name", targetRoleName)), null);
  }

  // Synchronize to SQL Server dbo.Users
  String firstName = ku.get("firstName") != null && !((String)ku.get("firstName")).isBlank() ? ((String)ku.get("firstName")).trim() : username;
  String lastName = ku.get("lastName") != null && !((String)ku.get("lastName")).isBlank() ? ((String)ku.get("lastName")).trim() : "User";
  boolean isTeacher = "teacher".equals(targetRoleName);
  boolean isStudent = "student".equals(targetRoleName);

  var existing = db.list("SELECT UserId, IsTeacher, IsStudent FROM dbo.Users WHERE Email = ?", email);
  int sqlId;
  if (existing.isEmpty()) {
   sqlId = db.insertId(
    "INSERT INTO dbo.Users(Email, FirstName, LastName, IsStudent, IsTeacher, IsActive) VALUES(?, ?, ?, ?, ?, 1); SELECT CONVERT(int, SCOPE_IDENTITY());",
    email, firstName, lastName, isStudent, isTeacher
   );
  } else {
   sqlId = ((Number) existing.getFirst().get("userId")).intValue();
   db.jdbc().update(
    "UPDATE dbo.Users SET IsActive = 1, IsTeacher = CASE WHEN ? = 1 THEN 1 ELSE IsTeacher END, IsStudent = CASE WHEN ? = 1 THEN 1 ELSE IsStudent END WHERE UserId = ?",
    isTeacher ? 1 : 0, isStudent ? 1 : 0, sqlId
   );
  }

  if (isTeacher) {
   boolean hasClass = db.exists("SELECT 1 FROM dbo.Classes WHERE TeacherId = ?", sqlId);
   if (!hasClass) {
    db.jdbc().update(
     "INSERT INTO dbo.Classes(ClassCode, ClassName, TeacherId, IsActive) VALUES(?, N'Teacher demo class', ?, 1)",
     "DEMO-T-" + sqlId, sqlId
    );
   }
  }

  // Update Keycloak user to emailVerified=true, enabled=true
  sendKeycloak("/users/" + userId, "PUT", Map.of("emailVerified", true, "enabled", true), null);

  audit.info("AUDIT_ACTION=APPROVE adminEmail={} targetUserId={} targetUsername={} targetEmail={} assignedRole={} timestamp={}",
   currentAdminEmail, userId, username, email, targetRoleName, Instant.now());
 }

 public void rejectUser(String userId, String currentAdminEmail) {
  Map<String, Object> ku = sendKeycloak("/users/" + userId, "GET", null, new TypeReference<>() {});
  if (ku == null) throw new ApiException(404, "USER_NOT_FOUND", "Không tìm thấy tài khoản người dùng.");
  String email = (String) ku.get("email");
  String username = (String) ku.get("username");
  if (currentAdminEmail != null && email != null && email.equalsIgnoreCase(currentAdminEmail)) {
   throw new ApiException(400, "CANNOT_REJECT_SELF", "Quản trị viên không thể từ chối tài khoản của chính mình.");
  }
  // Reject: disable Keycloak login, preserve records
  sendKeycloak("/users/" + userId, "PUT", Map.of("enabled", false), null);

  audit.info("AUDIT_ACTION=REJECT adminEmail={} targetUserId={} targetUsername={} targetEmail={} timestamp={}",
   currentAdminEmail, userId, username, email, Instant.now());
 }

 public void disableUser(String userId, String currentAdminEmail) {
  Map<String, Object> ku = sendKeycloak("/users/" + userId, "GET", null, new TypeReference<>() {});
  if (ku == null) throw new ApiException(404, "USER_NOT_FOUND", "Không tìm thấy tài khoản người dùng.");
  String email = (String) ku.get("email");
  String username = (String) ku.get("username");

  if (currentAdminEmail != null && email != null && email.equalsIgnoreCase(currentAdminEmail)) {
   throw new ApiException(400, "CANNOT_DISABLE_SELF", "Quản trị viên không thể tự vô hiệu hóa tài khoản của chính mình.");
  }
  if ("nhokuto12cdmt@gmail.com".equalsIgnoreCase(email) || "long".equalsIgnoreCase(username)) {
   throw new ApiException(400, "CANNOT_DISABLE_BOOTSTRAP_ADMIN", "Không thể vô hiệu hóa tài khoản quản trị viên gốc của hệ thống.");
  }

  sendKeycloak("/users/" + userId, "PUT", Map.of("enabled", false), null);
  if (email != null && !email.isBlank()) {
   db.jdbc().update("UPDATE dbo.Users SET IsActive = 0 WHERE Email = ?", email);
  }

  audit.info("AUDIT_ACTION=DISABLE adminEmail={} targetUserId={} targetUsername={} targetEmail={} timestamp={}",
   currentAdminEmail, userId, username, email, Instant.now());
 }

 public void enableUser(String userId, String currentAdminEmail) {
  Map<String, Object> ku = sendKeycloak("/users/" + userId, "GET", null, new TypeReference<>() {});
  if (ku == null) throw new ApiException(404, "USER_NOT_FOUND", "Không tìm thấy tài khoản người dùng.");
  String email = (String) ku.get("email");
  String username = (String) ku.get("username");

  sendKeycloak("/users/" + userId, "PUT", Map.of("enabled", true), null);
  if (email != null && !email.isBlank()) {
   db.jdbc().update("UPDATE dbo.Users SET IsActive = 1 WHERE Email = ?", email);
  }

  audit.info("AUDIT_ACTION=ENABLE adminEmail={} targetUserId={} targetUsername={} targetEmail={} timestamp={}",
   currentAdminEmail, userId, username, email, Instant.now());
 }
}
