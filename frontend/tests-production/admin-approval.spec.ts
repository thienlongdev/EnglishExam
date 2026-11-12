import { test, expect, Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const qa = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../.local/demo/qa-credentials.json'), 'utf8'));
const out = path.resolve(__dirname, '../../evidence/production/admin');
fs.mkdirSync(out, { recursive: true });

function sql(query: string) {
  return JSON.parse(
    execFileSync(
      'powershell.exe',
      ['-NoProfile', '-File', path.resolve(__dirname, '../../scripts/demo-query.ps1'), '-QueryBase64', Buffer.from(query).toString('base64')],
      { encoding: 'utf8' }
    ).trim()
  );
}

async function shot(page: Page, name: string) {
  await page.screenshot({ path: path.join(out, name + '.png'), fullPage: false, animations: 'disabled' });
}

async function loginAs(page: Page, account: { username: string; password: string }) {
  await page.goto('/login');
  await page.getByRole('link', { name: /Tiếp tục đăng nhập/ }).click();
  await page.locator('#username').waitFor({ state: 'visible', timeout: 60000 });
  await page.locator('#username').fill(account.username);
  await page.locator('#password').fill(account.password);
  await page.locator('#kc-login').click();
  await page.waitForURL(/\/(dashboard|teacher|admin\/accounts)$/, { timeout: 90000 });
}

test.describe.configure({ mode: 'serial' });

test('ADM-01: Student account is forbidden from admin UI and admin APIs', async ({ page }) => {
  await loginAs(page, qa.accounts.student);
  
  // Try accessing admin UI directly
  await page.goto('/admin/accounts');
  await expect(page.getByText('Bạn cần quyền quản trị viên để truy cập trang này.')).toBeVisible();
  
  // Verify sidebar does not show admin links
  await expect(page.getByRole('link', { name: /Quản lý tài khoản/ })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /Quản trị hệ thống/ })).toHaveCount(0);
  
  // Direct API call from student session
  const apiRes = await page.request.get('/api/admin/accounts');
  expect(apiRes.status()).toBe(403);
  
  await shot(page, '01-student-forbidden');
});

test('ADM-02: Teacher account is forbidden from admin UI and admin APIs', async ({ page }) => {
  await loginAs(page, qa.accounts.teacher);
  
  // Try accessing admin UI directly
  await page.goto('/admin/accounts');
  await expect(page.getByText('Bạn cần quyền quản trị viên để truy cập trang này.')).toBeVisible();
  
  // Direct API calls from teacher session
  const listRes = await page.request.get('/api/admin/accounts');
  expect(listRes.status()).toBe(403);
  
  const csrf = await (await page.request.get('/api/auth/csrf')).json();
  const approveRes = await page.request.post('/api/admin/accounts/fake-id/approve', {
    headers: { [csrf.headerName]: csrf.token },
    data: { role: 'teacher' }
  });
  expect(approveRes.status()).toBe(403);
  
  await shot(page, '02-teacher-forbidden');
});

test('ADM-03: Authorized admin can view admin portal and account list', async ({ page }) => {
  await loginAs(page, qa.accounts.admin);
  
  await page.goto('/admin/accounts');
  await expect(page.getByRole('heading', { name: 'Quản lý tài khoản & Phê duyệt trực tuyến' })).toBeVisible();
  await expect(page.getByText('CỔNG QUẢN TRỊ VIÊN HỆ THỐNG')).toBeVisible();
  
  // Check stats
  await expect(page.getByText('Chờ phê duyệt', { exact: true })).toBeVisible();
  
  // Switch to "Tất cả" tab to see all accounts
  await page.getByRole('button', { name: /^Tất cả/ }).click();
  
  // Check table has rows
  const rows = page.locator('tbody tr');
  await expect(rows.first()).toBeVisible();
  expect(await rows.count()).toBeGreaterThan(0);
  
  // Check detail modal
  await page.getByRole('button', { name: 'Chi tiết' }).first().click();
  await expect(page.getByRole('heading', { name: 'Thông tin chi tiết tài khoản' })).toBeVisible();
  await expect(page.getByText('Xác thực & Danh tính (Keycloak)')).toBeVisible();
  await expect(page.getByText('Dữ liệu Học vụ (SQL Server)')).toBeVisible();
  
  await shot(page, '03-admin-portal-and-details');
  await page.getByRole('dialog').getByRole('button', { name: 'Đóng' }).last().click();
  await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click();
  await page.waitForURL(/\/$/);
});

