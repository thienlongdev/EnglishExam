# EnglishExam — Portable Windows Laptop Demonstration Runbook

This guide is the authoritative operational runbook for running, demonstrating, and evaluating the **EnglishExam** web application on an isolated Windows 10/11 laptop without internet connectivity or dependencies on external servers.

---

## 1. Quick Reference & Demo Credentials

| Role | Username | Password | Email | Full Name | Academic Function |
|---|---|---|---|---|---|
| **Giảng viên (Teacher)** | `teacher` | `ExamDemo2026!` | `teacher@exam.local` | Minh Nguyễn | Quản lý câu hỏi, tạo đề, công bố đề, giao đề cho lớp, xem thống kê & kết quả |
| **Học viên (Student)** | `student` | `ExamDemo2026!` | `student@exam.local` | An Trần | Đã ghi danh lớp `WEB-ENG-01`, xem danh sách đề thi, làm bài, nộp bài, xem lịch sử điểm |
| **Học viên tự do (Outsider)** | `outsider` | `ExamDemo2026!` | `outsider@exam.local` | Bình Lê | Học viên chưa vào lớp (chứng minh phân quyền ghi danh & không thấy đề riêng của lớp) |

### Service URLs & Endpoints

| Service | Local URL | Port | Health Check |
|---|---|---|---|
| **Frontend (Next.js)** | `http://localhost:3000` | `3000` | `GET http://localhost:3000/api/health` |
| **Backend (Spring Boot)** | `http://localhost:8081` | `8081` | `GET http://localhost:8081/actuator/health` |
| **Identity (Keycloak)** | `http://localhost:8080` | `8080` | `GET http://localhost:8080/realms/englishexam-laptop` |
| **Database (SQL Server)** | `127.0.0.1:14333` | `14333` | `TCP 14333` (Database: `EnglishExamDB_Demo`) |

---

## 2. Prerequisites & Environment Check

Before starting the demonstration on a Windows laptop, ensure the following components are installed:

1. **Operating System:** Windows 10 / 11 (64-bit).
2. **PowerShell:** PowerShell 5.1 or PowerShell 7+ (run with normal user or Administrator privileges).
3. **Docker Desktop:** Installed, running Linux containers, with at least 4 GB RAM allocated.
4. **Java Development Kit (JDK):** Java 21 (`java -version` returns `openjdk 21` or `Java 21`).
5. **Node.js:** Node.js v20.x or v22.x with `npm` installed.
6. **Git:** Installed with credential manager or command line tool.

> [!NOTE]
> **Offline Preparedness:** Docker images (`mcr.microsoft.com/mssql/server:2025-latest` and `quay.io/keycloak/keycloak:26.0`), Maven dependencies, and npm packages must be fetched at least once while online. Once cached on the laptop, the application runs 100% offline without internet connection.

---

## 3. One-Command Automated Setup (`laptop-demo.ps1`)

To start the entire stack from scratch:

```powershell
# Open PowerShell in the repository root directory
cd EnglishExam

# Execute the orchestrator script
.\scripts\laptop-demo.ps1
```

### Script Execution Stages

The script automatically executes a 7-stage deterministic bootstrap process:

1. **Pre-flight Check:** Validates Docker, Java 21, Node.js, and network ports (`14333`, `8080`, `8081`, `3000`).
2. **Environment Configuration:** Automatically creates `.env.laptop` from `.env.laptop.example` if not present.
3. **Container Infrastructure:** Spins up `compose.laptop.yaml` containing:
   - `englishexam-laptop-sql` on port `14333`.
   - `englishexam-laptop-identity` on port `8080` (pre-configured with realm `englishexam-laptop`).
4. **Database Provisioning:**
   - Waits for SQL Server to accept connections.
   - Creates database `EnglishExamDB_Demo` and schema user `exam_app`.
   - Executes authoritative `database/schema.sql` (10 tables, 4 procs, 10 triggers, 2 views, 2 indexes).
   - Executes authoritative `database/seed.sql` (30 questions, 120 options, test users, classes, sample exam).
5. **Backend Compilation & Startup:**
   - Compiles `backend` with Maven (`mvnw clean package -DskipTests`) if the executable JAR is missing.
   - Starts Spring Boot detached in the background on port `8081`.
   - Polls `/actuator/health` until status is `UP`.
6. **Frontend Build & Startup:**
   - Installs dependencies (`npm ci`) and builds standalone Next.js (`npm run build`) if `.next/standalone` is missing.
   - Starts Next.js detached in the background on port `3000` bound to `0.0.0.0`.
   - Polls `/api/health` until status is `OK`.
