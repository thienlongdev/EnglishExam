package vn.edu.englishexam.security;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.*;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.web.*;
import org.springframework.security.oauth2.client.oidc.web.logout.OidcClientInitiatedLogoutSuccessHandler;
import org.springframework.security.web.csrf.HttpSessionCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler;
@Configuration
public class SecurityConfig {
 @Bean SecurityFilterChain filter(HttpSecurity http,ClientRegistrationRepository clients,@Value("${app.origin}")String origin)throws Exception{
  var resolver=new DefaultOAuth2AuthorizationRequestResolver(clients,"/oauth2/authorization");
  resolver.setAuthorizationRequestCustomizer(OAuth2AuthorizationRequestCustomizers.withPkce());
  var logout=new OidcClientInitiatedLogoutSuccessHandler(clients);
  logout.setPostLogoutRedirectUri(origin+"/");
  logout.setDefaultTargetUrl(origin+"/");
  http.authorizeHttpRequests(a->a.requestMatchers("/actuator/health","/api/public/status","/api/auth/csrf","/oauth2/**","/login/**","/error").permitAll().anyRequest().authenticated())
   .csrf(c->c.csrfTokenRepository(new HttpSessionCsrfTokenRepository()).csrfTokenRequestHandler(new CsrfTokenRequestAttributeHandler()))
   .oauth2Login(o->o.authorizationEndpoint(e->e.authorizationRequestResolver(resolver)).defaultSuccessUrl(origin+"/dashboard",true).failureUrl(origin+"/login?error=identity"))
   .logout(l->l.logoutUrl("/api/logout").logoutSuccessHandler(logout).deleteCookies("EXAMSESSION"))
   .exceptionHandling(e->e.authenticationEntryPoint((q,s,x)->{s.setStatus(401);s.setContentType("application/json;charset=UTF-8");s.getWriter().write("{\"code\":\"UNAUTHENTICATED\",\"message\":\"Vui lòng đăng nhập.\"}");})
    .accessDeniedHandler((q,s,x)->{s.setStatus(403);s.setContentType("application/json;charset=UTF-8");s.getWriter().write("{\"code\":\"FORBIDDEN\",\"message\":\"Phiên làm việc hoặc quyền truy cập không hợp lệ. Hãy tải lại trang.\"}");}))
   .headers(h->h.frameOptions(f->f.deny()).contentTypeOptions(c->{}));
  return http.build();
 }
}
