import { test, expect, Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const qa = JSON.parse(fs.readFileSync(path.resolve('../.local/demo/qa-credentials.json'), 'utf8'));
const out = path.resolve('../evidence/production/real-ui');
fs.mkdirSync(out, { recursive: true });

async function shot(page: Page, name: string) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      document.getAnimations().filter(a => a.effect?.getTiming().iterations !== Infinity).map(a => a.finished.catch(() => {}))
    );
  });
  await page.screenshot({ path: path.join(out, name + '.png'), fullPage: true, animations: 'disabled' });
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

test('Real UI Teacher Multi-Class Creation and Verification on Production', async ({ page }) => {
  test.setTimeout(180000);
  const tag = Date.now().toString().slice(-6);
  const classCode1 = `LIVE-A1-${tag}`;
  const className1 = `Lớp Trực Tuyến Live A1 [${tag}]`;
  const classCode2 = `LIVE-B1-${tag}`;
  const className2 = `Lớp Trực Tuyến Live B1 [${tag}]`;

  console.log(`[REAL UI] Step 1: Navigating to public website login...`);
  await page.goto('/login');
  await page.getByRole('link', { name: 'Tiếp tục đăng nhập' }).click();

  console.log(`[REAL UI] Step 2: Signing in via Keycloak SSO as teacher...`);
  await expect(page.locator('#username')).toBeVisible({ timeout: 15000 });
  await page.locator('#username').fill('teacher');
  await page.locator('#password').fill(qa.accounts.teacher.password);
  await page.locator('#kc-login').click();

  await page.waitForURL(/\/(dashboard|teacher)$/, { timeout: 30000 });
  await expect(page.getByRole('heading', { name: /Chào / })).toBeVisible({ timeout: 15000 });

  console.log(`[REAL UI] Step 3: Navigating to /teacher/classes...`);
  await page.goto('/teacher/classes');
  await expect(page.getByRole('heading', { name: 'Lớp phụ trách' })).toBeVisible();

  // Verify "Tạo lớp" button in page header is visible
  const createClassBtn = page.locator('header button:has-text("Tạo lớp"), .page-heading button:has-text("Tạo lớp")');
  await expect(createClassBtn).toBeVisible({ timeout: 10000 });
  console.log(`[REAL UI] SUCCESS: "Tạo lớp" button is clearly visible!`);
  await shot(page, '01-teacher-classes-tao-lop-visible');

  // Create Class 1 through UI
  console.log(`[REAL UI] Step 4: Creating Class 1 (${classCode1}) via UI modal...`);
  await createClassBtn.click();
  await expect(page.getByRole('heading', { name: 'Tạo lớp học mới' })).toBeVisible({ timeout: 10000 });

  await page.locator('input[name="classCode"]').fill(classCode1);
  await page.locator('input[name="className"]').fill(className1);
  await page.locator('form.form-stack button:has-text("Tạo lớp")').click();

  // Wait for modal to close and card to appear
  await expect(page.locator('.class-card').filter({ hasText: classCode1 })).toBeVisible({ timeout: 15000 });
  console.log(`[REAL UI] Class 1 created and visible on UI!`);

  // Create Class 2 through UI
  console.log(`[REAL UI] Step 5: Creating Class 2 (${classCode2}) via UI modal...`);
  await createClassBtn.click();
  await expect(page.getByRole('heading', { name: 'Tạo lớp học mới' })).toBeVisible({ timeout: 10000 });

  await page.locator('input[name="classCode"]').fill(classCode2);
  await page.locator('input[name="className"]').fill(className2);
  await page.locator('form.form-stack button:has-text("Tạo lớp")').click();

  // Wait for modal to close and card to appear
  await expect(page.locator('.class-card').filter({ hasText: classCode2 })).toBeVisible({ timeout: 15000 });
  console.log(`[REAL UI] Class 2 created and visible on UI!`);

  // Reload page and verify persistence in DOM
  console.log(`[REAL UI] Step 6: Reloading browser page (F5) to verify persistence in UI...`);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Lớp phụ trách' })).toBeVisible({ timeout: 15000 });
  await expect(page.locator('.class-card').filter({ hasText: classCode1 })).toBeVisible({ timeout: 10000 });
  await expect(page.locator('.class-card').filter({ hasText: classCode2 })).toBeVisible({ timeout: 10000 });
  await shot(page, '02-classes-persisted-after-reload');
  console.log(`[REAL UI] Both classes persisted in UI after reload!`);

  // Verify in SQL Server
  console.log(`[REAL UI] Step 7: Verifying both classes in SQL Server (EnglishExamDB_Demo)...`);
  const sqlResults = sql(
    `SELECT ClassId, ClassCode, ClassName, TeacherId, IsActive FROM dbo.Classes WHERE ClassCode IN ('${classCode1}', '${classCode2}') ORDER BY ClassCode`
  );
  expect(sqlResults.length).toBe(2);
  expect(sqlResults[0].ClassCode).toBe(classCode1);
  expect(sqlResults[0].ClassName).toBe(className1);
  expect(sqlResults[0].TeacherId).toBe(1); // Minh Nguyễn (approved teacher)
  expect(sqlResults[0].IsActive).toBe(true);

  expect(sqlResults[1].ClassCode).toBe(classCode2);
  expect(sqlResults[1].ClassName).toBe(className2);
  expect(sqlResults[1].TeacherId).toBe(1);
  expect(sqlResults[1].IsActive).toBe(true);
  console.log(`[REAL UI] SQL Server verification PASSED: Both classes owned by TeacherId=1!`);

  // Test other upgraded workflows:
  // Workflow 8: Class Details Modal with dual tabs ("Học viên ghi danh" & "Đề thi đã giao")
  console.log(`[REAL UI] Step 8: Inspecting Class Details modal tabs...`);
  const classCard1 = page.locator('.class-card').filter({ hasText: classCode1 });
  await classCard1.getByRole('button', { name: 'Danh sách học viên' }).click();
  await expect(page.getByRole('button', { name: 'Học viên ghi danh' })).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole('button', { name: 'Đề thi đã giao' })).toBeVisible({ timeout: 10000 });
  await shot(page, '03-class-details-modal-tabs');
  await page.getByRole('button', { name: 'Đóng', exact: true }).click();

  // Workflow 9: Question Bank with Draft support & lock indicators
  console.log(`[REAL UI] Step 9: Navigating to /teacher/questions...`);
  await page.goto('/teacher/questions');
  await expect(page.getByRole('heading', { name: 'Ngân hàng câu hỏi' })).toBeVisible({ timeout: 15000 });
  await shot(page, '04-question-bank-ui');

  // Workflow 10: Teacher Results with Filters
  console.log(`[REAL UI] Step 10: Navigating to /teacher/results with filter controls...`);
  await page.goto('/teacher/results');
  await expect(page.getByRole('heading', { name: 'Kết quả học viên' })).toBeVisible({ timeout: 15000 });
  await expect(page.getByLabel('Lọc theo lớp')).toBeVisible({ timeout: 10000 });
  await expect(page.getByLabel('Lọc theo bài thi')).toBeVisible({ timeout: 10000 });
  await expect(page.getByLabel('Trạng thái')).toBeVisible({ timeout: 10000 });
  await shot(page, '05-teacher-results-filters-ui');

  // Save evidence summary
  fs.writeFileSync(
    path.join(out, 'real-ui-evidence.json'),
    JSON.stringify(
      {
        verifiedAt: new Date().toISOString(),
        publicUrl: 'https://english-exam-coursework.vercel.app',
        deploymentId: 'dpl_2rjiZxJ2xQQRSkqEFjPpr8Zb1HBN',
        classCode1,
        classCode2,
        sqlResults,
        uiVerified: true,
      },
      null,
      2
    )
  );
  console.log(`[REAL UI] ALL REAL UI WORKFLOWS VERIFIED SUCCESSFULLY ON PRODUCTION!`);
});
