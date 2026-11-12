package vn.edu.englishexam.security;
import java.util.*;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.stereotype.Component;
import vn.edu.englishexam.api.ApiException;
import vn.edu.englishexam.persistence.SqlStore;
@Component
public class Identity {
 public record User(int userId,String email,String fullName,boolean isStudent,boolean isTeacher,boolean isAdmin){}
 private final SqlStore db;
 public Identity(SqlStore db){this.db=db;}

 public static boolean hasAdminRole(OidcUser oidc){
  if(oidc==null)return false;
  Map<String,Object> realmAccess=oidc.getClaimAsMap("realm_access");
  if(realmAccess!=null&&realmAccess.get("roles") instanceof Collection<?> roles){
   if(roles.contains("admin"))return true;
  }
  Object rolesObj=oidc.getClaim("roles");
  if(rolesObj instanceof Collection<?> roles&&roles.contains("admin"))return true;
  var auth=SecurityContextHolder.getContext().getAuthentication();
  if(auth!=null&&auth.getAuthorities()!=null){
   for(var a:auth.getAuthorities()){
    String s=a.getAuthority();
    if("ROLE_admin".equalsIgnoreCase(s)||"admin".equalsIgnoreCase(s)||"ROLE_ADMIN".equals(s))return true;
   }
  }
  return false;
 }

 public User current(){
  Authentication a=SecurityContextHolder.getContext().getAuthentication();
  if(a==null||!(a.getPrincipal() instanceof OidcUser oidc))throw new ApiException(401,"UNAUTHENTICATED","Vui lòng đăng nhập.");
  if(!Boolean.TRUE.equals(oidc.getEmailVerified())||oidc.getEmail()==null)throw new ApiException(403,"UNVERIFIED_EMAIL","Tài khoản mới đang chờ quản trị viên xác minh danh tính và cấp quyền. Sau khi được duyệt, hãy đăng xuất và đăng nhập lại.");
  boolean isAdmin=hasAdminRole(oidc);
  var rows=db.list("SELECT UserId,Email,CONCAT(LastName,N' ',COALESCE(MiddleName+N' ',N''),FirstName) FullName,IsStudent,IsTeacher FROM dbo.Users WHERE Email=? AND IsActive=1",oidc.getEmail());
  if(rows.isEmpty()){
   if(isAdmin){
    String name=oidc.getFullName()!=null&&!oidc.getFullName().isBlank()?oidc.getFullName():oidc.getPreferredUsername();
    return new User(0,oidc.getEmail(),name!=null?name:"Admin",false,false,true);
   }
   throw new ApiException(403,"IDENTITY_NOT_MAPPED","Email chưa được cấp quyền trong hệ thống hoặc tài khoản đã ngừng hoạt động. Hãy liên hệ giảng viên.");
  }
  var u=rows.getFirst();return new User((int)u.get("userId"),(String)u.get("email"),(String)u.get("fullName"),(boolean)u.get("isStudent"),(boolean)u.get("isTeacher"),isAdmin);
 }
 public User student(){var u=current();if(!u.isStudent())throw ApiException.forbidden();return u;}
 public User teacher(){var u=current();if(!u.isTeacher())throw ApiException.forbidden();return u;}
 public User admin(){
  Authentication a=SecurityContextHolder.getContext().getAuthentication();
  if(a==null||!(a.getPrincipal() instanceof OidcUser oidc))throw new ApiException(401,"UNAUTHENTICATED","Vui lòng đăng nhập.");
  if(!Boolean.TRUE.equals(oidc.getEmailVerified())||oidc.getEmail()==null)throw new ApiException(403,"UNVERIFIED_EMAIL","Tài khoản mới đang chờ quản trị viên xác minh danh tính.");
  if(!hasAdminRole(oidc))throw ApiException.forbidden();
  return current();
 }
}
