import {test,expect,Page} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
const qa=JSON.parse(fs.readFileSync(path.resolve('../.local/demo/qa-credentials.json'),'utf8'));
const registered=JSON.parse(fs.readFileSync(path.resolve('../.local/demo/registration-qa.json'),'utf8'));
const out=path.resolve('../evidence/production');
const workflow=JSON.parse(fs.readFileSync(path.join(out,'classroom/workflow.json'),'utf8'));
async function login(page:Page,username:string,password:string){await page.goto('/login');await page.getByRole('link',{name:'Tiếp tục đăng nhập'}).click();await page.locator('#username').fill(username);await page.locator('#password').fill(password);await page.locator('#kc-login').click();await page.waitForURL(/\/(dashboard|teacher)$/);await expect(page.getByRole('heading',{name:/Chào /})).toBeVisible();}
async function logout(page:Page){await page.getByRole('button',{name:'Đăng xuất',exact:true}).click();await page.waitForURL('https://english-exam-coursework.vercel.app/');expect((await page.request.get('/api/me')).status()).toBe(401);}
test('Existing SQL result and newly registered identity survive demo service restarts',async({page})=>{
 await login(page,'student',qa.accounts.student.password);await page.goto('/results/'+workflow.attemptId);
 await expect(page.locator('.result-info')).toContainText('8 / 15');await expect(page.locator('.result-score')).toContainText('53,33');
 const result=await (await page.request.get('/api/student/attempts/'+workflow.attemptId+'/result')).json();expect(result.earnedPoints).toBe(8);expect(result.scorePercent).toBe(53.33);
 await page.screenshot({path:path.join(out,'persistence-student-after-restart.png'),fullPage:true});await logout(page);
 await login(page,'teacher',qa.accounts.teacher.password);await page.goto('/teacher/results');await expect(page.getByRole('row').filter({hasText:workflow.title})).toContainText('8/15');await logout(page);
 await login(page,registered.username,registered.password);const me=await (await page.request.get('/api/me')).json();expect(me.email).toBe(registered.email);expect(me.isTeacher).toBe(true);await logout(page);
 fs.writeFileSync(path.join(out,'persistence-after-restart.json'),JSON.stringify({attemptId:workflow.attemptId,examId:workflow.examId,classId:workflow.classId,studentId:workflow.studentId,earnedPoints:result.earnedPoints,scorePercent:result.scorePercent,studentResultVisible:true,teacherResultVisible:true,registeredUsername:registered.username,registeredTeacherId:me.userId,identityPersisted:true,passed:true},null,2));
});
