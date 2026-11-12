const {chromium,expect}=require('@playwright/test');
const AxeBuilder=require('@axe-core/playwright').default;
const fs=require('fs');
(async()=>{
 const url=process.env.TEST_PUBLIC_URL;if(!url)throw new Error('Set TEST_PUBLIC_URL to the verified deployment URL.');
 const browser=await chromium.launch({channel:'chrome'});const context=await browser.newContext({viewport:{width:1440,height:1000},locale:'vi-VN'});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const report={url,checkedAt:new Date().toISOString(),checks:[],mode:'preview'};
 try{
  const response=await page.goto(url);expect(response.status()).toBe(200);await expect(page.getByText('Bản xem trước · Cổng thi chưa mở.')).toBeVisible();await page.evaluate(()=>document.fonts.ready);
  for(const width of [375,768,1024,1440]){await page.setViewportSize({width,height:1000});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();report.checks.push({viewport:width,overflow:false});}
  expect(await page.locator('body').evaluate(el=>getComputedStyle(el).fontFamily)).toContain('Quicksand');
  await page.screenshot({path:'../evidence/screenshots/public-desktop.png',fullPage:true});await page.screenshot({path:'../evidence/screenshots/public-viewport.png'});
  const audit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(audit.violations).toEqual([]);report.axeViolations=audit.violations.length;
  await page.setViewportSize({width:375,height:812});await page.screenshot({path:'../evidence/screenshots/public-mobile.png',fullPage:true});
  await page.getByRole('link',{name:'Đăng nhập',exact:true}).click();await expect(page.getByText('Cổng thi chưa mở.',{exact:true})).toBeVisible();await expect(page.getByRole('link',{name:'Tiếp tục đăng nhập'})).toHaveCount(0);await page.screenshot({path:'../evidence/screenshots/public-login-mobile.png',fullPage:true});
  for(const route of ['/api/me','/api/public/status','/api/student/exams']){const r=await page.request.get(new URL(route,url).href);expect(r.status()).toBe(503);expect((await r.json()).code).toBe('SERVICE_NOT_READY');report.checks.push({route,status:r.status()});}
  const auth=await page.request.get(new URL('/oauth2/authorization/exam',url).href,{maxRedirects:0});expect(auth.status()).toBe(307);expect(auth.headers().location).toContain('/login?error=unavailable');report.checks.push({route:'/oauth2/authorization/exam',status:auth.status()});
  await page.goto(new URL('/teacher',url).href);await expect(page).toHaveURL(/\/login\?error=unavailable$/);expect(errors).toEqual([]);report.browserErrors=errors;report.pass=true;
 }finally{fs.writeFileSync('../evidence/public-verification.json',JSON.stringify(report,null,2));await browser.close();}
 console.log(JSON.stringify(report));
})().catch(e=>{console.error(e);process.exitCode=1});
