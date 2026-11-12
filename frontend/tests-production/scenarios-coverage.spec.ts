import { test, expect, Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const qa = JSON.parse(fs.readFileSync(path.resolve('../.local/demo/qa-credentials.json'), 'utf8'));
const out = path.resolve('../evidence/production/scenarios');
fs.mkdirSync(out, { recursive: true });

async function login(page: Page, user: string) {
  await page.goto('/login');
  await page.getByRole('link', { name: 'Tiếp tục đăng nhập' }).click();
  await expect(page.locator('#username')).toBeVisible({ timeout: 15000 });
  await page.locator('#username').fill(user);
  await page.locator('#password').fill(qa.accounts[user].password);
  await page.locator('#kc-login').click();
  await page.waitForURL(/\/(dashboard|teacher)$/, { timeout: 30000 });
  await expect(page.getByRole('heading', { name: /Chào / })).toBeVisible({ timeout: 15000 });
  const me = await (await page.request.get('/api/me')).json();
  expect(me.email).toBe(qa.accounts[user].email);
  return me;
}

async function logout(page: Page) {
  const logoutBtn = page.getByRole('button', { name: 'Đăng xuất', exact: true });
  if (await logoutBtn.isVisible()) {
    await logoutBtn.click();
    await page.waitForURL('https://english-exam-coursework.vercel.app/', { timeout: 20000 });
  }
}

async function mutate(page: Page, url: string, method: string, data?: unknown, retries = 2): Promise<any> {
  let lastErr: any;
  for (let i = 0; i <= retries; i++) {
    try {
      const tokenRes = await page.request.get('/api/auth/csrf');
      const token = await tokenRes.json();
      return await page.request.fetch('/api' + url, {
        method,
        headers: { [token.headerName]: token.token },
        data,
      });
    } catch (err) {
      lastErr = err;
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
  throw lastErr;
}

function sql(query: string) {
  return JSON.parse(
    execFileSync(
      'powershell.exe',
      ['-NoProfile', '-File', path.resolve('../scripts/demo-query.ps1'), '-QueryBase64', Buffer.from(query).toString('base64')],
      { encoding: 'utf8' }
    ).trim()
  );
}

async function shot(page: Page, name: string) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      document.getAnimations().filter(a => a.effect?.getTiming().iterations !== Infinity).map(a => a.finished.catch(() => {}))
    );
  });
  await page.screenshot({ path: path.join(out, name + '.png'), fullPage: true, animations: 'disabled' });
}

const write = (name: string, value: unknown) =>
  fs.writeFileSync(path.join(out, name + '.json'), JSON.stringify(value, null, 2));

