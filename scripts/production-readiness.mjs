// Read-only public preflight + configuration drift audit.
// This never substitutes for authenticated classroom E2E, and it never trusts a local runtime file
// to decide whether production needs a redeploy: the effective Vercel configuration is read from the
// Vercel API, and every public probe reports the concrete failure cause.
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(root, 'frontend/package.json'));
const { chromium } = require('@playwright/test');

const origin = 'https://english-exam-coursework.vercel.app';
const projectId = 'prj_gBzNA7EV8w2vOUrQ52vo3KyZYcTX';
const teamId = 'team_Bdtq8YBex6XVQPJciTcU5XwE';
const out = path.join(root, 'evidence/production');
fs.mkdirSync(out, { recursive: true });

function tailscaleJson(args) {
  try {
    return JSON.parse(execFileSync('tailscale', args, { encoding: 'utf8', windowsHide: true }));
  } catch {
    return null;
  }
}

function stablePublicHost() {
  const status = tailscaleJson(['status', '--json']);
  const dnsName = status?.Self?.DNSName;
  return dnsName ? dnsName.replace(/\.$/, '') : null;
}

function funnelText() {
  try {
    return execFileSync('tailscale', ['funnel', 'status'], { encoding: 'utf8', windowsHide: true });
  } catch {
    return '';
  }
}

function vercelToken() {
  if (process.env.VERCEL_TOKEN) return process.env.VERCEL_TOKEN;
  const authFile = path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'com.vercel.cli', 'Data', 'auth.json');
  try {
    return JSON.parse(fs.readFileSync(authFile, 'utf8')).token || null;
  } catch {
    return null;
  }
}

async function vercelProductionBackendUrl() {
  const token = vercelToken();
  if (!token) return { ok: false, error: 'no Vercel credential (set VERCEL_TOKEN or sign in with the Vercel CLI)' };
  const headers = { Authorization: `Bearer ${token}` };
  try {
    const listResponse = await fetch(`https://api.vercel.com/v9/projects/${projectId}/env?teamId=${teamId}`, { headers });
    if (!listResponse.ok) return { ok: false, error: `Vercel API ${listResponse.status}` };
    const { envs } = await listResponse.json();
    const entry = (envs || []).find(e => e.key === 'BACKEND_URL' && (e.target || []).includes('production'));
    if (!entry) return { ok: true, backendUrl: null, error: 'BACKEND_URL is not configured for production' };
    const detailResponse = await fetch(`https://api.vercel.com/v1/projects/${projectId}/env/${entry.id}?teamId=${teamId}`, { headers });
    if (!detailResponse.ok) return { ok: false, error: `Vercel API ${detailResponse.status}` };
    const detail = await detailResponse.json();
    return { ok: true, backendUrl: detail.value, envId: entry.id };
  } catch (error) {
    return { ok: false, error: String(error) };
  }
}