test('ADM-04: End-to-end registration and remote admin approval as Teacher', async ({ page }) => {
  // 1. User self-registers on public Keycloak form
  const suffix = Date.now().toString().slice(-6);
  const username = `qa-teacher-${suffix}`;
  const email = `qa-teacher-${suffix}@englishexam.invalid`;
  const password = 'Qa!' + crypto.randomBytes(16).toString('base64url');
  
  await page.goto('/login');
  await page.getByRole('link', { name: 'Tiếp tục đăng nhập' }).click();
  await page.getByRole('link', { name: /^(Register|Đăng ký)$/, exact: true }).click();
  await page.locator('#username').fill(username);
  await page.locator('#email').fill(email);
  await page.locator('#firstName').fill('AutoTeacher');
  await page.locator('#lastName').fill('Nguyen');
  await page.locator('#password').fill(password);
  await page.locator('#password-confirm').fill(password);
  await page.locator('input[type=submit]').click();
  
  // Land on dashboard as pending
  await page.waitForURL(/\/dashboard$/);
  await expect(page.locator('.notice[role="alert"]')).toContainText('đang chờ quản trị viên');
  
  // Verify 0 rows in SQL dbo.Users before approval
  expect(sql(`SELECT COUNT(*) N FROM dbo.Users WHERE Email='${email}'`)[0].N).toBe(0);
  
  // Log out the pending user
  await page.getByRole('button', { name: 'Đăng xuất phiên hiện tại' }).click();
  await page.waitForURL(/\/$/);
  
  // 2. Admin logs in to approve from browser
  await loginAs(page, qa.accounts.admin);
  
  await page.goto('/admin/accounts');
  await page.getByRole('button', { name: /^Chờ duyệt/ }).click();
  
  // Search for the new registration
  const searchInput = page.getByPlaceholder('Tìm theo username, tên, email…');
  await searchInput.fill(username);
  await page.getByRole('button', { name: 'Tìm' }).click();
  
  // The row must appear
  const userRow = page.locator('tbody tr', { hasText: username });
  await expect(userRow).toBeVisible();
  await expect(userRow.getByText(email)).toBeVisible();
  
  // Click "Duyệt Giảng viên"
  await userRow.getByRole('button', { name: 'Duyệt Giảng viên' }).click();
  await expect(page.getByRole('heading', { name: 'Xác nhận phê duyệt Giảng viên' })).toBeVisible();
  
  await shot(page, '04-approve-teacher-confirm-modal');
  await page.getByRole('button', { name: 'Xác nhận thực hiện' }).click();
  
  // Verify success notice
  await expect(page.getByText('Đã phê duyệt thành công tài khoản')).toBeVisible();
  
  // 3. Verify SQL and Keycloak persistence independently
  const sqlUser = sql(`SELECT UserId, Email, FirstName, LastName, IsTeacher, IsStudent, IsActive FROM dbo.Users WHERE Email='${email}'`)[0];
  expect(sqlUser).toBeTruthy();
  expect(sqlUser.IsTeacher).toBe(true);
  expect(sqlUser.IsStudent).toBe(false);
  expect(sqlUser.IsActive).toBe(true);
  
  // Verify default demo classroom created for teacher
  const classes = sql(`SELECT ClassId, ClassCode, ClassName FROM dbo.Classes WHERE TeacherId=${sqlUser.UserId}`);
  expect(classes.length).toBeGreaterThan(0);
  expect(classes[0].ClassCode).toBe(`DEMO-T-${sqlUser.UserId}`);
  
  // Log out admin
  await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click();
  await page.waitForURL(/\/$/);
  
  // 4. Approved teacher logs in and uses teacher features
  await loginAs(page, { username, password });
  
  const me = await (await page.request.get('/api/me')).json();
  expect(me.email).toBe(email);
  expect(me.isTeacher).toBe(true);
  
  await page.goto('/teacher/classes');
  await expect(page.getByText('Teacher demo class')).toBeVisible();
  await shot(page, '04-teacher-workspace-ready');
  
  // Clean up session
  await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click();
  await page.waitForURL(/\/$/);
});

