import {test,expect,Page} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const env=Object.fromEntries(fs.readFileSync(path.resolve('../.env'),'utf8').trim().split(/\r?\n/).map(l=>l.split(/=(.*)/s).slice(0,2)));
const out=path.resolve('../evidence/classroom');fs.mkdirSync(out,{recursive:true});
async function login(page:Page,user:string){
 await page.goto('/login');await page.getByRole('link',{name:'Tiếp tục đăng nhập'}).click();
 await expect(page.locator('#username')).toBeVisible();
 await page.locator('#username').fill(user);await page.locator('#password').fill(env.DEMO_PASSWORD);
 await page.locator('#kc-login').click();await page.waitForURL(/\/(dashboard|teacher)$/);
 await expect(page.getByRole('heading',{name:/Chào /})).toBeVisible();
 const me=await (await page.request.get('/api/me')).json();expect(me.email).toBe(user+'@exam.local');return me;
}
async function logout(page:Page){
 await page.getByRole('button',{name:'Đăng xuất',exact:true}).click();await page.waitForURL('http://localhost:3000/');
 expect((await page.request.get('/api/me')).status()).toBe(401);
}
async function mutate(page:Page,url:string,method:string,data?:unknown){
 const token=await (await page.request.get('/api/auth/csrf')).json();
 return page.request.fetch('/api'+url,{method,headers:{[token.headerName]:token.token},data});
}
function sql(query:string){
 return JSON.parse(execFileSync('powershell.exe',['-NoProfile','-File',path.resolve('../scripts/classroom-query.ps1'),'-QueryBase64',Buffer.from(query).toString('base64')],{encoding:'utf8'}).trim());
}
async function shot(page:Page,name:string){
 await page.evaluate(async()=>{await document.fonts.ready;await Promise.all(document.getAnimations().filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})));});
 await page.screenshot({path:path.join(out,name+'.png'),fullPage:true,animations:'disabled'});
}
const write=(name:string,value:unknown)=>fs.writeFileSync(path.join(out,name+'.json'),JSON.stringify(value,null,2));

async function fixture(page:Page){
 const classes=await (await page.request.get('/api/teacher/classes')).json(),clazz=classes.find((c:{classCode:string})=>c.classCode==='WEB-ENG-01');
 const questions=(await (await page.request.get('/api/teacher/questions')).json()).slice(0,5);
 const created=await mutate(page,'/teacher/exams','POST',{examCode:'EDGE-'+Date.now().toString().slice(-10),title:'Classroom deadline and access verification',durationMinutes:1});expect(created.status()).toBe(201);
 const {examId}=await created.json();
 expect((await mutate(page,`/teacher/exams/${examId}/questions`,'PUT',{questions:questions.map((q:{questionId:number},i:number)=>({questionId:q.questionId,questionOrder:i+1,points:i+1}))})).status()).toBe(200);
 expect((await mutate(page,`/teacher/exams/${examId}/publish`,'POST')).status()).toBe(200);
 return {examId,classId:clazz.classId,questions};
}
async function schedule(page:Page,f:{examId:number;classId:number},opensAt:number,closesAt:number,isActive=true,maxAttempts=1){
 const r=await mutate(page,`/teacher/exams/${f.examId}/assignments`,'PUT',{classId:f.classId,opensAt:new Date(opensAt).toISOString(),closesAt:new Date(closesAt).toISOString(),isActive,maxAttempts});expect(r.status()).toBe(200);
}

