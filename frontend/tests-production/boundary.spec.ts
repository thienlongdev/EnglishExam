import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const qa=JSON.parse(fs.readFileSync(path.resolve('../.local/demo/qa-credentials.json'),'utf8'));
const runtime=JSON.parse(fs.readFileSync(path.resolve('../.local/demo/runtime.json'),'utf8'));
const out=path.resolve('../evidence/production');
test('Public HTTPS boundary hides administration and enforces student and CSRF restrictions',async({page,request,context})=>{
 const results:any[]=[];
 for(const route of ['/admin/','/admin/master/console/','/realms/master/.well-known/openid-configuration','/realms/english-exam-demo/account','/actuator/health','/metrics','/health','/.env']){
  const r=await request.get(runtime.tunnelUrl+route);expect(r.status()).toBe(404);results.push({route,status:r.status()});
 }
 const discovery=await (await request.get(runtime.issuer+'/.well-known/openid-configuration')).json();expect(discovery.issuer).toBe(runtime.issuer);
 for(const field of ['authorization_endpoint','token_endpoint','userinfo_endpoint','end_session_endpoint','jwks_uri'])expect(discovery[field]).toMatch(/^https:\/\//);
 const unauth=await request.get('/api/me',{headers:{Origin:'https://untrusted.example'}});expect(unauth.status()).toBe(401);expect(unauth.headers()['access-control-allow-origin']).toBeUndefined();
 await page.goto('/login');await page.getByRole('link',{name:'Tiếp tục đăng nhập'}).click();await page.locator('#username').fill('student');await page.locator('#password').fill(qa.accounts.student.password);await page.locator('#kc-login').click();await page.waitForURL(/\/dashboard$/);
 const me=await (await page.request.get('/api/me')).json();expect(me.isStudent).toBe(true);expect(me.isTeacher).toBe(false);
 const workflow=JSON.parse(fs.readFileSync(path.join(out,'classroom/workflow.json'),'utf8'));
 const token=await (await page.request.get('/api/auth/csrf')).json();
 const assign=await page.request.put('/api/teacher/exams/'+workflow.examId+'/assignments',{headers:{[token.headerName]:token.token},data:{classId:workflow.classId,opensAt:new Date(Date.now()-60000).toISOString(),closesAt:new Date(Date.now()+3600000).toISOString(),isActive:true,maxAttempts:1}});expect(assign.status()).toBe(403);
 const cookie=(await context.cookies()).find(c=>c.name==='EXAMSESSION');expect(cookie).toMatchObject({secure:true,httpOnly:true,sameSite:'Lax'});
 const q="SELECT DB_NAME() DatabaseName,HAS_PERMS_BY_NAME('dbo','SCHEMA','ALTER') CanAlterSchema,HAS_PERMS_BY_NAME('dbo.ExamAttempts','OBJECT','UPDATE') CanUpdateAttempts,HAS_PERMS_BY_NAME('dbo.StudentAnswers','OBJECT','INSERT') CanInsertAnswers,HAS_PERMS_BY_NAME('dbo.usp_SubmitExam','OBJECT','EXECUTE') CanSubmit,HAS_DBACCESS('EnglishExamDB_WebDev') CanAccessWebDev,HAS_DBACCESS('EnglishExamDB_DemoIdentity') CanAccessIdentity";
 const permissions=JSON.parse(execFileSync('powershell.exe',['-NoProfile','-File',path.resolve('../scripts/demo-query.ps1'),'-QueryBase64',Buffer.from(q).toString('base64')],{encoding:'utf8'}).trim())[0];
 expect(permissions).toMatchObject({DatabaseName:'EnglishExamDB_Demo',CanAlterSchema:0,CanUpdateAttempts:0,CanInsertAnswers:0,CanSubmit:1,CanAccessWebDev:0,CanAccessIdentity:0});
 await page.getByRole('button',{name:'Đăng xuất',exact:true}).click();await page.waitForURL('https://english-exam-coursework.vercel.app/');expect((await page.request.get('/api/me')).status()).toBe(401);
 fs.writeFileSync(path.join(out,'public-boundary.json'),JSON.stringify({publicAdminPaths:results,issuer:discovery.issuer,allOidcEndpointsHttps:true,unauthenticatedStatus:401,untrustedCorsAllowed:false,studentAssignStatus:403,studentOnly:true,sessionCookie:{secure:cookie!.secure,httpOnly:cookie!.httpOnly,sameSite:cookie!.sameSite},sqlPermissions:permissions,passed:true},null,2));
});