test('ADM-05: End-to-end registration and remote admin approval as Student', async ({ page }) => {
  const suffix = Date.now().toString().slice(-6);
  const username = `qa-student-${suffix}`;
  const email = `qa-student-${suffix}@englishexam.invalid`;
  const password = 'Qa!' + crypto.randomBytes(16).toString('base64url');
  
  // User self-registers
  await page.goto('/login');
  await page.getByRole('link', { name: 'Tiếp tục đăng nhập' }).click();
  await page.getByRole('link', { name: /^(Register|Đăng ký)$/, exact: true }).click();
  await page.locator('#username').fill(username);
  await page.locator('#email').fill(email);
  await page.locator('#firstName').fill('AutoStudent');
  await page.locator('#lastName').fill('Tran');
  await page.locator('#password').fill(password);
  await page.locator('#password-confirm').fill(password);
  await page.locator('input[type=submit]').click();
  await page.waitForURL(/\/dashboard$/);
  
  // Log out pending student
  await page.getByRole('button', { name: 'Đăng xuất phiên hiện tại' }).click();
  await page.waitForURL(/\/$/);
  
  // Admin logs in and approves as Student
  await loginAs(page, qa.accounts.admin);
  
  await page.goto('/admin/accounts');
  await page.getByRole('button', { name: /^Chờ duyệt/ }).click();
  await page.getByPlaceholder('Tìm theo username, tên, email…').fill(username);
  await page.getByRole('button', { name: 'Tìm' }).click();
  
  const userRow = page.locator('tbody tr', { hasText: username });
  await expect(userRow).toBeVisible();
  await userRow.getByRole('button', { name: 'Duyệt Học viên' }).click();
  await expect(page.getByRole('heading', { name: 'Xác nhận phê duyệt Học viên' })).toBeVisible();
  await page.getByRole('button', { name: 'Xác nhận thực hiện' }).click();
  await expect(page.getByText('Đã phê duyệt thành công tài khoản')).toBeVisible();
  
  // Verify SQL
  const sqlUser = sql(`SELECT UserId, Email, IsTeacher, IsStudent, IsActive FROM dbo.Users WHERE Email='${email}'`)[0];
  expect(sqlUser).toBeTruthy();
  expect(sqlUser.IsTeacher).toBe(false);
  expect(sqlUser.IsStudent).toBe(true);
  
  // Log out admin
  await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click();
  await page.waitForURL(/\/$/);
  
  // Approved student logs in
  await loginAs(page, { username, password });
  
  const me = await (await page.request.get('/api/me')).json();
  expect(me.email).toBe(email);
  expect(me.isStudent).toBe(true);
  expect(me.isTeacher).toBe(false);
  
  await shot(page, '05-student-workspace-ready');
  
  // Clean up session
  await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click();
  await page.waitForURL(/\/$/);
});

test('ADM-06: Account disabling and re-enabling controls', async ({ page }) => {
  // Use a student account to test disable / enable
  const email = 'student.demo@englishexam.invalid';
  
  await loginAs(page, qa.accounts.admin);
  await page.goto('/admin/accounts');
  
  // Find student in All tab
  await page.getByRole('button', { name: /^Tất cả/ }).click();
  await page.getByPlaceholder('Tìm theo username, tên, email…').fill('student');
  await page.getByRole('button', { name: 'Tìm' }).click();
  
  const studentRow = page.locator('tbody tr', { hasText: 'student.demo@englishexam.invalid' });
  await expect(studentRow).toBeVisible();
  
  // If active, test disable
  if (await studentRow.getByRole('button', { name: 'Khóa' }).isVisible()) {
    await studentRow.getByRole('button', { name: 'Khóa' }).click();
    await expect(page.getByRole('heading', { name: 'Xác nhận vô hiệu hóa tài khoản' })).toBeVisible();
    await page.getByRole('button', { name: 'Xác nhận thực hiện' }).click();
    await expect(page.getByText('Đã vô hiệu hóa tài khoản')).toBeVisible();
    
    // Check SQL IsActive = 0
    expect(sql(`SELECT IsActive FROM dbo.Users WHERE Email='${email}'`)[0].IsActive).toBe(false);
    
    // Re-enable to preserve student functionality
    await studentRow.getByRole('button', { name: 'Mở khóa' }).click();
    await expect(page.getByRole('heading', { name: 'Xác nhận kích hoạt lại tài khoản' })).toBeVisible();
    await page.getByRole('button', { name: 'Xác nhận thực hiện' }).click();
    await expect(page.getByText('Đã kích hoạt lại tài khoản')).toBeVisible();
    
    // Check SQL IsActive = 1
    expect(sql(`SELECT IsActive FROM dbo.Users WHERE Email='${email}'`)[0].IsActive).toBe(true);
  }
  
  await shot(page, '06-disable-enable-verified');
  
  // Clean up session
  await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click();
  await page.waitForURL(/\/$/);
});
