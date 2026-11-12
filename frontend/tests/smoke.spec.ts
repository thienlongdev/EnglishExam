import {test,expect,Page} from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";
import path from "node:path";
const env=Object.fromEntries(fs.readFileSync(path.resolve("../.env"),"utf8").trim().split(/\r?\n/).map(l=>l.split(/=(.*)/s).slice(0,2)));
const evidence=path.resolve("../evidence/screenshots");fs.mkdirSync(evidence,{recursive:true});
async function login(page:Page,user:string){
 await page.goto("/login");await page.getByRole("link",{name:"Tiếp tục đăng nhập"}).click();
 await page.locator("#username").fill(user);await page.locator("#password").fill(env.DEMO_PASSWORD);
 await page.locator("#kc-login").click();await page.waitForURL(/\/(dashboard|teacher)$/);
 await expect(page.getByRole("heading",{name:/Chào /})).toBeVisible();
}
async function overflow(page:Page){expect(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth)).toBeFalsy();}
async function axe(page:Page,label:string){
 await page.evaluate(async()=>{await document.fonts.ready;await Promise.all(document.getAnimations().filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})));});
 const r=await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21aa"]).analyze();
 fs.writeFileSync(path.resolve("../evidence/axe-"+label+".json"),JSON.stringify(r.violations,null,2));
 expect(r.violations.filter(v=>v.impact==="critical"||v.impact==="serious")).toEqual([]);
}
test("Landing: desktop, mobile, responsive and keyboard access",async({page})=>{
 const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
 await page.goto("/");await expect(page.getByRole("heading",{level:1})).toContainText("Một bước");
 await page.screenshot({path:path.join(evidence,"landing-desktop.png"),fullPage:true});await axe(page,"landing");
 for(const width of [375,768,1024,1440]){await page.setViewportSize({width,height:900});await overflow(page);}
 await page.setViewportSize({width:375,height:812});await page.emulateMedia({reducedMotion:"reduce"});
 await page.screenshot({path:path.join(evidence,"landing-mobile.png"),fullPage:true});
 await page.keyboard.press("Tab");expect(await page.locator(":focus").getAttribute("href")).toBe("#main");expect(errors).toEqual([]);
});
test("Real OIDC student: save, reload, replace, submit and persisted result",async({page})=>{
 const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
 await login(page,"student");await page.screenshot({path:path.join(evidence,"student-dashboard.png"),fullPage:true});await axe(page,"dashboard");
 await page.goto("/exams");await expect(page.getByRole("heading",{name:"Bài thi của tôi"})).toBeVisible();
 await page.getByRole("link",{name:"English foundations: Everyday language",exact:true}).first().click();
 if(await page.getByRole("link",{name:"Mở lượt đang làm"}).isVisible())await page.getByRole("link",{name:"Mở lượt đang làm"}).click();
 else{await page.getByRole("button",{name:"Bắt đầu làm bài"}).click();await page.getByRole("button",{name:"Tôi đã sẵn sàng"}).click();}
 await page.waitForURL(/\/attempts\/\d+$/);const attemptUrl=page.url();await expect(page.locator(".question-text")).toBeVisible();
 const id=attemptUrl.split("/").at(-1)!;const a=await page.request.get("/api/student/attempts/"+id);const body=await a.json();expect(JSON.stringify(body)).not.toMatch(/isCorrect/i);
 await page.locator('.answer-option input[value="A"]').check();await expect(page.getByText("Đã lưu đáp án A",{exact:true})).toBeVisible();
 await page.reload();await expect(page.locator('.answer-option input[value="A"]')).toBeChecked();
 await page.locator('.answer-option input[value="B"]').check();await expect(page.getByText("Đã lưu đáp án B",{exact:true})).toBeVisible();
 await page.screenshot({path:path.join(evidence,"exam-desktop.png"),fullPage:true});await axe(page,"exam");
 // A dropped save must remain visibly unsaved, and retry must receive confirmation.
 await page.getByRole("button",{name:"Câu tiếp",exact:true}).click();
 await page.route("**/api/student/attempts/*/answers/*",route=>route.abort());
 await page.locator('.answer-option input[value="A"]').check();await expect(page.getByText("Chưa lưu đáp án",{exact:true})).toBeVisible();
 await expect(page.getByRole("button",{name:"Nộp bài",exact:true})).toBeDisabled();
 await page.unroute("**/api/student/attempts/*/answers/*");await page.getByRole("button",{name:"Thử lưu lại"}).click();await expect(page.getByText("Đã lưu đáp án A",{exact:true})).toBeVisible();
 await page.setViewportSize({width:375,height:812});await overflow(page);await page.screenshot({path:path.join(evidence,"exam-mobile.png"),fullPage:true});
 await page.getByRole("button",{name:"Nộp bài",exact:true}).click();await expect(page.getByRole("dialog")).toBeVisible();
 await page.keyboard.press("Escape");await expect(page.getByRole("dialog")).not.toBeVisible();
 await page.getByRole("button",{name:"Nộp bài",exact:true}).click();await page.getByRole("button",{name:"Xác nhận nộp bài"}).click();
 await page.waitForURL(/\/results\/\d+$/);await expect(page.getByRole("heading",{name:"Bạn đã hoàn thành bài thi."})).toBeVisible();
 await page.reload();await expect(page.getByText("Đã nộp & ghi nhận")).toBeVisible();await overflow(page);
 await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:path.join(evidence,"result-desktop.png"),fullPage:true});await axe(page,"result");
 const r=await page.request.get("/api/student/attempts/"+id+"/result");expect(r.ok()).toBeTruthy();
 fs.writeFileSync(path.resolve("../evidence/live-local-attempt.json"),JSON.stringify({attemptId:id,result:await r.json(),realOidc:true,persistenceVerified:true},null,2));
 await page.getByRole("button",{name:"Đăng xuất"}).click();await page.waitForURL("/");expect((await page.request.get("/api/me")).status()).toBe(401);expect(errors).toEqual([]);
});
test("Real OIDC outsider: enrolled data and teacher APIs remain inaccessible",async({page,browser})=>{
 await login(page,"outsider");await expect(page.getByText("Chưa có bài thi được giao")).toBeVisible();
 const r=await page.request.get("/api/teacher/exams");expect(r.status()).toBe(403);
 const exams=await page.request.get("/api/student/exams");expect((await exams.json()).items).toHaveLength(0);
 const owner=await browser.newPage();await login(owner,"student");
 const history=await (await owner.request.get("/api/student/attempts")).json();expect(history.length).toBeGreaterThan(0);const last=history[0];await owner.close();
 expect((await page.request.get("/api/student/attempts/"+last.attemptId)).status()).toBe(404);
 await page.screenshot({path:path.join(evidence,"empty-student.png"),fullPage:true});
});
test("Real OIDC teacher: author questions, publish, assign and view results",async({page})=>{
 await login(page,"teacher");await page.waitForURL("/teacher");
 await page.screenshot({path:path.join(evidence,"teacher-dashboard.png"),fullPage:true});
 await page.goto("/teacher/questions");await page.getByRole("button",{name:"Thêm câu hỏi",exact:true}).click();
 await page.getByLabel("Nội dung câu hỏi",{exact:true}).fill("She _____ English every morning.");
 for(const [letter,text] of [["A","studies"],["B","study"],["C","studying"],["D","studied"]])await page.getByLabel("Nội dung lựa chọn "+letter,{exact:true}).fill(text);
 await page.getByRole("button",{name:"Lưu câu hỏi",exact:true}).click();await expect(page.getByRole("dialog")).not.toBeVisible();
 await expect(page.getByText("She _____ English every morning.",{exact:true}).first()).toBeVisible();
 await page.screenshot({path:path.join(evidence,"teacher-questions.png"),fullPage:true});
 // Additional genuine records through the same protected REST contract.
 const csrf=await (await page.request.get("/api/auth/csrf")).json();const headers={[csrf.headerName]:csrf.token};
 for(let i=0;i<4;i++){const r=await page.request.post("/api/teacher/questions",{headers,data:{questionText:"We _____ ready for the exam. (QA "+Date.now()+"-"+i+")",category:"Grammar",difficulty:"Easy",options:[{optionCode:"A",optionText:"are",isCorrect:true},{optionCode:"B",optionText:"is",isCorrect:false},{optionCode:"C",optionText:"am",isCorrect:false},{optionCode:"D",optionText:"be",isCorrect:false}]}});expect(r.status()).toBe(201);}
 await page.goto("/teacher/exams");await page.getByRole("button",{name:"Tạo đề thi",exact:true}).click();
 await page.getByLabel("Mã đề",{exact:true}).fill("QA-"+Date.now().toString().slice(-9));await page.getByLabel("Tên bài thi",{exact:true}).fill("Grammar checkpoint · Kiểm chứng trình duyệt");
 await page.getByRole("button",{name:"Tạo bản nháp",exact:true}).click();await page.waitForURL(/\/teacher\/exams\/\d+$/);
 await page.getByRole("button",{name:"Thêm câu",exact:true}).click();await expect(page.locator(".library-row").first()).toBeVisible();
 for(let i=0;i<5;i++)await page.getByRole("button",{name:"Thêm",exact:true}).first().click();
 await page.getByRole("button",{name:"Xong · 5 câu trong đề"}).click();await page.getByRole("button",{name:"Lưu cấu trúc",exact:true}).click();
 await expect(page.getByText("Đã lưu cấu trúc đề.")).toBeVisible();await page.getByRole("button",{name:"Công bố đề",exact:true}).click();await page.getByRole("button",{name:"Xác nhận công bố"}).click();
 await expect(page.getByText("Đã khóa nội dung")).toBeVisible();await page.getByRole("button",{name:"Giao / cập nhật lịch"}).click();
 await page.getByLabel("Lớp phụ trách",{exact:true}).selectOption({label:"WEB-ENG-01 · Tiếng Anh nền tảng · Lớp 01"});
 const local=(d:Date)=>new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);
 await page.getByLabel("Thời gian mở đề",{exact:true}).fill(local(new Date(Date.now()-3600000)));
 await page.getByLabel("Thời gian đóng đề",{exact:true}).fill(local(new Date(Date.now()+86400000)));
 await page.getByRole("button",{name:"Lưu lịch thi",exact:true}).click();await expect(page.getByRole("dialog")).not.toBeVisible();
 await expect(page.getByRole("cell",{name:"WEB-ENG-01",exact:true})).toBeVisible();await page.screenshot({path:path.join(evidence,"teacher-exam-published.png"),fullPage:true});
 await page.goto("/teacher/results");await expect(page.getByRole("cell",{name:"Trần An"}).first()).toBeVisible();
 await page.setViewportSize({width:375,height:812});await overflow(page);await page.screenshot({path:path.join(evidence,"teacher-results-mobile.png"),fullPage:true});
});
