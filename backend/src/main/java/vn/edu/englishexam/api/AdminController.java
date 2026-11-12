package vn.edu.englishexam.api;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.web.bind.annotation.*;
import vn.edu.englishexam.security.Identity;
import vn.edu.englishexam.service.KeycloakAdminService;

import java.util.Map;

@RestController
@RequestMapping("/api/admin")
public class AdminController {
 private final Identity identity;
 private final KeycloakAdminService adminService;

 public AdminController(Identity identity, KeycloakAdminService adminService) {
  this.identity = identity;
  this.adminService = adminService;
 }

 @GetMapping("/accounts")
 public Object list(
  @RequestParam(defaultValue = "0") @Min(0) int page,
  @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size,
  @RequestParam(required = false) String search,
  @RequestParam(required = false) String status,
  @RequestParam(required = false) String role
 ) {
  identity.admin();
  return adminService.listAccounts(search, status, role, page, size);
 }

 @GetMapping("/accounts/{id}")
 public Object get(@PathVariable String id) {
  identity.admin();
  return adminService.getAccount(id);
 }

 @PostMapping("/accounts/{id}/approve")
 public Object approve(@PathVariable String id, @Valid @RequestBody AdminRequests.Approve body) {
  var admin = identity.admin();
  adminService.approveUser(id, body.role(), admin.email());
  return Map.of("success", true, "message", "Đã phê duyệt tài khoản thành công với vai trò: " + body.role());
 }

 @PostMapping("/accounts/{id}/reject")
 public Object reject(@PathVariable String id) {
  var admin = identity.admin();
  adminService.rejectUser(id, admin.email());
  return Map.of("success", true, "message", "Đã từ chối đơn đăng ký.");
 }

 @PostMapping("/accounts/{id}/disable")
 public Object disable(@PathVariable String id) {
  var admin = identity.admin();
  adminService.disableUser(id, admin.email());
  return Map.of("success", true, "message", "Đã vô hiệu hóa tài khoản thành công.");
 }

 @PostMapping("/accounts/{id}/enable")
 public Object enable(@PathVariable String id) {
  var admin = identity.admin();
  adminService.enableUser(id, admin.email());
  return Map.of("success", true, "message", "Đã kích hoạt lại tài khoản thành công.");
 }
}
