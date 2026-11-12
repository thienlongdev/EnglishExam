import { test, expect, Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const qa = JSON.parse(fs.readFileSync(path.resolve('../.local/demo/qa-credentials.json'), 'utf8'));
const out = path.resolve('../evidence/production/acceptance');
fs.mkdirSync(out, { recursive: true });

async function shot(page: Page, name: string) {
  await page.screenshot({ path: path.join(out, name + '.png'), fullPage: false, animations: 'disabled' });
}

async function loginAs(page: Page, account: { username: string; password: string }) {
  await page.goto('/login');
  await page.getByRole('link', { name: /Tiếp tục đăng nhập/ }).click();
  await page.locator('#username').waitFor({ state: 'visible', timeout: 60000 });
  await shot(page, 'keycloak-login');
  await page.locator('#username').fill(account.username);
  await page.locator('#password').fill(account.password);
  await page.locator('#kc-login').click();
  await page.waitForURL(/\/(dashboard|teacher)$/, { timeout: 90000 });
}

test.describe.configure({ mode: 'serial' });

test('A1 public surface and unauthenticated contract', async ({ page, request }) => {
  const home = await page.goto('/');
  expect(home!.status()).toBe(200);
  await expect(page.locator('h1').first()).toBeVisible();
  await shot(page, '01-home');

  const me = await request.get('/api/me');
  expect(me.status()).toBe(401);

  const csrf = await request.get('/api/auth/csrf');
  expect(csrf.status()).toBe(200);
  const csrfBody = await csrf.json();
  expect(csrfBody.token).toBeTruthy();

  const oauth = await request.get('/oauth2/authorization/exam', { maxRedirects: 0 });
  expect([302, 303]).toContain(oauth.status());
  const location = oauth.headers()['location'] ?? '';
  expect(location).toContain('tail449656.ts.net/realms/english-exam-demo');

  fs.writeFileSync(path.join(out, 'public-surface.json'), JSON.stringify({
    home: home!.status(),
    me: me.status(),
    csrf: csrf.status(),
    oauthStatus: oauth.status(),
    oauthIssuerHost: new URL(location).host,
    issuerStable: location.includes('tail449656.ts.net'),
  }, null, 2));
});

test('A2 OAuth2 login with Keycloak as teacher', async ({ page }) => {
  await loginAs(page, qa.accounts.teacher);
  const me = await (await page.request.get('/api/me')).json();
  expect(me.isTeacher).toBe(true);
  expect(me.isStudent).toBe(false);
  await shot(page, '02-teacher-dashboard');
  fs.writeFileSync(path.join(out, 'teacher-me.json'), JSON.stringify(me, null, 2));
});

test('A3 teacher classroom creation persists after reload', async ({ page }) => {
  await loginAs(page, qa.accounts.teacher);
  const tag = Date.now().toString().slice(-6);
  const classCode = `QA-${tag}`;
  const className = `Lop kiem thu tu dong ${tag}`;

  await page.goto('/teacher/classes');
  await expect(page.getByRole('heading', { name: 'Lớp phụ trách' })).toBeVisible({ timeout: 60000 });
  const createButton = page.getByRole('button', { name: 'Tạo lớp', exact: true }).first();
  await expect(createButton).toBeVisible();
  await shot(page, '03-teacher-classes-before');

  await createButton.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.locator('input[name="classCode"]').fill(classCode);
  await dialog.locator('input[name="className"]').fill(className);
  await shot(page, '04-create-class-dialog');
  await dialog.getByRole('button', { name: 'Tạo lớp', exact: true }).click();
  await expect(page.getByText(classCode, { exact: true })).toBeVisible({ timeout: 60000 });

  await page.reload();
  await expect(page.getByText(classCode, { exact: true })).toBeVisible({ timeout: 60000 });
  await shot(page, '05-class-persisted-after-reload');

  const list = await (await page.request.get('/api/teacher/classes')).json();
  const created = list.find((c: { classCode: string }) => c.classCode === classCode);
  expect(created).toBeTruthy();
  fs.writeFileSync(path.join(out, 'classroom-create.json'), JSON.stringify({ classCode, className, classId: created.classId, persistedAfterReload: true }, null, 2));
});

test('A4 student login, dashboard and role boundary', async ({ page }) => {
  await loginAs(page, qa.accounts.student);
  const me = await (await page.request.get('/api/me')).json();
  expect(me.isStudent).toBe(true);
  expect(me.isTeacher).toBe(false);
  await shot(page, '06-student-dashboard');

  const forbidden = await page.request.get('/api/teacher/classes');
  expect(forbidden.status()).toBe(403);

  const exams = await page.request.get('/api/student/exams');
  expect(exams.status()).toBe(200);

  await page.goto('/classes');
  await expect(page.getByRole('heading', { name: 'Lớp học của tôi' })).toBeVisible({ timeout: 60000 });
  await shot(page, '07-student-classes');

  fs.writeFileSync(path.join(out, 'student-boundary.json'), JSON.stringify({
    isStudent: me.isStudent,
    isTeacher: me.isTeacher,
    teacherClassesStatus: forbidden.status(),
    studentExamsStatus: exams.status(),
  }, null, 2));
});

test('A5 logout and re-authentication', async ({ page }) => {
  await loginAs(page, qa.accounts.teacher);
  const csrfBody = await (await page.request.get('/api/auth/csrf')).json();
  const logout = await page.request.post('/api/logout', {
    headers: { [csrfBody.headerName]: csrfBody.token },
  });
  expect([200, 204, 302]).toContain(logout.status());
  const me = await page.request.get('/api/me');
  expect(me.status()).toBe(401);
  await page.goto('/login');
  await shot(page, '08-logged-out');
  fs.writeFileSync(path.join(out, 'logout.json'), JSON.stringify({ logoutStatus: logout.status(), meAfterLogout: me.status() }, null, 2));
});