test('Real authorization, windows, deadline auto-submit and retry use SQL state',async({page,browser})=>{
 test.setTimeout(120000);await login(page,'teacher');const f=await fixture(page);
 const context=await browser.newContext({locale:'vi-VN',timezoneId:'Asia/Bangkok'}),student=await context.newPage();
 const outsiderContext=await browser.newContext(),outsider=await outsiderContext.newPage();
 try{
  await login(student,'student');await login(outsider,'outsider');
  const denied:any[]=[];
  await schedule(page,f,Date.now()+60000,Date.now()+120000);
  for(const [name,open,close,active] of [['Upcoming',60000,120000,true],['Closed',-120000,-60000,true],['Inactive',-60000,120000,false]] as const){
   await schedule(page,f,Date.now()+open,Date.now()+close,active);
   const response=await mutate(student,'/student/attempts','POST',{examId:f.examId,classId:f.classId});expect(response.status()).toBe(409);expect((await response.json()).code).toBe('SQL_51113');
   await student.goto(`/exams/${f.examId}/${f.classId}`);await expect(student.getByRole('button',{name:'Bắt đầu làm bài',exact:true})).toHaveCount(0);
   denied.push({case:name,status:409});
  }
  await schedule(page,f,Date.now()-60000,Date.now()+120000);
  const response=await mutate(outsider,'/student/attempts','POST',{examId:f.examId,classId:f.classId});expect(response.status()).toBe(409);expect((await response.json()).code).toBe('SQL_51112');
  await outsider.goto(`/exams/${f.examId}/${f.classId}`);await expect(outsider.getByText('Bài thi chưa được giao cho bạn')).toBeVisible();
  expect((await mutate(outsider,`/teacher/classes/${f.classId}/enrollments`,'PUT',{email:'outsider@exam.local',isActive:true})).status()).toBe(403);
  await schedule(page,f,Date.now()-60000,Date.now()+12000);
  await student.goto(`/exams/${f.examId}/${f.classId}`);await student.getByRole('button',{name:'Bắt đầu làm bài'}).click();await student.getByRole('button',{name:'Tôi đã sẵn sàng'}).click();
  await student.waitForURL(/\/attempts\/\d+$/);const attemptId=Number(student.url().split('/').at(-1));
  await student.locator('.answer-option input[value="A"]').check();await expect(student.getByText('Đã lưu đáp án A',{exact:true})).toBeVisible();
  const foreign=sql(`SELECT TOP(1) QuestionId FROM dbo.Questions WHERE QuestionId NOT IN (SELECT QuestionId FROM dbo.ExamQuestions WHERE ExamId=${f.examId}) ORDER BY QuestionId`)[0].QuestionId;
  const outside=await mutate(student,`/student/attempts/${attemptId}/answers/${foreign}`,'PUT',{optionCode:'A'});expect(outside.status()).toBe(409);expect((await outside.json()).code).toBe('SQL_51121');
  expect((await mutate(student,`/student/attempts/${attemptId}/answers/${f.questions[0].questionId}`,'PUT',{optionCode:'Z'})).status()).toBe(400);
  expect((await mutate(student,`/student/attempts/${attemptId}/answers/${f.questions[0].questionId}`,'PUT',{optionCode:'A',questionId:foreign})).status()).toBe(400);
  // Drop the actual automatic submit request once; no fabricated response or score.
  let dropped=0;await student.route(`**/api/student/attempts/${attemptId}/submit`,async route=>{dropped++;await route.abort();},{times:1});
  await expect(student.getByText('Đã hết thời gian. Hệ thống chỉ chấm các đáp án đã được máy chủ lưu.')).toBeVisible({timeout:20000});
  await expect(student.locator('.notice[role="alert"]')).toContainText('Kết nối đang chậm');expect(dropped).toBe(1);
  const late=await mutate(student,`/student/attempts/${attemptId}/answers/${f.questions[0].questionId}`,'PUT',{optionCode:'B'});expect(late.status()).toBe(409);expect((await late.json()).code).toBe('SQL_51120');
  expect(sql(`SELECT Status FROM dbo.ExamAttempts WHERE AttemptId=${attemptId}`)[0].Status).toBe('InProgress');await shot(student,'deadline-network-failure');
  await student.getByRole('button',{name:'Nộp lại bài đã lưu'}).click();await student.waitForURL(`/results/${attemptId}`);
  const submitted=sql(`SELECT AttemptId,DeadlineAt,SubmittedAt,Status FROM dbo.ExamAttempts WHERE AttemptId=${attemptId}`)[0];expect(submitted.Status).toBe('Submitted');expect(Date.parse(submitted.SubmittedAt)).toBeGreaterThanOrEqual(Date.parse(submitted.DeadlineAt));
  await shot(student,'deadline-late-submit-result');
  // Successful automatic submit, with its real request reaching the backend.
  const automatic=await fixture(page);await schedule(page,automatic,Date.now()-60000,Date.now()+8000);
  const start=await mutate(student,'/student/attempts','POST',{examId:automatic.examId,classId:automatic.classId});expect(start.status()).toBe(201);const automaticId=(await start.json()).attemptId;
  await student.goto('/attempts/'+automaticId);await expect(student.locator('.question-text')).toBeVisible();
  await student.waitForURL(`/results/${automaticId}`,{timeout:20000});
  expect(sql(`SELECT Status,EarnedPoints FROM dbo.ExamAttempts WHERE AttemptId=${automaticId}`)[0]).toMatchObject({Status:'Submitted',EarnedPoints:0});
  write('edge-cases',{denied,unenrolled:409,unauthorizedEnrollment:403,outsideQuestion:409,invalidOption:400,foreignQuestionInBody:400,saveAfterDeadline:409,failedAutomaticRequestRecovered:true,lateSubmission:submitted,automaticAttemptId:automaticId,automaticSubmitted:true});
 }finally{await context.close();await outsiderContext.close();}
});

