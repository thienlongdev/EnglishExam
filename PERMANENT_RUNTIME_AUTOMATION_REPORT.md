# EnglishExamWeb — Permanent Runtime Automation Report

**Date:** 2026-11-12 (Asia/Bangkok)
**Host:** `DESKTOP-LF8R4HO` (Windows 11 Pro 10.0.26200), user `Admin` (administrator)
**Project:** `C:\BTL-CSDL\EnglishExamWeb`
**Production:** <https://english-exam-coursework.vercel.app>
**Stable backend endpoint:** <https://desktop-lf8r4ho.tail449656.ts.net>

---

## 1. Root causes of the previous outages

The outage was not a single bug. Six defects formed one failure chain:

| # | Root cause | Evidence | Consequence |
|---|---|---|---|
| 1 | The public backend was a **Cloudflare Quick Tunnel** (`*.trycloudflare.com`). Quick tunnels are ephemeral by design: a new random hostname on every tunnel process restart. | `scripts/start-demo.ps1` scraped the hostname out of `tunnel-error.log`; `.local/demo/runtime.json` held `https://irrigation-beer-equity-disabled.trycloudflare.com` while Vercel held `https://workplace-brick-return-discount.trycloudflare.com`. | Each restart invalidated the previously published hostname. |
| 2 | `frontend/next.config.ts` computes the `/api/*`, `/oauth2/*`, `/login/oauth2/*` rewrites from `process.env.BACKEND_URL` **at build time**. Vercel freezes that value into the deployment's routes manifest. | `next.config.ts` line 2-8; production `BACKEND_URL` was still a dead quick-tunnel host. | The deployed build kept proxying to a hostname that no longer existed → `HTTP 502 DNS_HOSTNAME_NOT_FOUND` on `/api/me`, `/api/auth/csrf`, `/api/teacher/classes`, `/api/student/exams`, `/oauth2/authorization/exam`, `/login/oauth2/code/exam`. |
| 3 | Keycloak's issuer was bound to the same ephemeral hostname (`KC_HOSTNAME`), and the Spring backend received that hostname as `OIDC_ISSUER`. | `.local/demo/keycloak.env` had `KC_HOSTNAME=https://irrigation-beer-equity-disabled.trycloudflare.com`; `/oauth2/authorization/exam` redirected to that dead host. | Even when Vercel reached the backend, OIDC login broke on the next tunnel restart. |
| 4 | `RequiresVercelRedeploy` was computed by comparing **two local files** (`runtime.json` before/after), never the real Vercel configuration. | Old `start-demo.ps1` line 43: `RequiresVercelRedeploy=($oldUrl -ne $state.tunnelUrl)`; the Vercel value was never read. | Reported `RequiresVercelRedeploy: false` while production was provably broken. |
| 5 | Nothing supervised the runtime. `start-demo.ps1` started the gateway and the quick tunnel but never started the **Keycloak container** unless the configuration had changed, and nothing restarted a dead backend/gateway. | Cold-start drill #1: `english-exam-demo-identity` stayed `Exited (143)` for minutes while the stack reported other components healthy. | Silent partial outages; a stopped container was never recovered. |
| 6 | Tailscale Funnel was never actually enabled on the tailnet, so the previously attempted permanent hostname could never be created (`Error 404 — node not found` came from the console flow, and the CLI said `Funnel is not enabled on your tailnet`). | `tailscale funnel --bg 8090` printed the enablement URL and waited; the console reported *"✓ Funnel ACL is already configured"* with an **Enable Funnel** button. | The only candidate for a stable hostname was blocked, so the project fell back to quick tunnels. |

**Fix principle applied:** remove the churn (stable hostname), then remove the coupling (build-time baked hostname), then remove the blindness (effective-config verification), then add supervision.

---

## 2. Final public backend hostname

```
https://desktop-lf8r4ho.tail449656.ts.net
```

Derived from the Tailscale node identity (`desktop-lf8r4ho` + tailnet `tail449656.ts.net`), **not** from a tunnel process log. It is stable across:

* gateway / backend / container restarts,
* Tailscale service restarts (verified),
* Funnel reconfiguration (verified),
* Windows restarts (the node identity is persisted by `tailscaled`).

OIDC issuer: `https://desktop-lf8r4ho.tail449656.ts.net/realms/english-exam-demo`

---

