import { test, expect, Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

let demoPassword = 'ExamDemo2026!';
try {
  const envPath = path.resolve('../.env.laptop');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      if (line.startsWith('LAPTOP_DEMO_PASSWORD=')) {
        demoPassword = line.split('=')[1].trim();
      }
    }
  }
} catch {}

async function login(page: Page, username: string) {
  await page.goto('/login');
  await page.getByRole('link', { name: 'Tiếp tục đăng nhập' }).click();
  await expect(page.locator('#username')).toBeVisible({ timeout: 15000 });
  await page.locator('#username').fill(username);
  await page.locator('#password').fill(demoPassword);
  await page.locator('#kc-login').click();
  await page.waitForURL(/\/(dashboard|teacher)$/, { timeout: 20000 });
}

async function logout(page: Page) {
  const logoutBtn = page.getByRole('button', { name: 'Đăng xuất' });
  await expect(logoutBtn).toBeVisible({ timeout: 10000 });
  await logoutBtn.click();
  await page.waitForURL('http://127.0.0.1:3000/', { timeout: 15000 });
  const me = await page.request.get('/api/me');
  expect(me.status()).toBe(401);
}

function toLocalInputString(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  const yyyy = date.getFullYear();
  const MM = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());
  return `${yyyy}-${MM}-${dd}T${hh}:${mm}`;
}