test('Invalidated session rejects saving and permits re-login with saved answers',async({page,browser})=>{
 test.setTimeout(90000);await login(page,'teacher');const f=await fixture(page);await schedule(page,f,Date.now()-60000,Date.now()+180000);
 const context=await browser.newContext(),student=await context.newPage();
 try{
  await login(student,'student');const r=await mutate(student,'/student/attempts','POST',{examId:f.examId,classId:f.classId});expect(r.status()).toBe(201);const id=(await r.json()).attemptId;
  await student.goto('/attempts/'+id);await student.locator('.answer-option input[value="A"]').check();await expect(student.getByText('Đã lưu đáp án A',{exact:true})).toBeVisible();
  const otherTab=await context.newPage();await otherTab.goto('/dashboard');await logout(otherTab);await otherTab.close();
  await student.locator('.answer-option input[value="B"]').check();await expect(student.getByText('Chưa lưu đáp án',{exact:true})).toBeVisible();
  expect((await student.request.get('/api/student/attempts/'+id)).status()).toBe(401);
  expect(sql(`SELECT SelectedOptionCode FROM dbo.StudentAnswers WHERE AttemptId=${id}`)[0].SelectedOptionCode).toBe('A');
  await shot(student,'session-invalidated-unsaved');await student.getByRole('button',{name:'Bỏ thay đổi chưa lưu'}).click();
  await login(student,'student');await student.goto('/attempts/'+id);await expect(student.locator('.answer-option input[value="A"]')).toBeChecked();
  await student.getByRole('button',{name:'Nộp bài',exact:true}).click();await student.getByRole('button',{name:'Xác nhận nộp bài'}).click();await student.waitForURL('/results/'+id);
  write('session-recovery',{attemptId:id,sessionInvalidatedByRealLogout:true,unauthenticatedStatus:401,savedAnswerRetained:'A',submitted:true});
 }finally{await context.close();}
});

test('OIDC logout ends SSO and permits account switching in the same browser',async({page})=>{
 await login(page,'teacher');await logout(page);
 await login(page,'student');await logout(page);
 await page.goto('/teacher');await expect(page.locator('.notice[role="alert"]')).toContainText('Vui lòng đăng nhập');
 expect((await page.request.get('/api/teacher/exams')).status()).toBe(401);await shot(page,'logout-protected');
 write('logout',{sameBrowserTeacherToStudent:true,applicationSessionEnded:true,oidcSessionEnded:true,protectedApiStatus:401});
});