## 3. Selected permanent tunnel architecture

**Tailscale Funnel** (serverless ingress provided by the tailnet), HTTPS 443 → `http://127.0.0.1:8090`.

```
Internet ──TLS──▶ desktop-lf8r4ho.tail449656.ts.net (Funnel ingress 103.84.155.153/.217)
                        │
                        ▼
              tailscaled on this PC ──▶ 127.0.0.1:8090 (demo-gateway.mjs)
                        │                        │
                        │                        ├─▶ 127.0.0.1:8082  Spring Boot backend
                        │                        └─▶ 127.0.0.1:8280  Keycloak
                        └─ Docker: english-exam-web-sql (14339→SQL), english-exam-demo-identity
```

Why this option:

* **Stable, free, no purchased domain.** The `*.ts.net` name is permanent for this node.
* **No dashboard dependency at runtime.** The funnel configuration lives in `tailscaled` state and is re-asserted automatically by the stack script.
* **Certificate handling and public DNS are managed by Tailscale** (valid TLS confirmed through the public ingress).
* Cloudflare Named Tunnel was rejected: it requires a domain the project does not own (no purchases allowed).
* Cloudflare Quick Tunnel was rejected outright as a permanent solution (§5 of the brief).

**Verification that the endpoint is genuinely public** (not just reachable from inside the tailnet):

* Public DNS (Cloudflare DoH): `desktop-lf8r4ho.tail449656.ts.net → 103.84.155.153, 103.84.155.217`
* Forced public-ingress request: `curl --resolve desktop-lf8r4ho.tail449656.ts.net:443:103.84.155.153 https://…/api/me` → `HTTP/1.1 401` + `{"code":"UNAUTHENTICATED"}`
* Third-party vantage point (`r.jina.ai`) fetched the same URL and received the same 401 payload.
* After every recovery drill the same probe passes (`evidence/runtime/drill-*.json`).

Runtime facts recorded by the readiness tool:

```json
{ "stablePublicBase": "https://desktop-lf8r4ho.tail449656.ts.net",
  "funnelConfigured": true, "funnelTargetsGateway": true }
```

---

## 4. Windows automatic startup configuration

The required experience — *power on → sign in → use EnglishExamWeb* — is implemented as an ordered, idempotent bring-up:

1. **Windows starts**, user signs in.
2. **Docker Desktop starts** from the per-user Run key (`HKCU\…\Run\Docker Desktop`, already present and now verified by the installer).
3. **Task `EnglishExamWeb Stack`** fires 30 s after sign-in and runs `scripts/runtime/stack.ps1`.
4. `stack.ps1` waits for the **Docker engine** (`docker info`, bounded wait).
5. It starts the **SQL Server** container (`english-exam-web-sql`) if needed and waits for `127.0.0.1:14339`.
6. It starts the **Keycloak** container (`english-exam-demo-identity`) if needed and waits for `127.0.0.1:8280`.
7. It reconciles the **identity configuration** with the live Tailscale hostname (`runtime.json`, `keycloak.env`) and recreates Keycloak only if that hostname actually changed.
8. It re-asserts the **Tailscale Funnel** mapping (443 → 8090).
9. It starts the **gateway** (`node scripts/demo-gateway.mjs`) if it is not serving 8090.
10. It starts the **Spring Boot backend** if it is missing, unhealthy, or still pointing at a stale OIDC issuer.
11. It verifies the **public surface through the real internet ingress**, the **OIDC issuer**, the **effective Vercel configuration**, and **production `/api/me`**.
12. **Task `EnglishExamWeb Watchdog`** keeps that same repair loop running every 30 s for the rest of the session.

Docker Desktop requires an interactive session, so startup is implemented **at sign-in**, not at boot-time before login. This is stated explicitly rather than overclaimed.

---

## 5. Windows service and Task Scheduler details

| Task | Trigger | Action | Settings |
|---|---|---|---|
| `EnglishExamWeb Stack` | At logon (this user), **30 s delay** | `powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File …\stack.ps1 -Quiet` | Runs as `DESKTOP-LF8R4HO\Admin`, **RunLevel Highest**, `MultipleInstances=IgnoreNew`, execution limit 20 min, **restart 3× / 2 min** on failure, start-when-available |
| `EnglishExamWeb Watchdog` | At logon, **90 s delay** | `… -File …\watchdog.ps1` | Highest, `IgnoreNew`, **no execution time limit**, restart 999× / 1 min |
| `EnglishExamWeb Keepalive` | Every **5 minutes** (repeating) | `… -File …\keepalive.ps1` | Highest, `IgnoreNew`, restarts the watchdog if its heartbeat is older than 150 s and no watchdog process exists |

