package vn.edu.englishexam;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import vn.edu.englishexam.api.AdminResponses;
import vn.edu.englishexam.service.KeycloakAdminService;

import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.oidcLogin;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class AdminSecurityTest {

 @Autowired
 private MockMvc mvc;

 @MockBean
 private KeycloakAdminService adminService;

 @Test
 void unauthenticatedAccessRejected() throws Exception {
  mvc.perform(get("/api/admin/accounts"))
   .andExpect(status().isUnauthorized());
 }

 @Test
 void studentCannotAccessAdminApis() throws Exception {
  mvc.perform(get("/api/admin/accounts")
   .with(oidcLogin().idToken(t -> t
    .claim("email", "student.demo@englishexam.invalid")
    .claim("email_verified", true)
    .claim("realm_access", Map.of("roles", List.of("student")))
   )))
   .andExpect(status().isForbidden());
 }

 @Test
 void teacherCannotAccessAdminApis() throws Exception {
  mvc.perform(get("/api/admin/accounts")
   .with(oidcLogin().idToken(t -> t
    .claim("email", "teacher.demo@englishexam.invalid")
    .claim("email_verified", true)
    .claim("realm_access", Map.of("roles", List.of("teacher")))
   )))
   .andExpect(status().isForbidden());
 }

 @Test
 void pendingUserCannotAccessAdminApis() throws Exception {
  mvc.perform(get("/api/admin/accounts")
   .with(oidcLogin().idToken(t -> t
    .claim("email", "pending@englishexam.invalid")
    .claim("email_verified", false)
   )))
   .andExpect(status().isForbidden());
 }

 @Test
 void nonAdminCannotApproveAccounts() throws Exception {
  mvc.perform(post("/api/admin/accounts/some-id/approve")
   .with(csrf())
   .with(oidcLogin().idToken(t -> t
    .claim("email", "teacher.demo@englishexam.invalid")
    .claim("email_verified", true)
    .claim("realm_access", Map.of("roles", List.of("teacher")))
   ))
   .contentType(MediaType.APPLICATION_JSON)
   .content("{\"role\":\"teacher\"}"))
   .andExpect(status().isForbidden());
 }

 @Test
 void adminCanAccessAccountList() throws Exception {
  when(adminService.listAccounts(any(), any(), any(), anyInt(), anyInt()))
   .thenReturn(new AdminResponses.AccountList(List.of(), 0, 0, 20, 0, 0, 0, 0));

  mvc.perform(get("/api/admin/accounts")
   .with(oidcLogin().idToken(t -> t
    .claim("email", "nhokuto12cdmt@gmail.com")
    .claim("email_verified", true)
    .claim("realm_access", Map.of("roles", List.of("admin", "teacher")))
   )))
   .andExpect(status().isOk());
 }

 @Test
 void adminCanApproveAccount() throws Exception {
  doNothing().when(adminService).approveUser(eq("user-123"), eq("teacher"), anyString());

  mvc.perform(post("/api/admin/accounts/user-123/approve")
   .with(csrf())
   .with(oidcLogin().idToken(t -> t
    .claim("email", "nhokuto12cdmt@gmail.com")
    .claim("email_verified", true)
    .claim("realm_access", Map.of("roles", List.of("admin")))
   ))
   .contentType(MediaType.APPLICATION_JSON)
   .content("{\"role\":\"teacher\"}"))
   .andExpect(status().isOk());

  verify(adminService).approveUser(eq("user-123"), eq("teacher"), eq("nhokuto12cdmt@gmail.com"));
 }

 @Test
 void approveWithInvalidRoleIsBadRequest() throws Exception {
  mvc.perform(post("/api/admin/accounts/user-123/approve")
   .with(csrf())
   .with(oidcLogin().idToken(t -> t
    .claim("email", "nhokuto12cdmt@gmail.com")
    .claim("email_verified", true)
    .claim("realm_access", Map.of("roles", List.of("admin")))
   ))
   .contentType(MediaType.APPLICATION_JSON)
   .content("{\"role\":\"superadmin\"}"))
   .andExpect(status().isBadRequest());
 }
}
