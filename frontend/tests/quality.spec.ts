import {test,expect,Page} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs';
import path from 'node:path';
const env=Object.fromEntries(fs.readFileSync(path.resolve('../.env'),'utf8').trim().split(/\r?\n/).map(line=>line.split(/=(.*)/s).slice(0,2)));
const out=path.resolve('../evidence/screenshots');
async function settled(page:Page){await page.evaluate(async()=>{await document.fonts.ready;await Promise.all(document.getAnimations().filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})));});}
async function login(page:Page,user:string){await page.goto('/login');await page.getByRole('link',{name:'Tiếp tục đăng nhập'}).click();await page.locator('#username').fill(user);await page.locator('#password').fill(env.DEMO_PASSWORD);await page.locator('#kc-login').click();await page.waitForURL(/\/(dashboard|teacher)$/);await expect(page.getByRole('heading',{name:/Chào /})).toBeVisible();}
async function inspect(page:Page,label:string){
 await settled(page);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
 const fonts=await page.locator('h1,h2,h3,button,input,select,textarea,nav,a').evaluateAll(nodes=>nodes.filter(n=>n.getClientRects().length&&!(n instanceof HTMLInputElement&&n.type==='hidden')).map(n=>getComputedStyle(n).fontFamily));
 expect(fonts.every(font=>font.includes('Quicksand'))).toBeTruthy();
 await page.screenshot({path:path.join(out,label+'.png'),fullPage:true});
 const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
 fs.writeFileSync(path.resolve('../evidence/axe-'+label+'.json'),JSON.stringify(result.violations,null,2));
 expect(result.violations.filter(v=>v.impact==='critical'||v.impact==='serious')).toEqual([]);
}
test('OIDC login theme, rejected password, app login error and keyboard menu',async({page})=>{
 await page.goto('/login?error=identity');await expect(page.getByRole('alert').filter({hasText:'Chưa thể hoàn tất đăng nhập.'})).toBeVisible();await inspect(page,'login-error');
 await page.getByRole('link',{name:'Tiếp tục đăng nhập'}).click();await expect(page.locator('#username')).toBeVisible();await inspect(page,'oidc-desktop');
 await page.setViewportSize({width:375,height:812});await inspect(page,'oidc-mobile');
 await page.locator('#username').fill('student');await page.locator('#password').fill('incorrect-password-for-qa');await page.locator('#kc-login').click();await expect(page.getByText(/Invalid username or password|Tên đăng nhập hoặc mật khẩu chưa chính xác/)).toBeVisible();await expect(page.locator('#username')).toHaveAttribute('aria-invalid','true');
 await page.locator('#password').fill(env.DEMO_PASSWORD);await page.locator('#kc-login').click();await page.waitForURL('/dashboard');await expect(page.getByRole('heading',{name:/Chào /})).toBeVisible();
 await page.getByRole('button',{name:'Mở menu'}).click();await expect(page.getByRole('dialog',{name:'Điều hướng',exact:true})).toBeVisible();await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:'Mở menu'})).toBeFocused();
 await page.getByRole('button',{name:'Mở menu'}).click();await page.getByRole('link',{name:'Lớp học',exact:true}).click();await expect(page.getByRole('heading',{name:'Lớp học của tôi'})).toBeVisible();await expect(page.getByRole('dialog',{name:'Điều hướng',exact:true})).not.toBeVisible();
 await page.goto('/teacher');await expect(page.getByRole('alert').filter({hasText:'Bạn cần quyền giảng viên'})).toBeVisible();
});
test('Student routes: real data, phone/tablet/desktop and accessible loading/error states',async({page})=>{
 await login(page,'student');
 const history=await (await page.request.get('/api/student/attempts')).json();const result=history.find((x:{status:string})=>x.status==='Submitted');expect(result).toBeTruthy();
 for(const route of ['/dashboard','/classes','/exams','/history','/results/'+result.attemptId]){
  await page.goto(route);await expect(page.locator('.loading:visible')).toHaveCount(0);await expect(page.locator('main h1')).toBeVisible();
  for(const width of [375,768,1024,1440]){await page.setViewportSize({width,height:900});await settled(page);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();}
  await inspect(page,'student-'+route.split('/')[1]+'-desktop');await page.setViewportSize({width:375,height:812});await inspect(page,'student-'+route.split('/')[1]+'-mobile');
 }
 await page.route('**/api/student/classes',async route=>{await new Promise(resolve=>setTimeout(resolve,800));await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Kết nối lớp học tạm gián đoạn.'})});});
 await page.goto('/classes');await expect(page.getByRole('status').filter({hasText:'Đang tải'})).toBeVisible();await expect(page.getByRole('alert').filter({hasText:'Kết nối lớp học tạm gián đoạn.'})).toBeVisible();await inspect(page,'classes-error-mobile');
 await page.unroute('**/api/student/classes');await page.getByRole('button',{name:'Thử lại'}).click();await expect(page.locator('.class-card').first()).toBeVisible();
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/dashboard');await expect(page.locator('main h1')).toBeVisible();expect(await page.locator('.route-enter').evaluate(el=>getComputedStyle(el).animationName)).toBe('none');
});
test('Teacher routes: responsive management, creation form and frozen content',async({page})=>{
 await login(page,'teacher');
 for(const route of ['/teacher','/teacher/questions','/teacher/exams','/teacher/classes','/teacher/results']){
  await page.goto(route);await expect(page.locator('.loading:visible')).toHaveCount(0);await expect(page.locator('main h1')).toBeVisible();await page.setViewportSize({width:1440,height:1000});await inspect(page,route.replaceAll('/','-').slice(1)+'-desktop');await page.setViewportSize({width:375,height:812});await inspect(page,route.replaceAll('/','-').slice(1)+'-mobile');
 }
 await page.goto('/teacher/exams');await page.getByRole('button',{name:'Tạo đề thi',exact:true}).click();const code=page.getByLabel('Mã đề',{exact:true});await code.fill('mã sai !');await page.getByLabel('Tên bài thi',{exact:true}).fill('Kiểm tra nhập liệu');expect(await code.evaluate((el:HTMLInputElement)=>el.validity.patternMismatch)).toBeTruthy();await expect(page.getByText('Tối đa 20 ký tự: chữ không dấu, số, dấu gạch.')).toBeVisible();await inspect(page,'teacher-create-mobile');await page.keyboard.press('Escape');
 const exams=await (await page.request.get('/api/teacher/exams')).json();const published=exams.find((x:{status:string})=>x.status==='Published');expect(published).toBeTruthy();await page.goto('/teacher/exams/'+published.examId);await expect(page.getByText('Đã khóa nội dung')).toBeVisible();await expect(page.getByLabel('Mã đề',{exact:true})).toBeDisabled();await inspect(page,'teacher-published-mobile');
});