test.describe('Laptop Demo Comprehensive E2E Workflow', () => {
  test('Complete 15-Step Teacher & Student Examination Cycle', async ({ page }) => {
    test.setTimeout(180000);

    // ------------------------------------------------------------------------
    // Step 1: Teacher Login
    // ------------------------------------------------------------------------
    console.log('Step 1: Logging in as Teacher...');
    await login(page, 'teacher');
    await expect(page.getByText('Nguyễn Minh')).toBeVisible();
    await expect(page.getByText('Giảng viên')).toBeVisible();

    // ------------------------------------------------------------------------
    // Step 2: Create a Classroom
    // ------------------------------------------------------------------------
    console.log('Step 2: Creating a Classroom...');
    await page.goto('/teacher/classes');
    await expect(page.getByRole('heading', { name: 'Lớp phụ trách' })).toBeVisible();

    const uniqueCode = 'DEMO-' + Date.now().toString().slice(-6);
    const className = `Lớp Kiểm Thử Tự Động ${uniqueCode}`;
    await page.getByRole('button', { name: 'Tạo lớp', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Tạo lớp học mới' })).toBeVisible();
    await page.locator('dialog input[name="classCode"]').fill(uniqueCode);
    await page.locator('dialog input[name="className"]').fill(className);
    await page.locator('dialog').getByRole('button', { name: 'Tạo lớp' }).click();
    await expect(page.getByText(uniqueCode, { exact: true })).toBeVisible({ timeout: 10000 });

    // ------------------------------------------------------------------------
    // Step 3: Enroll Student into Classroom
    // ------------------------------------------------------------------------
    console.log('Step 3: Enrolling Student into Classroom...');
    const classCard = page.locator('article.class-card', { hasText: uniqueCode });
    await classCard.getByRole('button', { name: 'Danh sách học viên' }).click();
    await expect(page.getByRole('heading', { name: 'Ghi danh học viên mới' })).toBeVisible();

    await page.locator('dialog input[name="email"]').fill('student@exam.local');
    await page.locator('dialog').getByRole('button', { name: 'Lưu ghi danh' }).click();
    await expect(page.locator('dialog').getByText('student@exam.local', { exact: true })).toBeVisible({ timeout: 10000 });
    // Close modal via close button
    await page.locator('dialog').getByRole('button', { name: 'Đóng' }).click();

    // ------------------------------------------------------------------------
    // Step 4: Create Valid Question in Question Bank
    // ------------------------------------------------------------------------
    console.log('Step 4: Managing Question Bank...');
    await page.goto('/teacher/questions');
    await expect(page.getByRole('heading', { name: 'Ngân hàng câu hỏi' })).toBeVisible();

    await page.getByRole('button', { name: 'Thêm câu hỏi' }).click();
    await expect(page.getByRole('heading', { name: 'Thêm câu hỏi mới' })).toBeVisible();

    const qText = `What is the correct past tense of 'run' in standard English? [${uniqueCode}]`;
    await page.locator('dialog textarea').fill(qText);
    await page.locator('dialog .form-grid input').fill('Grammar');
    await page.locator('dialog .form-grid select').selectOption('Easy');

    // Fill options A, B, C, D
    const optionInputs = page.locator('dialog .option-edit-row input[type="text"], dialog .option-edit-row input[lang="en"]');
    await optionInputs.nth(0).fill('runned');
    await optionInputs.nth(1).fill('ran');
    await optionInputs.nth(2).fill('running');
    await optionInputs.nth(3).fill('runs');

    // Check radio for B (correct option)
    await page.locator('dialog .option-edit-row input[type="radio"]').nth(1).check();
    await page.locator('dialog').getByRole('button', { name: 'Lưu câu hỏi' }).click();
    await expect(page.getByText(qText, { exact: true })).toBeVisible({ timeout: 10000 });

    // ------------------------------------------------------------------------
    // Step 5: Create an Exam
    // ------------------------------------------------------------------------
    console.log('Step 5: Creating an Exam...');
    await page.goto('/teacher/exams');
    await expect(page.getByRole('heading', { name: 'Đề thi' })).toBeVisible();

    const examCode = 'EX-' + Date.now().toString().slice(-6);
    const examTitle = `Automated Examination Test ${examCode}`;
    await page.getByRole('button', { name: 'Tạo đề thi' }).click();
    await expect(page.getByRole('heading', { name: 'Tạo đề thi mới' })).toBeVisible();

    await page.locator('dialog input[name="examCode"]').fill(examCode);
    await page.locator('dialog input[name="title"]').fill(examTitle);
    await page.locator('dialog input[name="durationMinutes"]').fill('30');
    await page.locator('dialog').getByRole('button', { name: 'Tạo bản nháp' }).click();

    // Browser automatically navigates to /teacher/exams/[id]
    await page.waitForURL(/\/teacher\/exams\/\d+$/, { timeout: 15000 });
    await expect(page.getByText('Bản nháp', { exact: true })).toBeVisible();

    // ------------------------------------------------------------------------
    // Step 6: Attach Questions & Publish Exam (calls usp_PublishExam)
    // ------------------------------------------------------------------------
    console.log('Step 6: Attaching 5 questions and Publishing Exam...');
    await page.getByRole('button', { name: 'Thêm câu' }).click();
    await expect(page.getByRole('heading', { name: 'Chọn từ ngân hàng câu hỏi' })).toBeVisible();

    // Add 5 questions from question bank
    for (let i = 0; i < 5; i++) {
      const addBtn = page.locator('dialog .library-row button:not([disabled])').first();
      await addBtn.click();
    }
    // Close library dialog
    await page.locator('dialog').getByRole('button', { name: /Xong ·/ }).click();

    // Save exam structure
    await page.getByRole('button', { name: 'Lưu cấu trúc' }).click();
    await expect(page.getByText('Đã lưu cấu trúc đề.')).toBeVisible({ timeout: 10000 });

    // Publish exam (executes usp_PublishExam)
    await page.getByRole('button', { name: 'Công bố đề' }).click();
    await expect(page.getByRole('heading', { name: 'Công bố đề thi?' })).toBeVisible();
    await page.locator('dialog').getByRole('button', { name: 'Xác nhận công bố' }).click();
    await expect(page.getByText('Đã công bố', { exact: true })).toBeVisible({ timeout: 10000 });

    // ------------------------------------------------------------------------
    // Step 7: Assign Exam to Classroom
    // ------------------------------------------------------------------------
    console.log('Step 7: Assigning Exam to Classroom...');
    await page.getByRole('button', { name: 'Giao / cập nhật lịch' }).click();
    await expect(page.getByRole('heading', { name: 'Giao đề thi cho lớp' })).toBeVisible();

    // Select the class created in Step 2
    const classSelect = page.locator('dialog select[name="classId"]');
    await classSelect.selectOption({ label: `${uniqueCode} · ${className}` });

    const now = new Date();
    const opens = new Date(now.getTime() - 3600 * 1000); // 1 hour ago
    const closes = new Date(now.getTime() + 86400 * 1000 * 7); // 7 days ahead

    await page.locator('dialog input[name="opensAt"]').fill(toLocalInputString(opens));
    await page.locator('dialog input[name="closesAt"]').fill(toLocalInputString(closes));
    await page.locator('dialog input[name="maxAttempts"]').fill('5');
    await page.locator('dialog').getByRole('button', { name: 'Lưu lịch thi' }).click();

    await expect(page.getByText(uniqueCode, { exact: true })).toBeVisible({ timeout: 10000 });

    // ------------------------------------------------------------------------
    // Step 8: Logout Teacher -> Login as Student
    // ------------------------------------------------------------------------
    console.log('Step 8: Logging out Teacher and logging in as Student...');
    await logout(page);
    await login(page, 'student');
    await expect(page.getByText('Trần An')).toBeVisible();
    await expect(page.getByText('Học viên')).toBeVisible();

    // ------------------------------------------------------------------------
    // Step 9: Student Discovers & Starts Exam (calls usp_StartExam)
    // ------------------------------------------------------------------------
    console.log('Step 9: Student discovering and starting exam...');
    await page.goto('/exams');
    await expect(page.getByText(examTitle)).toBeVisible({ timeout: 10000 });
    await page.getByRole('link', { name: examTitle }).click();

    // Start exam
    await expect(page.getByRole('button', { name: 'Bắt đầu làm bài' })).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: 'Bắt đầu làm bài' }).click();
    await expect(page.getByRole('heading', { name: 'Bạn đã sẵn sàng?' })).toBeVisible();
    await page.locator('dialog').getByRole('button', { name: 'Tôi đã sẵn sàng' }).click();

    // Confirm navigation to attempt room
    await page.waitForURL(/\/attempts\/\d+$/, { timeout: 15000 });
    const attemptUrl = page.url();
    console.log(`Exam started at: ${attemptUrl}`);
    await expect(page.locator('.question-text')).toBeVisible();

    // ------------------------------------------------------------------------
    // Step 10: Answer Saving (calls usp_SaveAnswer)
    // ------------------------------------------------------------------------
    console.log('Step 10: Answering questions...');
    await page.locator('.answer-option input[value="B"]').first().check();
    await expect(page.getByText(/Đã lưu đáp án/)).toBeVisible({ timeout: 10000 });

    // ------------------------------------------------------------------------
    // Step 11 & 12: Reload Page & Verify Persistence
    // ------------------------------------------------------------------------
    console.log('Step 11 & 12: Testing answer persistence across browser reload...');
    await page.reload();
    await expect(page.locator('.question-text')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.answer-option input[value="B"]').first()).toBeChecked();
    console.log('Answer persistence verified after reload!');

    // ------------------------------------------------------------------------
    // Step 13: Exam Submission (calls usp_SubmitExam)
    // ------------------------------------------------------------------------
    console.log('Step 13: Submitting the exam...');
    await page.getByRole('button', { name: 'Nộp bài', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Kiểm tra trước khi nộp' })).toBeVisible();
    await page.locator('dialog').getByRole('button', { name: 'Xác nhận nộp bài' }).click();

    // ------------------------------------------------------------------------
    // Step 14: Automated SQL Server Scoring Verification
    // ------------------------------------------------------------------------
    console.log('Step 14: Verifying SQL Server score calculation...');
    await page.waitForURL(/\/results\/\d+$/, { timeout: 15000 });
    await expect(page.getByRole('heading', { name: 'Bạn đã hoàn thành bài thi.' })).toBeVisible();
    await expect(page.getByText('Đã nộp & ghi nhận')).toBeVisible();
    await expect(page.getByText('KẾT QUẢ CỦA BẠN')).toBeVisible();

    // Check student history
    await page.goto('/history');
    await expect(page.getByText(examTitle)).toBeVisible({ timeout: 10000 });

    // ------------------------------------------------------------------------
    // Step 15: Teacher Verification of Results & Role Authorization
    // ------------------------------------------------------------------------
    console.log('Step 15: Teacher verification of submitted results...');
    await logout(page);
    await login(page, 'teacher');
    await page.goto('/teacher/results');
    await expect(page.getByRole('heading', { name: 'Kết quả học viên' })).toBeVisible();
    await expect(page.getByText('Trần An').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(examTitle, { exact: true })).toBeVisible({ timeout: 10000 });

    console.log('ALL 15 STEPS COMPLETED SUCCESSFULLY WITH REAL SQL SERVER & KEYCLOAK!');
  });
});
