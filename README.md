# EnglishExam — Academic Online Examination Platform

[![Next.js](https://img.shields.io/badge/Frontend-Next.js%2016-black?style=flat&logo=next.js)](https://nextjs.org/)
[![Spring Boot](https://img.shields.io/badge/Backend-Spring%20Boot%203.5-brightgreen?style=flat&logo=springboot)](https://spring.io/projects/spring-boot)
[![SQL Server](https://img.shields.io/badge/Database-SQL%20Server%202025-blue?style=flat&logo=microsoftsqlserver)](https://www.microsoft.com/sql-server)
[![Keycloak](https://img.shields.io/badge/Identity-Keycloak%2026-orange?style=flat&logo=keycloak)](https://www.keycloak.org/)
[![Playwright](https://img.shields.io/badge/E2E-Playwright%20Tested-green?style=flat&logo=playwright)](https://playwright.dev/)

**EnglishExam** is an enterprise-grade, full-stack examination management system developed as an authoritative Database Coursework project. It features an immutable academic database architecture in third normal form (3NF), robust stored procedure business logic, audit triggers, and OIDC Authorization Code Flow with PKCE via Keycloak.

The repository provides both:
1. **A fully portable, offline-capable Windows laptop demonstration** that runs with a single PowerShell command (`.\scripts\laptop-demo.ps1`).
2. **Production-tested architecture** deployed to Vercel with dedicated backend tunneling, resilient watchdog recovery, and live classroom verification.

---

## 1. Quickstart — Portable Laptop Demo (One-Command Run)

You can clone this repository and spin up the complete full-stack environment on any Windows 10/11 laptop:

```powershell
# 1. Clone repository
git clone https://github.com/thienlongdev/EnglishExam.git
cd EnglishExam

# 2. Run the automated laptop demo orchestrator
.\scripts\laptop-demo.ps1
```

The script automatically starts the isolated Docker containers (SQL Server and Keycloak), applies the academic schema and seed data, starts the Spring Boot backend and Next.js frontend, performs health checks, and launches `http://localhost:3000` in your browser.

To safely stop all background processes and containers:
```powershell
.\scripts\laptop-stop.ps1
```

For detailed presentation instructions and troubleshooting, see the [Laptop Demonstration Runbook](docs/LAPTOP_DEMO.md).

---

## 2. Pre-configured Demonstration Accounts

All demonstration accounts are pre-configured in the local Keycloak realm (`englishexam-laptop`) and pre-seeded in the database:

| Role | Username | Password | Full Name | Academic Function |
|---|---|---|---|---|
| **Giảng viên (Teacher)** | `teacher` | `ExamDemo2026!` | Minh Nguyễn | Quản lý câu hỏi, tạo đề, công bố đề (`usp_PublishExam`), giao lớp, xem thống kê |
| **Học viên (Student)** | `student` | `ExamDemo2026!` | An Trần | Đã ghi danh lớp `WEB-ENG-01`, làm bài (`usp_StartExam`), lưu đáp án (`usp_SaveAnswer`), nộp bài (`usp_SubmitExam`), xem điểm |
| **Học viên tự do (Outsider)** | `outsider` | `ExamDemo2026!` | Bình Lê | Tài khoản chưa vào lớp (chứng minh kiểm soát quyền truy cập đề thi theo lớp) |

---

## 3. Architecture & Environment Comparison

The application strictly separates the portable demonstration environment from the production deployment:

| Component | Portable Laptop Demo | Production Deployment |
|---|---|---|
| **Frontend** | Local Next.js 16 (`http://localhost:3000`) | Vercel (`https://english-exam-coursework.vercel.app`) |
| **Backend API** | Local Spring Boot 3.5 (`http://localhost:8081`) | Dedicated PC Spring Boot (`https://desktop-lf8r4ho.tail449656.ts.net`) |
| **Database** | Docker SQL Server (`127.0.0.1:14333`, `EnglishExamDB_Demo`) | Host SQL Server (`14339`, `EnglishExamDB_Demo`) |
| **Identity / OIDC** | Docker Keycloak (`http://localhost:8080`, realm `englishexam-laptop`) | Host Keycloak (`8180`, realm `EnglishExam`) |
| **Public Tunnel** | **None** (100% offline loopback) | Tailscale Funnel HTTPS |
| **Orchestration** | `scripts/laptop-demo.ps1` & `compose.laptop.yaml` | Windows Task Scheduler + Watchdog Daemon |

---

## 4. Academic Database Integrity (Immutable 3NF Schema)

The database schema strictly adheres to the submitted coursework specification and contains **no JPA DDL generation, dynamic schema alteration, or ad-hoc table creation**:

- **10 Relational Tables:** `Users`, `Classes`, `ClassEnrollments`, `Questions`, `AnswerOptions`, `Exams`, `ExamQuestions`, `ExamAssignments`, `ExamAttempts`, `StudentAnswers`.
- **4 Stored Procedures:**
  - `dbo.usp_PublishExam`: Validates 100-point total and publishes draft exams.
  - `dbo.usp_StartExam`: Creates tracked student attempt with server timestamp.
  - `dbo.usp_SaveAnswer`: Atomically merges student answer choices during the active exam.
  - `dbo.usp_SubmitExam`: Calculates final score via SQL Server JOIN on `IsCorrect = 1` and closes attempt.
- **10 Triggers:** Enforce cross-table constraints, question count validations, and prevent post-completion modifications.
- **2 Reporting Views:** `dbo.vw_StudentExamResults`, `dbo.vw_ExamStatistics`.
- **2 Covered Indexes:** Optimized for exam assignments and student submission lookups.
- **Security:** Strict least-privilege `ExamOperator` role.

The authoritative schema and seed scripts are located in [`database/`](database/):
- [`database/schema.sql`](database/schema.sql): Complete DDL, stored procedures, triggers, views, and security role.
- [`database/seed.sql`](database/seed.sql): 30 authentic English questions (Grammar, Vocabulary, Reading, Listening), 120 answer options (A/B/C/D), classrooms, draft/published exams, and baseline student attempt.
- [`database/README.md`](database/README.md): Detailed relational documentation, ERD, and data dictionary.

---

## 5. 15 Core Examination Features Demonstrated

The application provides a complete real-world examination lifecycle:

1. **Teacher Login:** Keycloak OIDC Authentication Code Flow with PKCE.
2. **Student Login:** Role-based authorization distinguishing teacher and student dashboards.
3. **Classroom Creation & Management:** Code-based classroom generation with teacher ownership.
4. **Student Enrollment:** Enrolling students into classrooms with duplicate protection.
5. **Question Bank Management:** Creating questions with 4 answer choices (A, B, C, D) and difficulty levels.
6. **Exam Creation & Editing:** Composing exams from question bank with assigned point distributions.
7. **Exam Publication (`usp_PublishExam`):** Strict procedure validation ensuring total score equals 100 before publishing.
8. **Class Assignments:** Scheduling exams for specific classrooms with configurable start and end windows.
9. **Student Discovery:** Dynamic listing of active exams based on enrolled classes.
10. **Exam Attempt Initialization (`usp_StartExam`):** Secure procedure-driven attempt tracking.
11. **Answer Persistence & Autosave (`usp_SaveAnswer`):** Immediate transactional save per question; answers persist across browser refreshes (**F5**).
12. **Exam Submission (`usp_SubmitExam`):** One-click submission closing the examination window.
13. **Automatic SQL Server Scoring:** Real-time scoring computed directly in the database engine.
14. **Student Result History:** Instant feedback and historical attempt transcripts (`vw_StudentExamResults`).
15. **Teacher Reporting:** Real-time gradebook, class pass rates, and score distributions (`vw_ExamStatistics`).

---

## 6. Automated End-to-End Verification

A comprehensive Playwright test verifies all 15 core features against the running laptop stack:

```powershell
cd frontend
npx playwright test tests/laptop-demo.spec.ts
```

Output:
```
Running 1 test using 1 worker
  [chromium] › tests/laptop-demo.spec.ts:18:7 › Portable Windows Laptop Demonstration Suite › complete E2E lifecycle (15 features)
  1 passed (7.7s)
```

---

## 7. Prerequisites & Offline Operation

### Prerequisites
- **OS:** Windows 10 / 11 (64-bit)
- **PowerShell:** Version 5.1+ or 7+
- **Docker Desktop:** Running Linux containers (with at least 4 GB RAM)
- **JDK:** Java 21 (`java -version`)
- **Node.js:** v20.x or v22.x with `npm`

### Offline Capabilities & Limitations
- **True Offline Execution:** Once the Docker images (`mssql/server:2025-latest`, `keycloak:26.0`), Maven dependencies, and npm packages are cached locally, the laptop stack requires **zero internet access**.
- **Self-Contained Identity:** Keycloak runs locally on port `8080` with embedded H2 database and pre-imported realm JSON (`config/keycloak/realm-export.json`).
- **No Remote Telemetry:** The application does not contact any external cloud servers during demo execution.

---

## 8. Repository Layout

```
EnglishExam/
├── .env.laptop.example             # Clean environment template for laptop demo
├── .gitignore                      # Strict exclusion of secrets, caches, and binaries
├── compose.laptop.yaml             # Isolated Docker Compose (SQL Server :14333, Keycloak :8080)
├── compose.yaml                    # Base developer compose
├── README.md                       # Main project documentation
├── backend/                        # Spring Boot 3.5 Java 21 Application
│   ├── src/main/java/              # Domain entities, repositories, controllers, security
│   ├── src/main/resources/         # application.yml and profile configs
│   ├── pom.xml                     # Maven project specification
│   └── mvnw, mvnw.cmd              # Maven wrapper
├── frontend/                       # Next.js 16 (React 19, TypeScript) Application
│   ├── src/app/                    # App Router pages (login, dashboard, exam, results)
│   ├── src/components/             # UI components and design system
│   ├── tests/                      # Playwright E2E test suites
│   │   └── laptop-demo.spec.ts     # 15-feature laptop verification suite
│   ├── package.json                # Dependencies and scripts
│   └── playwright.config.ts        # Test runner configuration
├── database/                       # Immutable Academic SQL Schema & Seed
│   ├── schema.sql                  # Authoritative DDL (10 tables, 4 procs, 10 triggers, 2 views)
│   ├── seed.sql                    # Authoritative demonstration seed data
│   └── README.md                   # Database architecture & ERD documentation
├── config/                         # Portable Service Configurations
│   └── keycloak/
│       └── realm-export.json       # Pre-configured Keycloak realm with demo accounts
├── docs/                           # Documentation & Runbooks
│   ├── LAPTOP_DEMO.md              # In-depth Windows laptop presentation runbook
│   ├── DEPLOYMENT.md               # Cloud and production deployment guide
│   └── PUBLIC_DEMO_RUNBOOK.md      # Live production demo administration runbook
└── scripts/                        # Automation & Control Scripts
    ├── laptop-demo.ps1             # One-command laptop bootstrap & health check orchestrator
    └── laptop-stop.ps1             # Clean teardown script for laptop demo
```

---

## 9. Security & Secret Governance

- **Zero Secret Leakage:** No real production credentials, API keys, database connection strings, certificates, or `.bak` files are tracked in version control.
- **Audit Exclusion:** All `.env`, `.local/`, `evidence/`, `release/`, `node_modules/`, `target/`, and `*.pid` files are strictly excluded via `.gitignore`.
- **Local Isolated Credentials:** Passwords used in the laptop demonstration (`ExamDemo2026!`, `LaptopDemo2026!`) are development-only placeholders scoped to local loopback ports.

---

## 10. License & Academic Attribution

This project was developed for the Database Coursework examination (BTL Môn Cơ Sở Dữ Liệu). All rights reserved.
- Author: `thienlongdev`
- Repository: [https://github.com/thienlongdev/EnglishExam](https://github.com/thienlongdev/EnglishExam)
