import { test, expect, Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const qa = JSON.parse(fs.readFileSync(path.resolve('../.local/demo/qa-credentials.json'), 'utf8'));
const out = path.resolve('../evidence/production/lifecycle');
fs.mkdirSync(out, { recursive: true });

function sql(query: string) {
  return JSON.parse(
    execFileSync('powershell.exe', ['-NoProfile', '-File', path.resolve('../scripts/demo-query.ps1'), '-QueryBase64', Buffer.from(query).toString('base64')], { encoding: 'utf8' }).trim()
  );
}

async function shot(page: Page, name: string) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(out, name + '.png'), fullPage: true, animations: 'disabled' });
}

async function login(page: Page, account: { username: string; password: string }) {
  await page.goto('/login');
  await page.getByRole('link', { name: /Tiếp tục đăng nhập/ }).click();
  await page.locator('#username').waitFor({ state: 'visible', timeout: 60000 });
  await page.locator('#username').fill(account.username);
  await page.locator('#password').fill(account.password);
  await page.locator('#kc-login').click();
  await page.waitForURL(/\/(dashboard|teacher)$/, { timeout: 90000 });
}

async function mutate(page: Page, url: string, method: string, data?: unknown) {
  const token = await (await page.request.get('/api/auth/csrf')).json();
  return page.request.fetch('/api' + url, { method, headers: { [token.headerName]: token.token }, data });
}

test('Full exam lifecycle on production: publish, assign, attempt, save, reload, submit, score', async ({ page, browser }) => {
  test.setTimeout(300000);
  await login(page, qa.accounts.teacher);
  const classes = await (await page.request.get('/api/teacher/classes')).json();
  const clazz = classes.find((c: { classCode: string }) => c.classCode === 'DEMO-ENG-01');
  expect(clazz).toBeTruthy();

  // Only questions that satisfy the publish rule (4 options, exactly 1 correct) can be published.
  const bank = await (await page.request.get('/api/teacher/questions')).json();
  const valid = bank.filter((q: { questionId: number }) => {
    const options = sql(`SELECT COUNT(*) AS Options, SUM(CONVERT(int,IsCorrect)) AS Correct FROM dbo.AnswerOptions WHERE QuestionId=${q.questionId}`)[0];
    return options.Options === 4 && options.Correct === 1;
  }).slice(0, 5);
  expect(valid.length).toBe(5);

  const examCode = 'LIFE-' + Date.now().toString().slice(-8);
  const created = await mutate(page, '/teacher/exams', 'POST', { examCode, title: 'Vòng đời đề thi kiểm thử', durationMinutes: 30 });
  expect(created.status()).toBe(201);
  const { examId } = await created.json();

  const structure = await mutate(page, `/teacher/exams/${examId}/questions`, 'PUT', {
    questions: valid.map((q: { questionId: number }, i: number) => ({ questionId: q.questionId, questionOrder: i + 1, points: 1 })),
  });
  expect(structure.status()).toBe(200);

  const published = await mutate(page, `/teacher/exams/${examId}/publish`, 'POST');
  expect(published.status()).toBe(200);

  const opensAt = new Date(Date.now() - 60000).toISOString();
  const closesAt = new Date(Date.now() + 3600000).toISOString();
  const assigned = await mutate(page, `/teacher/exams/${examId}/assignments`, 'PUT', {
    classId: clazz.classId, opensAt, closesAt, isActive: true, maxAttempts: 1,
  });
  expect(assigned.status()).toBe(200);
  await page.goto('/teacher/exams/' + examId);
  await shot(page, '01-teacher-exam-published');

  const studentContext = await browser.newContext({ baseURL: 'https://english-exam-coursework.vercel.app', locale: 'vi-VN', timezoneId: 'Asia/Bangkok' });
  const student = await studentContext.newPage();
  try {
    await login(student, qa.accounts.student);
    await student.goto(`/exams/${examId}/${clazz.classId}`);
    await shot(student, '02-student-exam-detail');
    const listedRaw = await (await student.request.get('/api/student/exams')).json();
    const listed = Array.isArray(listedRaw) ? listedRaw : listedRaw.items ?? [];
    expect(listed.some((e: { examId: number }) => e.examId === examId)).toBe(true);

    await student.getByRole('button', { name: 'Bắt đầu làm bài' }).click();
    await student.getByRole('button', { name: 'Tôi đã sẵn sàng' }).click();
    await student.waitForURL(/\/attempts\/\d+$/, { timeout: 60000 });
    const attemptId = Number(student.url().split('/').at(-1));
    expect(attemptId).toBeGreaterThan(0);

    await student.locator('.answer-option input[value="A"]').first().check();
    await expect(student.getByText('Đã lưu đáp án A', { exact: true })).toBeVisible({ timeout: 30000 });
    await shot(student, '03-student-answer-saved');

    await student.reload();
    await expect(student.locator('.answer-option input[value="A"]').first()).toBeChecked({ timeout: 60000 });
    await shot(student, '04-student-answer-after-reload');

    const savedRows = sql(`SELECT QuestionId, SelectedOptionCode FROM dbo.StudentAnswers WHERE AttemptId=${attemptId}`);
    expect(savedRows.length).toBeGreaterThan(0);

    await student.getByRole('button', { name: 'Nộp bài', exact: true }).click();
    await student.getByRole('button', { name: 'Xác nhận nộp bài' }).click();
    await student.waitForURL('/results/' + attemptId, { timeout: 60000 });
    await shot(student, '05-student-result');

    const attempt = sql(`SELECT Status, EarnedPoints, SubmittedAt FROM dbo.ExamAttempts WHERE AttemptId=${attemptId}`)[0];
    expect(attempt.Status).toBe('Submitted');
    expect(attempt.SubmittedAt).toBeTruthy();
    const totalPoints = sql(`SELECT SUM(Points) AS Total FROM dbo.ExamQuestions WHERE ExamId=${examId}`)[0].Total;
    expect(totalPoints).toBe(5);

    await page.goto('/teacher/results');
    await expect(page.getByRole('heading', { name: /Kết quả/ }).first()).toBeVisible({ timeout: 60000 });
    await shot(page, '06-teacher-results');

    const results = await (await page.request.get(`/api/teacher/results?examId=${examId}&classId=${clazz.classId}`)).json();
    const row = (Array.isArray(results) ? results : results.items ?? []).find((r: { attemptId: number }) => r.attemptId === attemptId);
    expect(row).toBeTruthy();

    fs.writeFileSync(path.join(out, 'lifecycle.json'), JSON.stringify({
      examId, examCode, classCode: clazz.classCode, classId: clazz.classId,
      questionIds: valid.map((q: { questionId: number }) => q.questionId),
      attemptId, savedAnswerRows: savedRows.length,
      attempt: attempt, teacherResultVisible: Boolean(row), published: true, assigned: true,
    }, null, 2));
  } finally {
    await studentContext.close();
  }
});