test('Complete classroom UI journey with independent SQL scoring',async({page,browser})=>{
 test.setTimeout(180000);
 const errors:string[]=[],serverErrors:string[]=[];
 const observe=(p:Page)=>{p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=500)serverErrors.push(r.status()+' '+new URL(r.url()).pathname);});};observe(page);
 const tag=Date.now().toString().slice(-10),title='Classroom E2E '+tag;
 const teacher=await login(page,'teacher');await page.reload();await expect(page.getByRole('heading',{name:/Chào /})).toBeVisible();
 await shot(page,'01-teacher-authenticated');
 const classes=await (await page.request.get('/api/teacher/classes')).json();
 const clazz=classes.find((c:{classCode:string})=>c.classCode==='WEB-ENG-01');expect(clazz).toBeTruthy();
 await page.getByRole('link',{name:'Lớp phụ trách',exact:true}).click();
 await page.locator('.class-card').filter({hasText:'WEB-ENG-01'}).getByRole('button',{name:'Danh sách học viên'}).click();
 await page.getByLabel('Email học viên',{exact:true}).fill('student@exam.local');
 await page.getByRole('button',{name:'Lưu ghi danh',exact:true}).click();
 await expect(page.locator('.student-list')).toContainText('student@exam.local');
 const enrollment=sql(`SELECT ce.StudentId,ce.ClassId,ce.IsActive,u.Email FROM dbo.ClassEnrollments ce JOIN dbo.Users u ON u.UserId=ce.StudentId WHERE ce.ClassId=${clazz.classId} AND u.Email='student@exam.local'`);
 expect(enrollment).toHaveLength(1);expect(enrollment[0].IsActive).toBe(true);
 // An active duplicate is an idempotent update of the composite key.
 await page.getByLabel('Email học viên',{exact:true}).fill('student@exam.local');await page.getByRole('button',{name:'Lưu ghi danh',exact:true}).click();
 await expect(page.getByLabel('Email học viên',{exact:true})).toHaveValue('');
 expect(sql(`SELECT COUNT(*) N FROM dbo.ClassEnrollments WHERE StudentId=${enrollment[0].StudentId} AND ClassId=${clazz.classId}`)[0].N).toBe(1);
 await shot(page,'02-enrollment');await page.keyboard.press('Escape');
 const authored:{questionId:number;correct:string;text:string}[]=[];
 await page.getByRole('link',{name:'Ngân hàng câu hỏi',exact:true}).click();
 for(let i=0;i<5;i++){
  await page.getByRole('button',{name:'Thêm câu hỏi',exact:true}).click();
  const text=`${tag} Q${i+1}: Select the correct English sentence.`,correct=['A','B','C','D','A'][i];
  await page.getByLabel('Nội dung câu hỏi',{exact:true}).fill(text);
  for(const letter of ['A','B','C','D'])await page.getByLabel('Nội dung lựa chọn '+letter,{exact:true}).fill(letter===correct?'She studies English every day.':`Incorrect choice ${letter} for question ${i+1}.`);
  await page.getByLabel('Đáp án đúng '+correct,{exact:true}).check();
  const response=page.waitForResponse(r=>r.url().endsWith('/api/teacher/questions')&&r.request().method()==='POST');
  await page.getByRole('button',{name:'Lưu câu hỏi',exact:true}).click();const saved=await response;expect(saved.status()).toBe(201);
  authored.push({questionId:(await saved.json()).questionId,correct,text});await expect(page.getByRole('dialog')).not.toBeVisible();
 }
 await shot(page,'03-five-authored-questions');
 await page.getByRole('link',{name:'Đề thi',exact:true}).click();await page.getByRole('button',{name:'Tạo đề thi',exact:true}).click();
 await page.getByLabel('Mã đề',{exact:true}).fill('CLASS-'+tag);await page.getByLabel('Tên bài thi',{exact:true}).fill(title);
 await page.getByLabel('Thời lượng (phút)',{exact:true}).fill('20');await page.getByRole('button',{name:'Tạo bản nháp',exact:true}).click();
 await page.waitForURL(/\/teacher\/exams\/\d+$/);const examId=Number(page.url().split('/').at(-1));
 await expect(page.getByRole('button',{name:'Công bố đề',exact:true})).toBeDisabled();
 const invalidPublish=await mutate(page,`/teacher/exams/${examId}/publish`,'POST');expect(invalidPublish.status()).toBe(409);
 expect((await invalidPublish.json()).code).toBe('SQL_51102');
 expect(sql(`SELECT Status FROM dbo.Exams WHERE ExamId=${examId}`)[0].Status).toBe('Draft');
 await page.reload();await expect(page.getByText('Đề thi đang chờ những câu hỏi hay')).toBeVisible();
 await page.getByRole('button',{name:'Thêm câu',exact:true}).click();
 await page.getByLabel('Tìm câu hỏi để thêm').fill(tag);await page.getByRole('button',{name:'Tìm',exact:true}).click();
 for(const q of authored)await page.locator('.library-row').filter({hasText:q.text}).getByRole('button',{name:'Thêm',exact:true}).click();
 await page.getByRole('button',{name:'Xong · 5 câu trong đề'}).click();
 await page.getByRole('button',{name:'Đưa câu 5 lên',exact:true}).click();
 for(let i=0;i<5;i++)await page.getByLabel('Điểm câu '+(i+1),{exact:true}).fill(String(i+1));
 await page.getByRole('button',{name:'Lưu cấu trúc',exact:true}).click();await expect(page.getByText('Đã lưu cấu trúc đề.')).toBeVisible();
 await page.reload();await expect(page.getByLabel('Điểm câu 5',{exact:true})).toHaveValue('5');
 await page.getByRole('button',{name:'Công bố đề',exact:true}).click();await page.getByRole('button',{name:'Xác nhận công bố'}).click();
 await expect(page.getByText('Đã khóa nội dung')).toBeVisible();await expect(page.getByLabel('Điểm câu 1',{exact:true})).toBeDisabled();
 await shot(page,'04-published-weighted-exam');
 const frozen=await mutate(page,`/teacher/exams/${examId}/questions`,'PUT',{questions:[]});expect(frozen.status()).toBe(409);
 await page.getByRole('button',{name:'Giao / cập nhật lịch'}).click();
 await page.getByLabel('Lớp phụ trách',{exact:true}).selectOption(String(clazz.classId));
 const local=(ms:number)=>new Date(ms+7*3600000).toISOString().slice(0,16);
 await page.getByLabel('Thời gian mở đề',{exact:true}).fill(local(Date.now()-3600000));
 await page.getByLabel('Thời gian đóng đề',{exact:true}).fill(local(Date.now()+86400000));
 await page.getByLabel('Lượt thi tối đa',{exact:true}).fill('1');await page.getByRole('button',{name:'Lưu lịch thi',exact:true}).click();
 await expect(page.getByRole('dialog')).not.toBeVisible();await expect(page.getByRole('cell',{name:'WEB-ENG-01',exact:true})).toBeVisible();
 const assignment=sql(`SELECT ExamId,ClassId,OpensAt,ClosesAt,MaxAttempts,AuthorizedBy,IsActive FROM dbo.ExamAssignments WHERE ExamId=${examId} AND ClassId=${clazz.classId}`);
 expect(assignment).toHaveLength(1);expect(assignment[0].AuthorizedBy).toBe(teacher.userId);await shot(page,'05-assigned-to-class');
 const teacherStart=await mutate(page,'/student/attempts','POST',{examId,classId:clazz.classId});expect(teacherStart.status()).toBe(403);
 await logout(page);
 const studentContext=await browser.newContext({locale:'vi-VN',timezoneId:'Asia/Bangkok',viewport:{width:1440,height:1000}});
 const studentPage=await studentContext.newPage();observe(studentPage);
 try{
  const student=await login(studentPage,'student');await shot(studentPage,'06-student-authenticated');
  expect((await mutate(studentPage,'/teacher/exams','POST',{examCode:'NO',title:'Forbidden',durationMinutes:20})).status()).toBe(403);
  expect((await mutate(studentPage,`/teacher/exams/${examId}/publish`,'POST')).status()).toBe(403);
  await studentPage.getByRole('link',{name:'Lớp học',exact:true}).click();
  await studentPage.locator('.class-card').filter({hasText:'WEB-ENG-01'}).getByRole('link',{name:'Xem bài thi'}).click();
  await studentPage.getByRole('link',{name:title,exact:true}).click();await studentPage.getByRole('button',{name:'Bắt đầu làm bài'}).click();
  await studentPage.getByRole('button',{name:'Tôi đã sẵn sàng'}).click();await studentPage.waitForURL(/\/attempts\/\d+$/);
  const attemptId=Number(studentPage.url().split('/').at(-1));
  const started=sql(`SELECT AttemptId,StudentId,ExamId,ClassId,AttemptNo,StartedAt,DeadlineAt,Status FROM dbo.ExamAttempts WHERE AttemptId=${attemptId}`)[0];
  expect(started).toMatchObject({StudentId:student.userId,ExamId:examId,ClassId:clazz.classId,AttemptNo:1,Status:'InProgress'});
  expect(Date.parse(started.DeadlineAt)-Date.parse(started.StartedAt)).toBe(20*60000);
  const attempt=await (await studentPage.request.get('/api/student/attempts/'+attemptId)).json();expect(attempt.questions).toHaveLength(5);expect(JSON.stringify(attempt)).not.toMatch(/isCorrect/i);
  await shot(studentPage,'07-attempt-started');
  const answers:{questionId:number;optionCode:string}[]=[];
  for(let i=0;i<4;i++){
   const q=attempt.questions[i],correct=authored.find(a=>a.questionId===q.questionId)!.correct,wrong=correct==='A'?'B':'A';
   await expect(studentPage.locator('.question-text')).toHaveText(q.questionText);
   const chosen=i===1||i===2?wrong:correct;
   await studentPage.locator(`.answer-option input[value="${chosen}"]`).check();await expect(studentPage.getByText('Đã lưu đáp án '+chosen,{exact:true})).toBeVisible();
   if(i===2){await studentPage.locator(`.answer-option input[value="${correct}"]`).check();await expect(studentPage.getByText('Đã lưu đáp án '+correct,{exact:true})).toBeVisible();}
   answers.push({questionId:q.questionId,optionCode:i===1?wrong:correct});
   await studentPage.getByRole('button',{name:'Câu tiếp',exact:true}).click();
  }
  await expect(studentPage.locator('.question-text')).toHaveText(attempt.questions[4].questionText);await expect(studentPage.getByText('Chưa chọn đáp án',{exact:true})).toBeVisible();
  await studentPage.reload();await expect(studentPage.locator(`.answer-option input[value="${answers[0].optionCode}"]`)).toBeChecked();
  const persistedAnswers=sql(`SELECT QuestionId,SelectedOptionCode,AnsweredAt FROM dbo.StudentAnswers WHERE AttemptId=${attemptId} ORDER BY QuestionId`);
  expect(persistedAnswers).toHaveLength(4);for(const a of answers)expect(persistedAnswers.find((r:{QuestionId:number})=>r.QuestionId===a.questionId).SelectedOptionCode).toBe(a.optionCode);
  await shot(studentPage,'08-answers-restored-after-refresh');
  await studentPage.getByRole('button',{name:'Nộp bài',exact:true}).click();await expect(studentPage.getByText('Còn 1 câu chưa trả lời. Những câu này được tính 0 điểm.')).toBeVisible();
  await studentPage.getByRole('button',{name:'Xác nhận nộp bài',exact:true}).click();await studentPage.waitForURL(`/results/${attemptId}`);
  await expect(studentPage.locator('.result-score')).toContainText('53,33');await expect(studentPage.locator('.result-info')).toContainText('8 / 15');
  await shot(studentPage,'09-student-score');
  const scoreRows=sql(`SELECT eq.QuestionOrder,eq.QuestionId,eq.Points,sa.SelectedOptionCode,ao.IsCorrect,CASE WHEN ao.IsCorrect=1 THEN eq.Points ELSE 0 END RecalculatedPoints FROM dbo.ExamAttempts a JOIN dbo.ExamQuestions eq ON eq.ExamId=a.ExamId LEFT JOIN dbo.StudentAnswers sa ON sa.AttemptId=a.AttemptId AND sa.QuestionId=eq.QuestionId LEFT JOIN dbo.AnswerOptions ao ON ao.QuestionId=sa.QuestionId AND ao.OptionCode=sa.SelectedOptionCode WHERE a.AttemptId=${attemptId} ORDER BY eq.QuestionOrder`);
  const earned=scoreRows.reduce((n:number,r:{RecalculatedPoints:number})=>n+r.RecalculatedPoints,0),maximum=scoreRows.reduce((n:number,r:{Points:number})=>n+r.Points,0);
  const independentSqlScore=sql(`SELECT SUM(eq.Points) MaxPoints,SUM(CASE WHEN ao.IsCorrect=1 THEN eq.Points ELSE 0 END) EarnedPoints,CONVERT(decimal(6,2),100.0*SUM(CASE WHEN ao.IsCorrect=1 THEN eq.Points ELSE 0 END)/SUM(eq.Points)) ScorePercent FROM dbo.ExamAttempts a JOIN dbo.ExamQuestions eq ON eq.ExamId=a.ExamId LEFT JOIN dbo.StudentAnswers sa ON sa.AttemptId=a.AttemptId AND sa.QuestionId=eq.QuestionId LEFT JOIN dbo.AnswerOptions ao ON ao.QuestionId=sa.QuestionId AND ao.OptionCode=sa.SelectedOptionCode WHERE a.AttemptId=${attemptId}`)[0];
  expect(independentSqlScore).toEqual({EarnedPoints:8,MaxPoints:15,ScorePercent:53.33});
  expect(earned).toBe(8);expect(maximum).toBe(15);expect(scoreRows[1].RecalculatedPoints).toBe(0);expect(scoreRows[4].SelectedOptionCode).toBeNull();expect(scoreRows[4].RecalculatedPoints).toBe(0);
  const final=sql(`SELECT a.AttemptId,a.Status,a.SubmittedAt,a.EarnedPoints,r.MaxPoints,r.ScorePercent FROM dbo.ExamAttempts a JOIN dbo.vw_StudentExamResults r ON r.AttemptId=a.AttemptId WHERE a.AttemptId=${attemptId}`)[0];
  expect(final).toMatchObject({Status:'Submitted',EarnedPoints:earned,MaxPoints:maximum,ScorePercent:Math.round(earned/maximum*10000)/100});expect(final.SubmittedAt).toBeTruthy();
  expect((await mutate(studentPage,`/student/attempts/${attemptId}/answers/${answers[0].questionId}`,'PUT',{optionCode:'B'})).status()).toBe(409);
  const duplicates=await Promise.all([mutate(studentPage,`/student/attempts/${attemptId}/submit`,'POST'),mutate(studentPage,`/student/attempts/${attemptId}/submit`,'POST')]);
  for(const res of duplicates){expect(res.status()).toBe(200);expect((await res.json()).earnedPoints).toBe(8);}
  expect(sql(`SELECT COUNT(*) N FROM dbo.vw_StudentExamResults WHERE AttemptId=${attemptId}`)[0].N).toBe(1);
  const exhausted=await mutate(studentPage,'/student/attempts','POST',{examId,classId:clazz.classId});expect(exhausted.status()).toBe(409);expect((await exhausted.json()).code).toBe('SQL_51114');
  await logout(studentPage);await login(studentPage,'student');await studentPage.goto('/history');
  await studentPage.getByRole('row').filter({hasText:title}).getByRole('link',{name:'Kết quả'}).click();await expect(studentPage.locator('.result-info')).toContainText('8 / 15');await shot(studentPage,'10-student-result-after-relogin');
  await logout(studentPage);await login(page,'teacher');await page.getByRole('link',{name:'Kết quả học viên',exact:true}).click();
  const resultRow=page.getByRole('row').filter({hasText:title});await expect(resultRow).toContainText('Trần An');await expect(resultRow).toContainText('8/15');await expect(resultRow).toContainText('53,33%');await shot(page,'11-teacher-result');
  await logout(page);await page.goto('/teacher/results');await expect(page.locator('.notice[role="alert"]')).toContainText('Vui lòng đăng nhập');
  expect((await page.request.get('/api/teacher/results')).status()).toBe(401);await shot(page,'12-logout-protected');expect(errors).toEqual([]);expect(serverErrors).toEqual([]);
  write('workflow',{tag,title,teacherId:teacher.userId,studentId:student.userId,classId:clazz.classId,examId,attemptId,enrollment,assignment,authored,started,persistedAnswers,scoreRows,independentSqlScore,independentlyCalculated:{earned,maximum,percent:Math.round(earned/maximum*10000)/100},final,browserErrors:errors,serverErrors,passed:true});
 }finally{await studentContext.close();}
});