test.describe('Comprehensive ERD Functional Coverage Scenarios A-H', () => {
  test.setTimeout(360000);

  test('Execute Scenarios A through H end-to-end', async ({ page, browser }) => {
    const tag = Date.now().toString().slice(-6);
    const scenarioEvidence: Record<string, any> = {};

    // ==========================================
    // SCENARIO A: One Teacher, Multiple Classes
    // ==========================================
    console.log('[SCENARIO A] Creating multiple classes under one teacher...');
    const teacherUser = await login(page, 'teacher');
    expect(teacherUser.isTeacher).toBe(true);

    const classCodes = [`ENG-A1-${tag}`, `ENG-A2-${tag}`, `ENG-B1-${tag}`];
    const createdClasses: { classId: number; classCode: string }[] = [];

    for (const code of classCodes) {
      const res = await mutate(page, '/teacher/classes', 'POST', {
        classCode: code,
        className: `Lớp tiếng Anh ${code}`,
        isActive: true,
      });
      expect(res.status()).toBe(201);
      const data = await res.json();
      createdClasses.push({ classId: data.classId, classCode: code });
    }

    // Verify all 3 appear in teacher classes list
    const teacherClasses = await (await page.request.get('/api/teacher/classes')).json();
    for (const code of classCodes) {
      const found = teacherClasses.find((c: any) => c.classCode === code);
      expect(found).toBeTruthy();
      expect(found.isActive).toBe(true);
    }

    // Edit metadata for first class
    const editRes = await mutate(page, `/teacher/classes/${createdClasses[0].classId}`, 'PUT', {
      classCode: classCodes[0],
      className: `Lớp tiếng Anh ${classCodes[0]} (Nâng cao)`,
      isActive: true,
    });
    expect(editRes.status()).toBe(200);

    // Verify SQL persistence and teacher ownership
    const sqlClasses = sql(
      `SELECT ClassId, ClassCode, ClassName, TeacherId, IsActive FROM dbo.Classes WHERE ClassId IN (${createdClasses.map(c => c.classId).join(',')}) ORDER BY ClassId`
    );
    expect(sqlClasses.length).toBe(3);
    for (const c of sqlClasses) {
      expect(c.TeacherId).toBe(teacherUser.userId);
    }
    expect(sqlClasses[0].ClassName).toContain('(Nâng cao)');

    await page.goto('/teacher/classes');
    await expect(page.locator('.class-card').filter({ hasText: classCodes[0] })).toBeVisible();
    await shot(page, 'scenario-a-multi-classes');
    scenarioEvidence.scenarioA = { classCodes, createdClasses, sqlClasses };

    // ==========================================
    // SCENARIO B: Many-to-Many Student Enrollments
    // ==========================================
    console.log('[SCENARIO B] Enrolling students in many-to-many relationship...');
    const s1Email = qa.accounts.student.email;
    const s2Email = qa.accounts.outsider.email;
    const classA1 = createdClasses[0].classId;
    const classA2 = createdClasses[1].classId;
    const classB1 = createdClasses[2].classId;

    // S1 -> A1 & B1
    const r1 = await mutate(page, `/teacher/classes/${classA1}/enrollments`, 'PUT', { email: s1Email, isActive: true });
    expect(r1.status()).toBe(200);
    const r2 = await mutate(page, `/teacher/classes/${classB1}/enrollments`, 'PUT', { email: s1Email, isActive: true });
    expect(r2.status()).toBe(200);

    // S2 -> A2 & B1
    const r3 = await mutate(page, `/teacher/classes/${classA2}/enrollments`, 'PUT', { email: s2Email, isActive: true });
    expect(r3.status()).toBe(200);
    const r4 = await mutate(page, `/teacher/classes/${classB1}/enrollments`, 'PUT', { email: s2Email, isActive: true });
    expect(r4.status()).toBe(200);

    // Duplicate enrollment check: re-enrolling S1 in A1
    const dupRes = await mutate(page, `/teacher/classes/${classA1}/enrollments`, 'PUT', { email: s1Email, isActive: true });
    expect([200, 409]).toContain(dupRes.status());

    // Toggle S2 active status in A2 to inactive then active
    const toggleInactive = await mutate(page, `/teacher/classes/${classA2}/enrollments`, 'PUT', { email: s2Email, isActive: false });
    expect(toggleInactive.status()).toBe(200);
    const toggleActive = await mutate(page, `/teacher/classes/${classA2}/enrollments`, 'PUT', { email: s2Email, isActive: true });
    expect(toggleActive.status()).toBe(200);

    // Verify S1 view
    const s1Context = await browser.newContext({ locale: 'vi-VN', timezoneId: 'Asia/Bangkok' });
    const s1Page = await s1Context.newPage();
    await login(s1Page, 'student');
    const s1Classes = await (await s1Page.request.get('/api/student/classes')).json();
    const s1ClassCodes = s1Classes.map((c: any) => c.classCode);
    expect(s1ClassCodes).toContain(classCodes[0]); // A1
    expect(s1ClassCodes).toContain(classCodes[2]); // B1
    expect(s1ClassCodes).not.toContain(classCodes[1]); // NOT A2
    await s1Page.goto('/classes');
    await expect(s1Page.locator('.class-card').filter({ hasText: classCodes[0] })).toBeVisible();
    await expect(s1Page.locator('.class-card').filter({ hasText: classCodes[2] })).toBeVisible();
    await shot(s1Page, 'scenario-b-student1-classes');

    // Verify S2 view
    const s2Context = await browser.newContext({ locale: 'vi-VN', timezoneId: 'Asia/Bangkok' });
    const s2Page = await s2Context.newPage();
    await login(s2Page, 'outsider');
    const s2Classes = await (await s2Page.request.get('/api/student/classes')).json();
    const s2ClassCodes = s2Classes.map((c: any) => c.classCode);
    expect(s2ClassCodes).toContain(classCodes[1]); // A2
    expect(s2ClassCodes).toContain(classCodes[2]); // B1
    expect(s2ClassCodes).not.toContain(classCodes[0]); // NOT A1
    await s2Page.goto('/classes');
    await expect(s2Page.locator('.class-card').filter({ hasText: classCodes[1] })).toBeVisible();
    await expect(s2Page.locator('.class-card').filter({ hasText: classCodes[2] })).toBeVisible();
    await shot(s2Page, 'scenario-b-student2-classes');

    scenarioEvidence.scenarioB = { s1ClassCodes, s2ClassCodes };

    // ==========================================
    // SCENARIO C: Shared Question Bank & Drafts
    // ==========================================
    console.log('[SCENARIO C] Creating draft and complete questions in question bank...');
    const questionsCreated: any[] = [];

    // Q1..Q5: complete with 4 options and 1 correct answer
    for (let i = 1; i <= 5; i++) {
      const res = await mutate(page, '/teacher/questions', 'POST', {
        questionText: `Coverage Question Q${i} [${tag}]: Choose correct syntax for statement ${i}?`,
        category: 'Grammar',
        difficulty: i <= 2 ? 'Easy' : i <= 4 ? 'Medium' : 'Hard',
        options: [
          { optionCode: 'A', optionText: `Correct Option A for Q${i}`, isCorrect: true },
          { optionCode: 'B', optionText: `Incorrect Option B for Q${i}`, isCorrect: false },
          { optionCode: 'C', optionText: `Incorrect Option C for Q${i}`, isCorrect: false },
          { optionCode: 'D', optionText: `Incorrect Option D for Q${i}`, isCorrect: false },
        ],
      });
      expect(res.status()).toBe(201);
      questionsCreated.push(await res.json());
    }

    // Q6..Q8: draft questions with fewer than 4 options
    for (let i = 6; i <= 8; i++) {
      const res = await mutate(page, '/teacher/questions', 'POST', {
        questionText: `Draft Question Q${i} [${tag}]: Work in progress question with partial options`,
        category: 'Vocabulary',
        difficulty: 'Easy',
        options: [
          { optionCode: 'A', optionText: `Draft Option A for Q${i}`, isCorrect: true },
          { optionCode: 'B', optionText: `Draft Option B for Q${i}`, isCorrect: false },
        ],
      });
      expect(res.status()).toBe(201);
      questionsCreated.push(await res.json());
    }

    // Verify all 8 exist in question bank
    const bank = await (await page.request.get('/api/teacher/questions')).json();
    for (const q of questionsCreated) {
      expect(bank.some((b: any) => b.questionId === q.questionId)).toBe(true);
    }
    await page.goto('/teacher/questions');
    await shot(page, 'scenario-c-question-bank');
    scenarioEvidence.scenarioC = { questionsCreatedCount: questionsCreated.length };

    // ==========================================
    // SCENARIO D: Exam Authoring, Publish Rules & Immutability
    // ==========================================
    console.log('[SCENARIO D] Authoring exam, checking publish guard and immutability...');
    const examRes = await mutate(page, '/teacher/exams', 'POST', {
      examCode: `EX-${tag}`,
      title: `Final ERD Comprehensive Exam ${tag}`,
      durationMinutes: 10,
    });
    expect(examRes.status()).toBe(201);
    const { examId } = await examRes.json();

    // Add only 4 questions (Q1..Q4)
    const add4 = await mutate(page, `/teacher/exams/${examId}/questions`, 'PUT', {
      questions: questionsCreated.slice(0, 4).map((q, idx) => ({
        questionId: q.questionId,
        questionOrder: idx + 1,
        points: 2,
      })),
    });
    expect(add4.status()).toBe(200);

    // Attempt publication -> should FAIL because < 5 questions
    const pubFail = await mutate(page, `/teacher/exams/${examId}/publish`, 'POST');
    expect(pubFail.status()).toBe(409);
    const pubFailJson = await pubFail.json();
    expect(pubFailJson.code).toBe('SQL_51102'); // usp_PublishExam: Đề cần ít nhất 5 câu

    // Add Q5 (now 5 questions)
    const add5 = await mutate(page, `/teacher/exams/${examId}/questions`, 'PUT', {
      questions: questionsCreated.slice(0, 5).map((q, idx) => ({
        questionId: q.questionId,
        questionOrder: idx + 1,
        points: idx + 1, // Points: 1, 2, 3, 4, 5 (Total = 15)
      })),
    });
    expect(add5.status()).toBe(200);

    // Publish exam -> should SUCCEED
    const pubSuccess = await mutate(page, `/teacher/exams/${examId}/publish`, 'POST');
    expect(pubSuccess.status()).toBe(200);

    // Verify immutability: trigger blocks modification of published question
    const q1 = questionsCreated[0];
    const mutateOptionFail = await mutate(page, `/teacher/questions/${q1.questionId}`, 'PUT', {
      questionText: 'Attempting illegal change to published question',
      category: 'Grammar',
      difficulty: 'Easy',
      options: [
        { optionCode: 'A', optionText: 'Hacked A', isCorrect: false },
        { optionCode: 'B', optionText: 'Hacked B', isCorrect: true },
        { optionCode: 'C', optionText: 'Hacked C', isCorrect: false },
        { optionCode: 'D', optionText: 'Hacked D', isCorrect: false },
      ],
    });
    expect(mutateOptionFail.status()).toBe(409); // Protected by trigger trg_Questions_Guard or trg_Options_Freeze
    const failJson = await mutateOptionFail.json();
    expect(['SQL_51207', 'SQL_51208']).toContain(failJson.code);

    await page.goto('/teacher/exams');
    await shot(page, 'scenario-d-published-exam');
    scenarioEvidence.scenarioD = { examId, pubFailCode: pubFailJson.code, published: true };

    // ==========================================
    // SCENARIO E: One Exam Assigned to Multiple Classes
    // ==========================================
    console.log('[SCENARIO E] Assigning exam E1 to multiple classes (A1 and B1)...');
    const now = Date.now();
    const w1Open = new Date(now - 60000).toISOString();
    const w1Close = new Date(now + 3600000).toISOString(); // 1 hour
    const w2Open = new Date(now - 60000).toISOString();
    const w2Close = new Date(now + 7200000).toISOString(); // 2 hours

    // Assign to A1
    const assignA1 = await mutate(page, `/teacher/exams/${examId}/assignments`, 'PUT', {
      classId: classA1,
      opensAt: w1Open,
      closesAt: w1Close,
      maxAttempts: 2,
      isActive: true,
    });
    expect(assignA1.status()).toBe(200);

    // Assign to B1
    const assignB1 = await mutate(page, `/teacher/exams/${examId}/assignments`, 'PUT', {
      classId: classB1,
      opensAt: w2Open,
      closesAt: w2Close,
      maxAttempts: 2,
      isActive: true,
    });
    expect(assignB1.status()).toBe(200);

    // SQL verification of composite key (ExamId, ClassId)
    const sqlAssignments = sql(
      `SELECT ExamId, ClassId, MaxAttempts, IsActive, AuthorizedBy FROM dbo.ExamAssignments WHERE ExamId=${examId} ORDER BY ClassId`
    );
    expect(sqlAssignments.length).toBe(2);
    expect(sqlAssignments[0].ClassId).toBe(classA1);
    expect(sqlAssignments[1].ClassId).toBe(classB1);
    expect(sqlAssignments[0].AuthorizedBy).toBe(teacherUser.userId);

    // Student 1 (in both A1 and B1) sees both assignments
    const s1Exams = await (await s1Page.request.get('/api/student/exams')).json();
    const s1ExamAssignments = s1Exams.items ? s1Exams.items.filter((e: any) => e.examId === examId) : s1Exams.filter((e: any) => e.examId === examId);
    expect(s1ExamAssignments.length).toBe(2);
    expect(s1ExamAssignments.some((e: any) => e.classId === classA1)).toBe(true);
    expect(s1ExamAssignments.some((e: any) => e.classId === classB1)).toBe(true);

    // Student 2 (in A2 and B1) sees only B1 assignment
    const s2Exams = await (await s2Page.request.get('/api/student/exams')).json();
    const s2ExamAssignments = s2Exams.items ? s2Exams.items.filter((e: any) => e.examId === examId) : s2Exams.filter((e: any) => e.examId === examId);
    expect(s2ExamAssignments.length).toBe(1);
    expect(s2ExamAssignments[0].classId).toBe(classB1);

    scenarioEvidence.scenarioE = { sqlAssignments, s1AssignmentCount: s1ExamAssignments.length, s2AssignmentCount: s2ExamAssignments.length };

    // ==========================================
    // SCENARIO F: Exam Attempt, Persistence, and Scoring
    // ==========================================
    console.log('[SCENARIO F] S1 taking exam in A1, verifying persistence and scoring...');
    await s1Page.goto(`/exams/${examId}/${classA1}`);
    await s1Page.getByRole('button', { name: 'Bắt đầu làm bài' }).click();
    await s1Page.getByRole('button', { name: 'Tôi đã sẵn sàng' }).click();
    await s1Page.waitForURL(/\/attempts\/\d+$/);
    const attemptId = Number(s1Page.url().split('/').at(-1));

    // Answer Q1 with 'A' (correct, 1 pt), Q2 with 'A' (correct, 2 pts), Q3 with 'B' (wrong, 0/3 pts)
    const q1Id = questionsCreated[0].questionId;
    const q2Id = questionsCreated[1].questionId;
    const q3Id = questionsCreated[2].questionId;

    const ans1 = await mutate(s1Page, `/student/attempts/${attemptId}/answers/${q1Id}`, 'PUT', { optionCode: 'A' });
    expect(ans1.status()).toBe(200);
    const ans2 = await mutate(s1Page, `/student/attempts/${attemptId}/answers/${q2Id}`, 'PUT', { optionCode: 'A' });
    expect(ans2.status()).toBe(200);
    const ans3 = await mutate(s1Page, `/student/attempts/${attemptId}/answers/${q3Id}`, 'PUT', { optionCode: 'B' });
    expect(ans3.status()).toBe(200);

    // Refresh page and verify answers persist
    await s1Page.reload();
    await expect(s1Page.locator('.answer-option input[value="A"]').first()).toBeChecked();
    await shot(s1Page, 'scenario-f-attempt-answers-persisted');

    // Submit exam
    const submitRes = await mutate(s1Page, `/student/attempts/${attemptId}/submit`, 'POST');
    expect(submitRes.status()).toBe(200);
    const submitData = await submitRes.json();
    // Q1: 1pt, Q2: 2pts, Q3: 0pts, Q4: 0pts, Q5: 0pts => Earned = 3 pts out of 15 max => 20.00%
    expect(submitData.earnedPoints).toBe(3);

    // Independent SQL check
    const sqlAttempt = sql(`SELECT AttemptId, Status, EarnedPoints, SubmittedAt FROM dbo.ExamAttempts WHERE AttemptId=${attemptId}`)[0];
    expect(sqlAttempt.Status).toBe('Submitted');
    expect(sqlAttempt.EarnedPoints).toBe(3);

    const sqlScoreView = sql(`SELECT AttemptId, EarnedPoints, MaxPoints, ScorePercent FROM dbo.vw_StudentExamResults WHERE AttemptId=${attemptId}`)[0];
    expect(sqlScoreView.EarnedPoints).toBe(3);
    expect(sqlScoreView.MaxPoints).toBe(15);
    expect(sqlScoreView.ScorePercent).toBe(20.0);

    // S1 also takes exam under B1 independently
    const s1AttemptB1 = await mutate(s1Page, '/student/attempts', 'POST', { examId, classId: classB1 });
    expect(s1AttemptB1.status()).toBe(201);
    const attemptB1Id = (await s1AttemptB1.json()).attemptId;
    expect(attemptB1Id).toBeGreaterThan(0);
    expect(attemptB1Id).not.toBe(attemptId);

    scenarioEvidence.scenarioF = { attemptId, attemptB1Id, sqlAttempt, sqlScoreView };

    // ==========================================
    // SCENARIO G: Teacher Results Reporting with Filters
    // ==========================================
    console.log('[SCENARIO G] Teacher inspecting results with filters...');
    await page.goto('/teacher/results');

    // Query teacher results API with classId filter
    const resA1 = await (await page.request.get(`/api/teacher/results?classId=${classA1}`)).json();
    expect(resA1.some((r: any) => r.attemptId === attemptId)).toBe(true);

    // Query teacher results API with status filter
    const resSubmitted = await (await page.request.get(`/api/teacher/results?examId=${examId}&status=Submitted`)).json();
    expect(resSubmitted.some((r: any) => r.attemptId === attemptId)).toBe(true);
    expect(resSubmitted.every((r: any) => r.status === 'Submitted')).toBe(true);

    const resInProgress = await (await page.request.get(`/api/teacher/results?examId=${examId}&status=InProgress`)).json();
    expect(resInProgress.some((r: any) => r.attemptId === attemptB1Id)).toBe(true);

    await shot(page, 'scenario-g-teacher-results');
    scenarioEvidence.scenarioG = {
      filteredA1Count: resA1.length,
      submittedCount: resSubmitted.length,
      inProgressCount: resInProgress.length,
    };

    // ==========================================
    // SCENARIO H: Regression Verification
    // ==========================================
    console.log('[SCENARIO H] Verifying regression integrity of original demo data...');
    const originalDemoClass = teacherClasses.find((c: any) => c.classCode === 'DEMO-ENG-01');
    expect(originalDemoClass).toBeTruthy();

    const originalResults = sql("SELECT COUNT(*) AS Cnt FROM dbo.ExamAttempts WHERE ClassId IN (SELECT ClassId FROM dbo.Classes WHERE ClassCode='DEMO-ENG-01')")[0].Cnt;
    expect(originalResults).toBeGreaterThan(0);

    scenarioEvidence.scenarioH = { demoClassPreserved: true, originalResultsCount: originalResults };

    // Write complete scenario evidence
    write('scenarios-coverage-evidence', scenarioEvidence);
    console.log('ALL SCENARIOS A THROUGH H PASSED WITH FLYING COLORS!');

    await s1Context.close();
    await s2Context.close();
  });
});