7. **Ready Banner & Browser Launch:**
   - Prints operational summary and test credentials.
   - Automatically opens the default browser to `http://localhost:3000`.

---

## 4. Step-by-Step Presentation & Evaluation Walkthrough

Follow these sequential steps during a live demonstration or coursework evaluation:

### Stage A: Teacher Workflow (Content & Exam Management)
1. **Teacher Login:**
   - Visit `http://localhost:3000`.
   - Click **Đăng nhập với Keycloak** (Sign in with Keycloak).
   - Authenticate with username `teacher` and password `ExamDemo2026!`.
   - Verify that the portal loads with the teacher dashboard showing classes, question bank, and exam manager.
2. **Classroom Management:**
   - Navigate to the **Lớp học** (Classrooms) tab.
   - Click **Tạo lớp** (Create Class).
   - Enter Class Name `Tiếng Anh Kỹ Thuật 2026` and Class Code `ENG-TECH-01`.
   - Submit and verify the class appears immediately in the card grid.
   - Open classroom details and enroll student `An Trần` (`student@exam.local`).
3. **Question Bank (30 Pre-seeded Questions + Custom Creation):**
   - Navigate to **Ngân hàng câu hỏi** (Question Bank).
   - Review pre-seeded academic questions spanning grammar, vocabulary, reading, and listening.
   - Click **Thêm câu hỏi** (Add Question).
   - Enter question text: `"She enjoys _____ to classical music in the evening."`
   - Select Category: `Grammar`, Difficulty: `Easy`.
   - Provide 4 options:
     - Option A: `listening` (Checked as Correct)
     - Option B: `to listen`
     - Option C: `listen`
     - Option D: `listened`
   - Save and verify the question is stored in the database.
4. **Exam Drafting & Procedure Publication:**
   - Navigate to **Quản lý đề thi** (Exam Management).
   - Observe existing pre-seeded exam `DRAFT-ENG-01` (Draft) and `WEB-FOUNDATION` (Published).
   - Select `DRAFT-ENG-01` or create a new draft exam with 5 questions.
   - Click **Công bố đề thi** (Publish Exam).
   - *Under the hood:* This triggers stored procedure `dbo.usp_PublishExam`, validating that the exam has valid questions, total points equal 100, and transitions status from `Draft` to `Published`.
5. **Exam Assignment:**
   - In the published exam management panel, assign the exam to class `WEB-ENG-01` (and newly created `ENG-TECH-01`).
   - Specify start time (now) and end time (+24 hours).
   - Save assignment.

### Stage B: Student Workflow (Examination & State Persistence)
6. **Logout Teacher & Login Student:**
   - Click user menu in upper right and select **Đăng xuất** (Log out).
   - Login with username `student` and password `ExamDemo2026!`.
7. **Exam Discovery:**
   - The student dashboard shows assigned exams for enrolled classes (`WEB-ENG-01`).
   - Notice that unassigned exams or drafts are not accessible.
8. **Start Examination via Stored Procedure:**
   - Click **Bắt đầu làm bài** (Start Exam).
   - *Under the hood:* Calls `dbo.usp_StartExam`, which creates an active attempt in `dbo.ExamAttempts` with `StartTime = GETDATE()`, `Status = 'InProgress'`, and calculates `MaxPoints`.
9. **Interactive Answering & Autosave (`usp_SaveAnswer`):**
   - Select Option A for Question 1.
   - Observe status indicator `"Đã lưu đáp án"` (Answer saved).
   - Select Option B for Question 2.
   - *Under the hood:* Stored procedure `dbo.usp_SaveAnswer` executes `MERGE` on `dbo.StudentAnswers` inside SQL Server transaction with row-level locks.
10. **State Persistence on Browser Reload:**
    - Press **F5** or reload the page in browser.
    - Confirm the examination view reloads seamlessly with all previously selected radio options pre-selected and timer intact.
11. **Exam Submission & Automatic SQL Scoring (`usp_SubmitExam`):**
    - Click **Nộp bài** (Submit Exam) and confirm the prompt.
    - *Under the hood:* Stored procedure `dbo.usp_SubmitExam` performs:
      - Validates attempt is still `InProgress`.
      - Computes earned points by joining `dbo.StudentAnswers` with `dbo.AnswerOptions` where `IsCorrect = 1`.
      - Sets `Status = 'Completed'`, `EndTime = GETDATE()`, and writes final `Score`.
12. **Student Result History:**
    - View the instant result screen showing score (e.g., `80.00 / 100` or `100.00 / 100`).
    - Navigate to **Lịch sử thi** (Exam History) to view past completed attempts backed by view `dbo.vw_StudentExamResults`.

