# GITHUB PUBLICATION AND PORTABLE WINDOWS LAPTOP DEMONSTRATION REPORT

**Executive Summary:** The EnglishExam application has been successfully published to GitHub at [https://github.com/thienlongdev/EnglishExam](https://github.com/thienlongdev/EnglishExam) (`main` branch, commit `ed25ff0`). A fully isolated, offline-capable Windows laptop demonstration stack has been developed, packaged, and verified through both local test suites and a full clean-clone acceptance test in an isolated directory. Production infrastructure, Vercel deployments, Tailscale Funnel, and existing Docker containers remain completely untouched.

---

## 1. Repository Publication Overview

| Property | Value | Verification Result |
|---|---|---|
| **Repository URL** | `https://github.com/thienlongdev/EnglishExam` | Verified public repository |
| **Git Remote** | `https://github.com/thienlongdev/EnglishExam.git` | Push origin verified |
| **Branch** | `main` | Default tracking branch |
| **Commit SHA** | `ed25ff0` | Published commit |
| **Commit Message** | `feat: publish EnglishExam platform with portable offline-capable laptop demo` | Descriptive semantic commit |
| **Total Files Tracked** | 140 files (10,888 additions) | Zero forbidden files or caches |
| **Secret Audit** | Automated regex pattern scan (140 files) | **0 secrets / 0 leaks detected** |
| **Production Impact** | Zero modifications | Production completely undisturbed |

---

## 2. Academic Database Architecture & Integrity

The submitted academic database design was preserved with 100% fidelity. There are no JPA DDL operations, dynamic table generation, or external authentication tables modifying the core ERD.

```
                          ACADEMIC RELATIONAL ERD (3NF)
  ┌───────────────┐         ┌───────────────────┐         ┌───────────────┐
  │     Users     │◄────────┤ ClassEnrollments  ├────────►│    Classes    │
  └───────┬───────┘         └───────────────────┘         └───────┬───────┘
          │                                                       │
          │ (CreatedBy)                                           │ (AssignedTo)
          ▼                                                       ▼
  ┌───────────────┐         ┌───────────────────┐         ┌───────────────┐
  │   Questions   │◄────────┤   ExamQuestions   ├────────►│     Exams     │
  └───────┬───────┘         └───────────────────┘         └───────┬───────┘
          │                                                       │
          │ (1:N)                                                 │ (AssignedTo)
          ▼                                                       ▼
  ┌───────────────┐         ┌───────────────────┐         ┌───────────────┐
  │ AnswerOptions │         │  StudentAnswers   │◄────────┤ExamAssignments│
  └───────────────┘         └─────────┬─────────┘         └───────┬───────┘
                                      │                           │
                                      ▼                           │
                            ┌───────────────────┐                 │
                            │   ExamAttempts    │◄────────────────┘
                            └───────────────────┘
```

### Relational Components
- **10 Core Tables:**
  - `dbo.Users` (Identity mapping, student/teacher role flags).
  - `dbo.Classes` (Class code, teacher owner).
  - `dbo.ClassEnrollments` (Student class membership).
  - `dbo.Questions` (Question bank with categories and difficulty levels).
  - `dbo.AnswerOptions` (A, B, C, D options with `IsCorrect` bit flag).
  - `dbo.Exams` (Exam definition, duration, total points, draft/published status).
  - `dbo.ExamQuestions` (Junction table with per-question assigned points).
  - `dbo.ExamAssignments` (Class scheduling with start/end windows).
  - `dbo.ExamAttempts` (Student examination session, start/end timestamps, server-computed score).
  - `dbo.StudentAnswers` (Question choice persistence during exam).
- **4 Authoritative Stored Procedures:**
  - `dbo.usp_PublishExam`: Validates 100-point total and transitions status from `Draft` to `Published`.
  - `dbo.usp_StartExam`: Safely generates an `InProgress` attempt with server timestamp.
  - `dbo.usp_SaveAnswer`: Uses `MERGE` to persist student answer choices with row-level transaction safety.
  - `dbo.usp_SubmitExam`: Calculates final score via SQL Server JOIN on `IsCorrect = 1` and closes attempt.
- **10 Triggers:** Enforce strict business constraints (preventing post-completion modification, enforcing single-choice integrity, and validating question counts).
- **2 Reporting Views:** `dbo.vw_StudentExamResults` and `dbo.vw_ExamStatistics`.
- **2 Covered Indexes:** `IX_ExamAssignments_Class_Dates` and `IX_StudentAnswers_Attempt_Question`.
- **Authoritative SQL Assets in Repo:**
  - `database/schema.sql`: Complete reproducible DDL.
  - `database/seed.sql`: 30 authentic English questions, 120 options, test users, classrooms, draft/published exams, and baseline student attempt.
  - `database/README.md`: Database architecture and data dictionary.

---

## 3. Portable Laptop Demonstration Architecture

The portable demonstration environment operates completely decoupled from host services and production endpoints:

| Component | Port | Technology | Isolation & Notes |
|---|---|---|---|
| **Frontend** | `3000` | Next.js 16 (React 19, Turbopack) | Detached WMI launcher, bound to `0.0.0.0` |
| **Backend API** | `8081` | Spring Boot 3.5 (Java 21) | Detached WMI launcher, standalone JAR |
| **Identity Service** | `8080` | Keycloak 26.4 (Docker) | Pre-configured realm (`englishexam-laptop`) |
| **Database** | `14333` | MS SQL Server 2025 Express (Docker) | Dedicated container `englishexam-laptop-sql` |
| **Network** | Loopback | No internet required | 100% offline-capable after local cache |

### Demonstration Credentials
- **Teacher:** `teacher` / `ExamDemo2026!` (Full Name: Minh Nguyễn, email: `teacher@exam.local`)
- **Student:** `student` / `ExamDemo2026!` (Full Name: An Trần, email: `student@exam.local`)
- **Outsider:** `outsider` / `ExamDemo2026!` (Full Name: Bình Lê, email: `outsider@exam.local`)

---

## 4. Automation & Process Lifecycle

### Bootstrap Orchestrator (`scripts/laptop-demo.ps1`)
Deterministic 7-stage automation pipeline:
1. **Prerequisite Check:** Validates Windows 10/11, Docker, Java 21, Node.js 20+, and port availability.
2. **Environment Setup:** Creates `.env.laptop` from `.env.laptop.example` if absent.
3. **Container Infrastructure:** Spins up `compose.laptop.yaml` and polls health for SQL Server (:14333) and Keycloak (:8080).
4. **Database Provisioning:** Applies `database/schema.sql` and `database/seed.sql`.
5. **Backend Compilation & Start:** Packages JAR with Maven wrapper and launches detached via WMI `Win32_Process.Create`.
6. **Frontend Build & Start:** Compiles standalone bundle and launches detached via WMI `Win32_Process.Create`.
7. **Health Verification & Launch:** Confirms backend `UP` and frontend `HTTP 200`, opens browser to `http://localhost:3000`.

### Teardown Script (`scripts/laptop-stop.ps1`)
- Terminates detached Next.js and Spring Boot processes using recorded PIDs.
- Gracefully shuts down Docker containers `englishexam-laptop-sql` and `englishexam-laptop-identity`.
- Preserves database volumes for instant subsequent startups.
- Ignores all production containers.

---

## 5. End-to-End Verification Test Results

### Test Suite: `frontend/tests/laptop-demo.spec.ts`
All 15 examination features verified in headless Chromium:

| # | Step / Feature | Component Verified | Result |
|---|---|---|---|
| 1 | Teacher Authentication | Keycloak OIDC PKCE Login | **PASS** |
| 2 | Classroom Management | `POST /api/teacher/classes` | **PASS** |
| 3 | Student Enrollment | `POST /api/teacher/classes/{id}/students` | **PASS** |
| 4 | Question Bank Management | Custom question with A/B/C/D choices | **PASS** |
| 5 | Exam Composition | Draft exam creation with questions | **PASS** |
| 6 | Exam Publication | Stored procedure `dbo.usp_PublishExam` | **PASS** |
| 7 | Exam Assignment | Classroom scheduling with active window | **PASS** |
| 8 | Student Authentication | Role authorization & student portal | **PASS** |
| 9 | Exam Discovery & Start | Stored procedure `dbo.usp_StartExam` | **PASS** |
| 10 | Real-time Answering | Stored procedure `dbo.usp_SaveAnswer` | **PASS** |
| 11 | State Persistence (Reload) | Browser refresh (**F5**) answer preservation | **PASS** |
| 12 | State Persistence Check | Selected radio options intact after reload | **PASS** |
| 13 | Exam Submission | Stored procedure `dbo.usp_SubmitExam` | **PASS** |
| 14 | Automatic SQL Scoring | Calculated score matched in SQL Server | **PASS** |
| 15 | Teacher Reporting | Gradebook & statistical view (`vw_ExamStatistics`) | **PASS** |

### Test Execution Times
- **Primary Workspace Execution:** `1 passed (7.7s)`
- **Clean-Clone Execution:** `1 passed (9.1s)`

---

## 6. Clean-Clone Acceptance Test

To guarantee 100% reproducibility on any target Windows 11 laptop, a clean-checkout acceptance test was performed in `C:\Temp\EnglishExam-CleanTest`:

1. **Clone:** Cloned directly from `https://github.com/thienlongdev/EnglishExam.git`.
2. **Path Audit:** Scanned entire codebase for hardcoded `C:\BTL-CSDL` paths — **0 hardcoded paths found**.
3. **Automated Launch:** Executed `.\scripts\laptop-demo.ps1 -Headless`.
   - Built backend executable JAR via `mvnw clean package -DskipTests`.
   - Installed frontend dependencies via `npm ci` (13s).
   - Compiled Next.js standalone bundle via `next build` (Turbopack).
   - SQL Server, Keycloak, Spring Boot, and Next.js became healthy.
4. **E2E Test Execution:** Ran `npx playwright test tests/laptop-demo.spec.ts` — **1 passed (9.1s)**.
5. **Teardown:** Executed `.\scripts\laptop-stop.ps1` — clean exit.
6. **Cleanup:** Removed temporary test directory `C:\Temp\EnglishExam-CleanTest`.

---

## 7. Production Isolation Confirmation

The following production components were verified to remain undisturbed and operational throughout the entire execution:

- **Vercel Production Deployment:** `https://english-exam-coursework.vercel.app` (Project `prj_gBzNA7EV8w2vOUrQ52vo3KyZYcTX` untouched).
- **Tailscale Funnel Endpoint:** `https://desktop-lf8r4ho.tail449656.ts.net` (Running continuously).
- **Windows Task Scheduler Jobs:** `EnglishExamWeb Stack`, `EnglishExamWeb Watchdog`, `EnglishExamWeb Keepalive` (Active and unchanged).
- **Production Docker Containers:**
  - `english-exam-web-sql` (Port 14339): Running continuously (Up 9+ hours).
  - `english-exam-web-identity` (Port 8180): Running continuously (Up 18+ hours).
  - `english-exam-demo-identity` (Port 8280): Running continuously (Up 9+ hours).
  - `englishcoach-ai-whisperx` (Port 8000): Running continuously (Up 18+ hours).

---

## 8. Conclusion

The `EnglishExam` project is fully published to GitHub with complete documentation, academic database integrity, and zero secret leakage. Any evaluator or instructor can clone the repository on a Windows 10/11 laptop and demonstrate the entire examination platform with one command:

```powershell
git clone https://github.com/thienlongdev/EnglishExam.git
cd EnglishExam
.\scripts\laptop-demo.ps1
```