* `Tailscale` service: `StartType = Automatic`, `Status = Running` (unchanged, verified).
* `Docker Desktop`: auto-starts from `HKCU\Software\Microsoft\Windows\CurrentVersion\Run` (verified by the installer, not re-created blindly).
* Installation / removal: `scripts/runtime/install-autostart.ps1` and `scripts/runtime/uninstall-autostart.ps1`.

Observed task results at hand-over:

```
EnglishExamWeb Keepalive | Ready | lastResult=0
EnglishExamWeb Stack     | Ready | lastResult=0   (healthy=True, production /api/me -> 401)
EnglishExamWeb Watchdog  | Ready | lastResult=0   (heartbeat healthy, ~4.7 s/cycle)
```

---

## 6. Docker restart policies

| Container | Image | Restart policy | Port (loopback only) |
|---|---|---|---|
| `english-exam-web-sql` | `mcr.microsoft.com/mssql/server:2025-latest` | `unless-stopped` | `127.0.0.1:14339 → 1433` |
| `english-exam-demo-identity` | `quay.io/keycloak/keycloak:26.4` | `unless-stopped` | `127.0.0.1:8280 → 8080` |

* Volumes and data are preserved; no container was deleted or re-created with new storage.
* The readiness loop does **not** rely on `unless-stopped` alone: it explicitly starts both containers when they are stopped (this is the fix for root cause #5).
* Only these two containers are ever started/stopped by the automation. Other containers (including `englishcoach-ai-whisperx` and `english-exam-web-*` from the non-demo environment) are never touched.

---

## 7. Process supervision

* **Backend (Java)** — supervised by the stack/watchdog cycle: the managed instance is identified by its jar path in the command line (`Get-CimInstance Win32_Process`), not by a stale PID file. Missing/unhealthy/stale-issuer → bounded restart via `scripts/start-demo-backend.ps1`, then a health wait on `/actuator/health` (`status: UP`).
* **Gateway (Node)** — identified by `scripts/demo-gateway.mjs` in its command line; restarted only when the process or port 8090 is missing.
* **Duplicate protection** — `Local\EnglishExamWebRuntimeStack` mutex (120 s wait) prevents overlapping repairs; the watchdog itself is protected by `Local\EnglishExamWebWatchdog`.
* **Logs** — stdout/stderr of each component in `.local/demo/*.log`; runtime decisions in `.local/runtime/logs/stack.log`, `watchdog.log`, `keepalive.log`, `drill.log`. Each log rotates at 2 MB.
* **Port collisions** — the scripts bind/verify fixed loopback ports (8082, 8090, 8280, 14339) and report a closed port as an explicit failure instead of silently continuing.

---

## 8. Watchdog configuration

| Item | Value |
|---|---|
| File | `scripts/runtime/watchdog.ps1` |
| Interval | **30 s** (`-IntervalSeconds`, configurable) |
| Repair engine | `scripts/runtime/stack.ps1` (idempotent, dependency-ordered) |
| Per-run timeout | 600 s (`-StackTimeoutSeconds`), the child is terminated if exceeded |
| Restart-storm guard | max **8 restarts per component per rolling 10 minutes**, then a throttled WARN (`Test-RestartAllowed`) |
| Heartbeat | `.local/runtime/heartbeat.json` every cycle (cycle number, healthy flag, duration, consecutive failures) |
| Liveness guard | `keepalive.ps1` every 5 min restarts a dead watchdog (stale > 150 s) |
| Supervision of the supervisor | Task Scheduler restart-on-failure (999 × 1 min) |
| Cost | ~4.7 s per cycle, one PowerShell child process per cycle, no polling agents, no browser |

Repair policy: each check is evaluated in dependency order and **only the failing layer is touched**. A failing public probe does not restart a healthy backend. Docker is never restarted unnecessarily, containers are never recreated to "fix" a process problem, and production data is never written for a health check.

---

## 9. Modified files

**Added**

| File | Purpose |
|---|---|
| `scripts/runtime/config.ps1` | Single source of truth for paths, ports, containers, Vercel ids |
| `scripts/runtime/common.ps1` | Logging, ownership detection, HTTP/DNS probes, restart-storm guard, Vercel API helpers |
| `scripts/runtime/stack.ps1` | Idempotent bring-up/repair in dependency order, JSON result, mutex |
| `scripts/runtime/watchdog.ps1` | 30 s self-healing loop + heartbeat |
| `scripts/runtime/keepalive.ps1` | Restarts a dead/stale watchdog |
| `scripts/runtime/install-autostart.ps1` / `uninstall-autostart.ps1` | Task Scheduler registration / removal |
| `scripts/runtime/recover.ps1` | One-command emergency recovery + status table |
| `scripts/runtime/drill.ps1` | Controlled failure drills (`backend`, `gateway`, `tunnel`, `containers`, `coldstart`) |
| `frontend/tests-production/acceptance.spec.ts` | Public surface, OIDC login, classroom create/persist, role boundary, logout |
| `frontend/tests-production/exam-lifecycle.spec.ts` | Publish → assign → attempt → save → reload → submit → score → teacher results |

**Changed**

| File | Change |
|---|---|
| `scripts/configure-demo.py` | Derives the hostname from the Tailscale node identity, **asserts the Funnel mapping**, writes `runtime.json` + `keycloak.env`. Cloudflare log scraping removed. |
| `scripts/start-demo.ps1` | Reduced to a thin, documented manual recovery wrapper around `stack.ps1`. No longer required for daily use. |
| `scripts/production-readiness.mjs` | Reads the **effective Vercel production configuration from the Vercel API**, classifies each failure (`BACKEND_DNS_HOST_NOT_FOUND`, `BACKEND_UPSTREAM_UNREACHABLE`, `VERCEL_BACKEND_URL_STALE`, `OIDC_ISSUER_MISMATCH`, `FUNNEL_NOT_CONFIGURED`, `SERVICE_IN_PREVIEW_MODE`, …), and separates *infrastructure readiness* from *authenticated readiness*. |

**Regenerated configuration (not source code)**: `.local/demo/runtime.json`, `.local/demo/keycloak.env` (both now bound to the stable hostname).

**Untouched (verified):** `EnglishExamDB.sql`, `EnglishExamDB.bak`, `FINAL.zip`, the academic report/slide files, the ERD, all schema objects (tables, views, indexes, triggers, stored procedures), every teacher/student account, and everything belonging to English Coach.

---

## 10. Vercel environment changes

* Project: `english-exam-coursework` (`prj_gBzNA7EV8w2vOUrQ52vo3KyZYcTX`, scope `long-a2b9`, team `team_Bdtq8YBex6XVQPJciTcU5XwE`).
* `BACKEND_URL` (production) env id `K06P2GVfJXyXPEmN`:
  * **before:** `https://workplace-brick-return-discount.trycloudflare.com` *(dead quick tunnel)*
  * **after:** `https://desktop-lf8r4ho.tail449656.ts.net`
  * read back through the Vercel API after the update.
* `APP_SERVICE_MODE` (production) left at **`live`**; preview environment untouched.
* Public domain unchanged: `english-exam-coursework.vercel.app`.
* No other project, alias, or environment was modified.

### New production deployment

| Field | Value |
|---|---|
| Deployment ID | `dpl_9Xa658u3WAPT5sujhS2G9wm7XYkD` |
| URL | `english-exam-coursework-19bufiock-long-a2b9.vercel.app` |
| Target / state | `production` / `READY` |
| Created | 2026-11-12T08:20:41Z |
| Aliased to | `https://english-exam-coursework.vercel.app` |

Because `next.config.ts` evaluates `BACKEND_URL` during `next build`, a rebuild was mandatory; a redeploy of the old build would have changed nothing. This was the only deployment performed in this session, and it is the last one required until the frontend source changes again.

Post-deploy verification through the public domain:

```
/                          → 200
/api/me                    → 401  (previously 502 DNS_HOSTNAME_NOT_FOUND)
/api/auth/csrf             → 200 + token
/oauth2/authorization/exam → 302 → https://desktop-lf8r4ho.tail449656.ts.net/realms/english-exam-demo/…
```

---

## 11. Actual browser E2E results

Real Chrome, headless, `locale=vi-VN`, `timezoneId=Asia/Bangkok`, no HTTP error masking, against `https://english-exam-coursework.vercel.app`.

### Acceptance suite — `frontend/tests-production/acceptance.spec.ts`

| Test | Result |
|---|---|
| A1 public surface and unauthenticated contract | **PASS** (home 200, `/api/me` 401, CSRF 200, OAuth 302 to the stable issuer) |
| A2 OAuth2 login with Keycloak as teacher | **PASS** (`isTeacher=true`) |
| A3 teacher classroom creation persists after reload | **PASS** ("+ Tạo lớp" → dialog → card visible → visible after reload → present in `/api/teacher/classes`) |
| A4 student login, dashboard and role boundary | **PASS** (`isStudent=true`, `/api/teacher/classes` → 403, `/api/student/exams` → 200) |
| A5 logout and re-authentication | **PASS** (`/api/logout` → `/api/me` 401) |

Run twice: once during commissioning (`5 passed (27.6s)`) and once after **all** recovery drills (`5 passed (24.6s)`).

### Exam lifecycle — `frontend/tests-production/exam-lifecycle.spec.ts`

One end-to-end test, real UI + real API + independent SQL reads:

1. teacher creates an exam, attaches 5 questions (only questions that satisfy the 4-option/1-correct rule), **publishes** it;
2. assigns it to `DEMO-ENG-01` with an open window;
3. student sees it in `/api/student/exams`, starts the attempt through the UI ("Bắt đầu làm bài" → "Tôi đã sẵn sàng");
4. selects an option, sees "Đã lưu đáp án A";
5. **reloads the page** and the same option is still checked;
6. submits ("Nộp bài" → "Xác nhận nộp bài") and lands on `/results/{id}`;
7. SQL confirms `ExamAttempts.Status = 'Submitted'` with `SubmittedAt` set;
8. teacher result list contains the attempt.

Result: **PASS** — run three times, `47–57 s` each, last run with stable screenshots.

Screenshots: `evidence/production/acceptance/*.png`, `evidence/production/lifecycle/*.png`.
Machine-readable: `evidence/production/acceptance/*.json`, `evidence/production/lifecycle/lifecycle.json`.

### Legacy suite — `frontend/tests-production/classroom.spec.ts` (honest disclosure)

`1 passed / 4`, and the failures are **not** caused by the infrastructure:

* 2 tests abort in their fixture at `publish` with `409`. The fixture takes `questions.slice(0,5)` from the unpaged question bank. Production data contains 6 legacy questions (ids 23–25, 31–33) with **2 options**, which `usp_PublishExam` correctly rejects (`THROW 51103`): *"Mỗi câu cần 4 lựa chọn và đúng 1 đáp án."* When the fixture happens to pick only valid questions the publish succeeds — verified repeatedly with an identical API call (`publish → 200`).
* 1 test fails on a UI assertion (`getByRole('cell', {name:'DEMO-ENG-01'})`) after saving an assignment; the assignment itself is accepted (`200`).
* The suite also contains mojibake Vietnamese selectors (`Tiáº¿p tá»¥c Ä‘Äƒng nháºp`) from an earlier encoding incident.

These are pre-existing test/data defects. The new `exam-lifecycle.spec.ts` covers the same ground with valid, filtered data.

---

## 12. SQL persistence verification

Read-only queries only (`scripts/demo-query.ps1` refuses anything but `SELECT`), against `EnglishExamDB_Demo` via `127.0.0.1:14339`.

Classroom created through the **production UI** during the acceptance run:

```json
[{ "ClassId": 18, "ClassCode": "QA-764239", "ClassName": "Lop kiem thu tu dong 764239",
   "IsActive": true, "TeacherEmail": "teacher.demo@englishexam.invalid" }]
```

Row counts before / after the whole session (test records only):

| Entity | Before | After |
|---|---|---|
| Users | 9 | 9 |
| Classes | 18 | 18 |
| Questions | 43 | 48 *(5 created by the legacy suite)* |
| Exams | 14 | 21 *(probes + lifecycle tests)* |
| ExamAssignments | 13 | 17 |
| ExamAttempts | 13 | 15 |
| StudentAnswers | 29 | 31 |

Historical examination data was not modified. No schema object, procedure, trigger, view or index was created, altered or dropped. All new rows are isolated QA records created by authorized tests.

---

## 13. Restart / failure recovery results

Executed with `scripts/runtime/drill.ps1`; raw evidence in `evidence/runtime/drill-*.json`.

| Drill | What was broken | Recovery | Result |
|---|---|---|---|
| **A. Backend crash** | both backend JVMs killed | watchdog restart + health wait | **recovered in 14 s** |
| **B. Gateway crash** | gateway node process killed | watchdog restart | **recovered in 30 s** |
| **C. Tunnel restart** | `tailscale funnel reset` (serve config wiped) | stack re-created the mapping | **recovered in 80 s**, hostname **unchanged** (`desktop-lf8r4ho.tail449656.ts.net` before and after), no Vercel redeploy |
| **D. Container recovery** | `docker restart` of SQL + Keycloak | explicit start + port waits | **recovered in 13 s**, data intact |
| **E. Cold start** (controlled startup simulation) | backend, gateway, funnel and **both containers** stopped, then the real logon task invoked with `Start-ScheduledTask` | full ordered bring-up | **recovered in 177 s** (first attempt, before the Keycloak-start fix, failed — see below) |
| **F. Production regression** | re-ran the acceptance suite after every drill | — | **5/5 PASS**, plus `production-readiness.mjs` → `INFRASTRUCTURE_READY_FOR_AUTHENTICATED_E2E` |

**Drill E, first attempt (documented failure → fix):** the cold start did **not** recover within 302 s. Root cause: `stack.ps1` started only the SQL container and recreated Keycloak only on a configuration change, so a merely-stopped Keycloak container was never started; independently, the watchdog process died silently during that window and the keepalive threshold (300 s / 10 min) was too slow. Fixes applied: an explicit `container-identity` step (`docker start` whenever the container is not running), a mutex that waits instead of exiting, tighter bounded waits, and a keepalive that checks every 5 min with a 150 s staleness threshold. Drill E then passed in 177 s, and a targeted re-test (stopping Keycloak only) recovered in **10 s**.

**Windows reboot:** a real reboot was **not** performed. It would terminate this remote session and the user's desktop session, so it was not safe to do unilaterally. What *was* done: the three logon tasks were registered, enabled, verified in `Ready` state, and actually executed through Task Scheduler (including a full cold-start simulation). The remaining unknown is limited to Windows-session timing (how long Docker Desktop takes on this machine), which the bounded waits already cover.

---

## 14. Remaining limitations (explicit)

1. **The PC must be powered on, online and signed in.** The runtime is local by design; if the machine is off, production `/api/me` will return 502 (the frontend still renders). Nothing in this design can serve from a switched-off PC.
2. **Startup is at sign-in, not before login.** Docker Desktop requires an interactive session, so "power on → automatic" means "power on → sign in → automatic". No boot-time claim is made.
3. **Tailscale Funnel limits.** Funnel is a convenience ingress (best-effort bandwidth, no SLA, ports 443/8443/10000 only). It is stable and free, but it is not a CDN. Streaming large media through it would be inappropriate; API/OIDC traffic for this application is well within it.
4. **Tailnet policy dependency.** Funnel must remain enabled for the tailnet (the `funnel` node attribute is already present in the ACL). If someone disables Funnel in the admin console, the automation will report `FUNNEL_NOT_CONFIGURED` and retry, but it cannot re-grant a policy it does not own.
5. **Vercel still bakes `BACKEND_URL` at build time.** The hostname is now permanent, so no redeploy is needed after ordinary restarts — but a future change of the Tailscale node name would require one reviewed deployment. (A runtime-resolved proxy would remove even that; it was not implemented because it would add a second configuration source of truth without being needed for the stable-hostname design.)
6. **The watchdog died once silently** during the drill window (no Application/TaskScheduler event was recorded, no error log). The keepalive task detected it and restored the watchdog automatically 11 minutes later; the threshold is now 150 s / 5 min. The death itself remains unexplained, which is why the supervisor-of-the-supervisor exists.
7. **Six legacy questions have 2 options** (ids 23–25, 31–33) and therefore can never be published under the current rule. Data was preserved as instructed; a teacher must not use them in a new exam.
8. **Legacy `classroom.spec.ts` is unreliable** (see §11) — use `acceptance.spec.ts` and `exam-lifecycle.spec.ts`.
9. **Two `java.exe` entries** appear for the backend (the `javapath` launcher plus the real JVM); both are matched and stopped together, which is correct but worth knowing when reading process lists.

---

## 15. One-command emergency recovery fallback

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File C:\BTL-CSDL\EnglishExamWeb\scripts\runtime\recover.ps1
```

It repairs the whole chain in dependency order and prints a per-component table. Read-only variant:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File C:\BTL-CSDL\EnglishExamWeb\scripts\runtime\recover.ps1 -StatusOnly
```

Other useful entry points:

| Command | Use |
|---|---|
| `scripts\runtime\stack.ps1` | same repair, machine-readable (`-Json`) |
| `scripts\runtime\stack.ps1 -CheckOnly` | diagnose only, change nothing |
| `scripts\runtime\install-autostart.ps1` | (re)register the Windows tasks |
| `scripts\runtime\uninstall-autostart.ps1` | remove the Windows tasks |
| `scripts\runtime\drill.ps1 -Scenario backend\|gateway\|tunnel\|containers\|coldstart` | controlled failure test |
| `scripts\start-demo.ps1` | legacy manual wrapper (no longer required) |
| `node scripts\production-readiness.mjs` | public + Vercel + funnel audit with precise failure causes |
| `npx playwright test --config playwright.production.config.ts acceptance.spec.ts exam-lifecycle.spec.ts` | production E2E |

Logs: `.local\runtime\logs\` · heartbeat `.local\runtime\heartbeat.json` · last repair `.local\runtime\last-run.json`.

---

## 16. Definition of done — status

| Requirement | Status | Evidence |
|---|---|---|
| Production website loads | ✅ | `home 200`; `evidence/production/acceptance/01-home.png` |
| Frontend communicates with the real backend | ✅ | `/api/me` 401 instead of 502; §10 |
| Authentication works | ✅ | A2/A5; Keycloak screenshot `keycloak-login.png` |
| Teacher and student workflows work | ✅ | A3/A4 + full exam lifecycle |
| 502 caused by obsolete tunnel DNS eliminated | ✅ | No `DNS_HOSTNAME_NOT_FOUND` in any probe after deployment |
| Backend hostname unchanged after tunnel restart | ✅ | Drill C: `unchanged=True` |
| Routine PC startup never requires `start-demo.ps1` | ✅ | Task `EnglishExamWeb Stack` + Drill E |
| Docker, Keycloak, Spring Boot, gateway start automatically | ✅ | Drill E (177 s from all-stopped) |
| Tunnel reconnects automatically | ✅ | Drill C (80 s, watchdog re-asserted the funnel) |
| Failed local services recover automatically | ✅ | Drills A (14 s), B (30 s), D (13 s), Keycloak-only (10 s) |
| Vercel needs no redeployment after ordinary restarts | ✅ | `requiresRedeploy:false`; only one deployment in the session |
| Existing database records unchanged (except authorized test rows) | ✅ | §12 before/after counts |
| Academic schema and protected files untouched | ✅ | No DDL/DML; read-only evidence queries |
| English Coach unaffected | ✅ | `englishcoach-ai-whisperx` untouched; no English Coach container/domain/DNS operation performed |
| Genuine verification evidence in the report | ✅ | `evidence/runtime/*.json`, `evidence/production/**` |

**Deferred, explicitly not claimed:** a real Windows reboot. Everything else above was executed and verified.

---

### Evidence index

```
evidence/runtime/
  drill-backend-20261112-152929.json      recovered 14 s
  drill-gateway-20261112-153004.json      recovered 30 s
  drill-tunnel-20261112-153129.json       recovered 80 s, hostname unchanged
  drill-containers-20261112-153152.json   recovered 13 s
  drill-coldstart-20261112-153703.json    FAILED 302 s (pre-fix, root cause documented)
  drill-coldstart-20261112-155153.json    recovered 177 s (post-fix)
  final-state.json                        funnel, tasks, containers, heartbeat, production codes
evidence/production/
  public-playwright-preflight.json        Vercel effective config + public probes + failure causes
  acceptance/*.png, *.json                5 acceptance tests, screenshots, SQL class row
  lifecycle/*.png, lifecycle.json         publish → assign → attempt → save → reload → submit → score
  classroom-run.log                       legacy suite output (3 known-brittle failures)
```