async function latestDeployment() {
  const token = vercelToken();
  if (!token) return null;
  try {
    const response = await fetch(`https://api.vercel.com/v6/deployments?projectId=${projectId}&teamId=${teamId}&limit=1`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return null;
    const body = await response.json();
    const deployment = (body.deployments || [])[0];
    return deployment ? { id: deployment.uid, url: deployment.url, state: deployment.state, createdAt: new Date(deployment.created).toISOString(), target: deployment.target } : null;
  } catch {
    return null;
  }
}

function classifyPublicFailure(status, body) {
  const text = typeof body === 'string' ? body : JSON.stringify(body ?? '');
  if (status === 502 && /DNS_HOSTNAME_NOT_FOUND/i.test(text)) return 'BACKEND_DNS_HOST_NOT_FOUND';
  if (status === 502) return 'BACKEND_UPSTREAM_UNREACHABLE';
  if (status === 504) return 'BACKEND_UPSTREAM_TIMEOUT';
  if (status === 0) return 'NETWORK_UNREACHABLE';
  if (status === 503) return 'SERVICE_NOT_READY';
  return `UNEXPECTED_STATUS_${status}`;
}

function safeUrl(value) {
  try {
    const url = new URL(value, origin);
    return url.origin + url.pathname;
  } catch {
    return value;
  }
}

const host = stablePublicHost();
const stableBase = host ? `https://${host}` : null;
const funnel = funnelText();
const funnelConfigured = Boolean(host && funnel.includes(host) && funnel.includes('Funnel on') && funnel.includes('proxy http://127.0.0.1:8090'));

const report = {
  startedAt: new Date().toISOString(),
  origin,
  scope: 'Unauthenticated read-only public preflight plus effective configuration audit; no classroom records created',
  configuration: {
    stablePublicBase: stableBase,
    funnelConfigured,
    funnelTargetsGateway: funnel.includes('proxy http://127.0.0.1:8090'),
  },
  vercel: {},
  browser: 'Chrome',
  ignoreHTTPSErrors: false,
  navigations: [],
  requests: [],
  pageErrors: [],
  consoleErrors: [],
  failedRequests: [],
  screenshots: [],
};

const vercelEnv = await vercelProductionBackendUrl();
report.vercel = {
  projectId,
  productionBackendUrl: vercelEnv.backendUrl ?? null,
  readOk: vercelEnv.ok,
  readError: vercelEnv.error ?? null,
  matchesStableHost: Boolean(vercelEnv.ok && vercelEnv.backendUrl && stableBase && vercelEnv.backendUrl.replace(/\/$/, '') === stableBase),
  requiresRedeploy: Boolean(vercelEnv.ok && stableBase && vercelEnv.backendUrl !== stableBase),
  latestDeployment: await latestDeployment(),
};

// Direct probes of the stable endpoint (independent of Vercel).
for (const route of ['/api/me', '/api/auth/csrf', '/oauth2/authorization/exam', '/realms/english-exam-demo/.well-known/openid-configuration']) {
  if (!stableBase) {
    report.requests.push({ surface: 'stable', route, status: 0, cause: 'NO_STABLE_HOST' });
    continue;
  }
  try {
    const response = await fetch(stableBase + route, { redirect: 'manual' });
    const text = await response.text().catch(() => '');
    const row = { surface: 'stable', route, status: response.status };
    if (response.headers.get('location')) row.redirectTo = safeUrl(response.headers.get('location'));
    if (route.includes('openid-configuration') && response.ok) {
      try {
        row.issuer = JSON.parse(text).issuer;
        row.issuerMatches = row.issuer === `${stableBase}/realms/english-exam-demo`;
      } catch { }
    }
    if (!response.ok && response.status !== 401 && response.status !== 302) row.cause = classifyPublicFailure(response.status, text.slice(0, 400));
    report.requests.push(row);
  } catch (error) {
    report.requests.push({ surface: 'stable', route, status: 0, cause: 'NETWORK_UNREACHABLE', error: String(error) });
  }
}

const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const context = await browser.newContext({ locale: 'vi-VN', timezoneId: 'Asia/Bangkok', viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  page.on('pageerror', e => report.pageErrors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') report.consoleErrors.push(m.text()); });
  page.on('requestfailed', r => report.failedRequests.push({ url: safeUrl(r.url()), error: r.failure()?.errorText }));

  for (const [route, name] of [['/', '01-public-home'], ['/login', '02-public-login'], ['/teacher', '03-protected-teacher']]) {
    const response = await page.goto(origin + route, { waitUntil: 'networkidle', timeout: 60000 });
    const text = await page.locator('body').innerText().catch(() => '');
    report.navigations.push({
      route,
      status: response?.status(),
      finalUrl: safeUrl(page.url()),
      title: await page.title().catch(() => ''),
      maintenanceVisible: text.includes('Cổng thi chưa mở'),
      loginLinkCount: await page.getByRole('link', { name: 'Tiếp tục đăng nhập' }).count(),
    });
    await page.screenshot({ path: path.join(out, name + '.png'), fullPage: true, animations: 'disabled' });
    report.screenshots.push(name + '.png');
  }

  for (const route of ['/api/me', '/api/auth/csrf', '/api/teacher/classes', '/api/student/exams', '/oauth2/authorization/exam', '/login/oauth2/code/exam', '/dashboard', '/teacher', '/history']) {
    const response = await context.request.get(origin + route, { maxRedirects: 0, timeout: 30000 });
    const headers = response.headers();
    const row = {
      surface: 'vercel',
      route,
      status: response.status(),
      headers: Object.fromEntries(['content-type', 'cache-control', 'retry-after', 'strict-transport-security', 'x-content-type-options', 'x-frame-options', 'referrer-policy'].filter(k => headers[k]).map(k => [k, headers[k]])),
    };
    if (headers.location) row.redirectTo = safeUrl(headers.location);
    const contentType = headers['content-type'] || '';
    if (contentType.includes('application/json')) {
      const body = await response.json().catch(() => ({}));
      row.body = { code: body.code, message: body.message };
      if (body.code) row.cause = classifyPublicFailure(response.status, JSON.stringify(body));
    } else {
      const text = await response.text().catch(() => '');
      if (response.status() >= 500) {
        row.cause = classifyPublicFailure(response.status(), text.slice(0, 400));
        row.message = (text.match(/[A-Z_]{6,}/) || [])[0] || null;
      }
    }
    report.requests.push(row);
  }

  report.cookies = (await context.cookies()).map(({ name, secure, httpOnly, sameSite }) => ({ name, secure, httpOnly, sameSite }));

  const login = report.navigations.find(n => n.route === '/login');
  const me = report.requests.find(r => r.surface === 'vercel' && r.route === '/api/me');
  const oauth = report.requests.find(r => r.surface === 'vercel' && r.route === '/oauth2/authorization/exam');
  const stableMe = report.requests.find(r => r.surface === 'stable' && r.route === '/api/me');
  const discovery = report.requests.find(r => r.surface === 'stable' && r.route.includes('openid-configuration'));

  const maintenance = login?.maintenanceVisible || me?.status === 503 || stableMe?.status === 503;
  const backendReachable = stableMe?.status === 401 || stableMe?.status === 200;
  const vercelReachesBackend = me?.status === 401 || me?.status === 200;
  const oauthOk = [302, 303, 307].includes(oauth?.status) && oauth?.redirectTo && !oauth.redirectTo.startsWith(origin);

  const failures = [];
  if (!stableBase) failures.push({ cause: 'NO_STABLE_PUBLIC_HOST', detail: 'Tailscale identity is unavailable, so no stable backend hostname can be derived.' });
  if (!funnelConfigured) failures.push({ cause: 'FUNNEL_NOT_CONFIGURED', detail: 'tailscale funnel does not proxy the stable hostname to the gateway on 127.0.0.1:8090.' });
  if (!backendReachable) failures.push({ cause: stableMe?.cause || 'BACKEND_UNREACHABLE_DIRECT', detail: `Direct probe of ${stableBase}/api/me returned ${stableMe?.status ?? 0}.` });
  if (discovery && discovery.issuer && !discovery.issuerMatches) failures.push({ cause: 'OIDC_ISSUER_MISMATCH', detail: `Keycloak advertises ${discovery.issuer}, expected ${stableBase}/realms/english-exam-demo.` });
  if (!vercelEnv.ok) failures.push({ cause: 'VERCEL_CONFIG_UNREADABLE', detail: vercelEnv.error });
  if (vercelEnv.ok && !report.vercel.matchesStableHost) failures.push({ cause: 'VERCEL_BACKEND_URL_STALE', detail: `Production BACKEND_URL is ${vercelEnv.backendUrl}; the stable endpoint is ${stableBase}. A reviewed production deployment is required.` });
  if (!vercelReachesBackend) failures.push({ cause: me?.cause || 'VERCEL_BACKEND_UNREACHABLE', detail: `Production /api/me returned ${me?.status ?? 0}${me?.message ? ' (' + me.message + ')' : ''}.` });
  if (!oauthOk) failures.push({ cause: 'OAUTH_INITIATION_FAILED', detail: 'Production /oauth2/authorization/exam did not redirect to the identity provider.' });
  if (maintenance) failures.push({ cause: 'SERVICE_IN_PREVIEW_MODE', detail: 'The public site reports the exam service as not open (APP_SERVICE_MODE=preview or BACKEND_URL missing).' });

  report.failures = failures;
  report.status = failures.length === 0 ? 'INFRASTRUCTURE_READY_FOR_AUTHENTICATED_E2E' : `BLOCKED_${failures[0].cause}`;
  report.infrastructureReady = failures.length === 0;
  report.authenticatedReadiness = 'NOT_EVALUATED_BY_PREFLIGHT';
  report.authenticatedE2E = {
    tool: 'frontend/tests-production/acceptance.spec.ts + classroom.spec.ts',
    command: 'npx playwright test --config playwright.production.config.ts',
    note: 'Infrastructure readiness is not proof of authenticated readiness; run the production Playwright suites.',
    evidenceDir: 'evidence/production/acceptance',
  };
  report.productionPass = false;
  report.reason = failures.length === 0
    ? 'Public infrastructure is ready. Authenticated teacher/student workflow evidence must come from the production Playwright suites.'
    : failures.map(f => `${f.cause}: ${f.detail}`).join(' | ');
  process.exitCode = failures.length === 0 ? 0 : 2;
} catch (error) {
  report.status = 'ERROR';
  report.error = String(error);
  process.exitCode = 1;
} finally {
  await browser.close();
  report.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(out, 'public-playwright-preflight.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({
    status: report.status,
    infrastructureReady: report.infrastructureReady ?? false,
    requiresRedeploy: report.vercel.requiresRedeploy ?? null,
    productionBackendUrl: report.vercel.productionBackendUrl ?? null,
    stablePublicBase: stableBase,
    failures: (report.failures || []).map(f => f.cause),
    evidence: path.join(out, 'public-playwright-preflight.json'),
  }, null, 2));
}
