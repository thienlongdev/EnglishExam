import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';

const origin='https://english-exam-coursework.vercel.app';
const out=path.resolve('../evidence/production');
function sql(query:string){return JSON.parse(execFileSync('powershell.exe',['-NoProfile','-File',path.resolve('../scripts/demo-query.ps1'),'-QueryBase64',Buffer.from(query).toString('base64')],{encoding:'utf8'}).trim());}
test('Public self-registration waits for local owner approval before teacher access',async({page,context})=>{
 const username='qa-register-'+Date.now(),email=username+'@englishexam.invalid',password='Qa!'+crypto.randomBytes(24).toString('base64url');
 fs.writeFileSync(path.resolve('../.local/demo/registration-qa.json'),JSON.stringify({username,email,password},null,2));
 await page.goto('/login');await expect(page.getByText('Đăng ký tài khoản mới',{exact:true})).toBeVisible();
 await page.getByRole('link',{name:'Tiếp tục đăng nhập'}).click();
 await page.getByRole('link',{name:/^(Register|Đăng ký)$/,exact:true}).click();
 await page.locator('#username').fill(username);await page.locator('#email').fill(email);
 await page.locator('#firstName').fill('Registration QA');await page.locator('#lastName').fill('Public');
 await page.locator('#password').fill(password);await page.locator('#password-confirm').fill(password);
 await page.screenshot({path:path.join(out,'registration-01-form.png'),fullPage:true});
 await page.locator('input[type=submit]').click();await page.waitForURL(/\/dashboard$/);
 await expect(page.locator('.notice[role="alert"]')).toContainText('đang chờ quản trị viên');
 const pending=await page.request.get('/api/me');expect(pending.status()).toBe(403);expect((await pending.json()).code).toBe('UNVERIFIED_EMAIL');
 expect(sql(`SELECT COUNT(*) N FROM dbo.Users WHERE Email='${email}'`)[0].N).toBe(0);
 const csrf=await (await page.request.get('/api/auth/csrf')).json();
 const denied=await page.request.post('/api/teacher/exams',{headers:{[csrf.headerName]:csrf.token},data:{examCode:'NO',title:'Forbidden pending account',durationMinutes:20}});expect(denied.status()).toBe(403);
 await page.screenshot({path:path.join(out,'registration-02-awaiting-approval.png'),fullPage:true});
 // Only approve the unique QA identity created immediately above; never enumerate or approve other registrants.
 execFileSync('python',[path.resolve('../scripts/demo-accounts.py'),'approve','--username',username,'--role','teacher','--identity-verified-by-owner'],{encoding:'utf8'});
 await page.getByRole('button',{name:'Đăng xuất phiên hiện tại'}).click();await page.waitForURL(origin+'/');
 await page.goto('/login');await page.getByRole('link',{name:'Tiếp tục đăng nhập'}).click();
 await page.locator('#username').fill(username);await page.locator('#password').fill(password);await page.locator('#kc-login').click();
 await page.waitForURL(/\/(dashboard|teacher)$/);await expect(page.getByRole('heading',{name:/Chào /})).toBeVisible();
 const me=await (await page.request.get('/api/me')).json();expect(me.email).toBe(email);expect(me.isTeacher).toBe(true);expect(me.isStudent).toBe(false);
 const classes=await (await page.request.get('/api/teacher/classes')).json();expect(classes).toHaveLength(1);expect(classes[0].classCode).toBe('DEMO-T-'+me.userId);
 expect((await page.request.post('/api/teacher/exams',{data:{examCode:'NO-CSRF',title:'Missing CSRF',durationMinutes:20}})).status()).toBe(403);
 const cookie=(await context.cookies(origin)).find(c=>c.name==='EXAMSESSION');expect(cookie).toMatchObject({secure:true,httpOnly:true,sameSite:'Lax'});
 await page.goto('/teacher/classes');await expect(page.getByText('Teacher demo class',{exact:true})).toBeVisible();
 await page.screenshot({path:path.join(out,'registration-03-approved-teacher.png'),fullPage:true});
 await page.getByRole('button',{name:'Đăng xuất',exact:true}).click();await page.waitForURL(origin+'/');expect((await page.request.get('/api/me')).status()).toBe(401);
 fs.writeFileSync(path.join(out,'registration.json'),JSON.stringify({username,email,pendingHttpStatus:403,pendingSqlMappings:0,unapprovedTeacherAction:403,localApprovalOfSuiteCreatedIdentity:true,userId:me.userId,isTeacher:me.isTeacher,isStudent:me.isStudent,classId:classes[0].classId,classCode:classes[0].classCode,missingCsrfStatus:403,sessionCookie:{secure:cookie!.secure,httpOnly:cookie!.httpOnly,sameSite:cookie!.sameSite},logoutStatus:401,passed:true},null,2));
});