### Stage C: Verification & Reporting
13. **Teacher Reports:**
    - Log back in as `teacher`.
    - Open **Kết quả & Thống kê** (Results & Statistics).
    - Review student submissions filterable by Class and Exam, powered by view `dbo.vw_ExamStatistics`.

---

## 5. Automated End-to-End Verification (`laptop-demo.spec.ts`)

To execute the automated regression test suite covering all 15 exam features in a real headless Chromium browser:

```powershell
# From the repository root:
cd frontend
npx playwright test tests/laptop-demo.spec.ts
```

### Expected Output

```
Running 1 test using 1 worker
  [chromium] › tests/laptop-demo.spec.ts:18:7 › Portable Windows Laptop Demonstration Suite › complete E2E lifecycle (15 features)
  1 passed (7.7s)
```

The automated test verifies:
- Keycloak OIDC authentication with teacher credentials.
- Classroom creation and student enrollment.
- Custom question creation with A/B/C/D answer options.
- Exam drafting, addition of questions, and publication via `usp_PublishExam`.
- Assignment to class.
- Keycloak OIDC authentication with student credentials.
- Exam discovery, start via `usp_StartExam`, answer selection via `usp_SaveAnswer`.
- Page reload verification (answer persistence).
- Submission via `usp_SubmitExam`.
- SQL Server scoring computation verification.
- Teacher gradebook viewing.

---

## 6. Teardown & Clean Stop (`laptop-stop.ps1`)

To cleanly stop the laptop demonstration without leaving orphaned background processes:

```powershell
# From the repository root:
.\scripts\laptop-stop.ps1
```

### What `laptop-stop.ps1` Does:
- Stops the detached Spring Boot process (killing PID stored in `.local\laptop-backend.pid` and freeing port `8081`).
- Stops the detached Next.js process (killing PID stored in `.local\laptop-frontend.pid` and freeing port `3000`).
- Stops and shuts down Docker containers `englishexam-laptop-sql` and `englishexam-laptop-identity`.
- Preserves database volumes and transaction logs for subsequent restarts.
- Safely ignores production containers (`english-exam-web-sql`, `english-exam-web-identity`, etc.).

---

## 7. Troubleshooting & FAQ

### Problem 1: Port Collision on Startup (`14333`, `8080`, `8081`, or `3000`)
**Symptom:** `laptop-demo.ps1` reports `Port [PORT] is already in use by process [PID]`.
**Solution:**
Identify the occupying process:
```powershell
Get-NetTCPConnection -LocalPort 14333,8080,8081,3000 -ErrorAction SilentlyContinue | Format-Table LocalAddress,LocalPort,OwningProcess
```
If it is a leftover demo process, stop it with:
```powershell
Stop-Process -Id [PID] -Force
```

### Problem 2: Docker Daemon Not Running
**Symptom:** `docker compose` returns `error during connect: This error may indicate that the docker daemon is not running`.
**Solution:** Launch Docker Desktop from the Start Menu and wait until the whale icon in the Windows taskbar tray becomes steady green.

### Problem 3: Keycloak Container Fails to Start
**Symptom:** Health check times out waiting for Keycloak port 8080.
**Solution:** Check container logs:
```powershell
docker logs englishexam-laptop-identity
```
Ensure that the exported realm file `config/keycloak/realm-export.json` has not been corrupted and port `8080` is not blocked by Windows Defender Firewall.

### Problem 4: Resetting the Database to Clean State
To wipe all student test submissions and restore the pristine seed state:
```powershell
docker exec -i englishexam-laptop-sql /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P 'LaptopDemo2026!' -C -d EnglishExamDB_Demo -i /var/opt/mssql/scripts/seed.sql
```
Alternatively, remove Docker volumes to perform a fresh initialization:
```powershell
docker compose -f compose.laptop.yaml down -v
.\scripts\laptop-demo.ps1
```

### Problem 5: Adding a Custom Student or Teacher Account
1. Open Keycloak Administration Console at `http://localhost:8080/admin`.
2. Login with `admin` / `admin`.
3. Select realm `englishexam-laptop`.
4. Go to **Users** -> **Add user**. Set username, email, first name, last name, and set Email verified to `True`.
5. Go to **Credentials** -> Set password (e.g. `ExamDemo2026!`) with Temporary set to `Off`.
6. Go to **Role mapping** -> Assign client roles under `english-exam-web`:
   - Add role `TEACHER` for teacher access.
   - Add role `STUDENT` for student access.
7. The user can now immediately log in via `http://localhost:3000`. On first login, the application automatically provisions the matching record into SQL Server `dbo.Users`.
