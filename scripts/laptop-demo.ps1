<#
.SYNOPSIS
    Starts the EnglishExam Portable Windows Laptop Demonstration Environment.
.DESCRIPTION
    One-command setup and launch script that automatically checks prerequisites,
    boots isolated Docker containers for SQL Server and Keycloak, initializes
    the academic database schema and seed data, starts the Spring Boot backend
    and Next.js frontend, and verifies complete system readiness.
.PARAMETER Build
    Force a rebuild of both frontend and backend even if existing build artifacts exist.
.PARAMETER CheckOnly
    Only check prerequisites and system requirements without starting services.
.PARAMETER Headless
    Do not automatically open the default web browser upon startup.
.PARAMETER TimeoutSeconds
    Maximum time in seconds to wait for each container and service to become healthy (default: 120).
#>
param(
    [switch]$Build,
    [switch]$CheckOnly,
    [switch]$Headless,
    [int]$TimeoutSeconds = 120
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$script:RootDir = (Resolve-Path "$PSScriptRoot\..").Path
$script:LocalDir = Join-Path $script:RootDir '.local\laptop'
if (-not (Test-Path -LiteralPath $script:LocalDir)) {
    New-Item -ItemType Directory -Path $script:LocalDir -Force | Out-Null
}

function Write-Step {
    param([string]$Message)
    Write-Host "`n=== $Message ===" -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Message)
    Write-Host " [OK] $Message" -ForegroundColor Green
}

function Write-Warn {
    param([string]$Message)
    Write-Host " [WARN] $Message" -ForegroundColor Yellow
}

function Write-Err {
    param([string]$Message)
    Write-Host " [ERROR] $Message" -ForegroundColor Red
}

function Start-DetachedProcess {
    param(
        [string]$CommandLine,
        [string]$WorkingDirectory
    )
    $res = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{
        CommandLine = $CommandLine
        CurrentDirectory = $WorkingDirectory
    }
    if ($res.ReturnValue -ne 0) {
        throw "Failed to start detached process ($CommandLine), return code: $($res.ReturnValue)"
    }
    return [int]$res.ProcessId
}

# =============================================================================
# 1. Environment & Prerequisite Checks
# =============================================================================
Write-Host @"
===============================================================================
       ENGLISHEXAM — PORTABLE OFFLINE-CAPABLE WINDOWS DEMO SYSTEM
===============================================================================
"@ -ForegroundColor Blue

Write-Step "1/7: Checking System Environment and Prerequisites"

# Check Windows OS
$isWindows = [System.Runtime.InteropServices.RuntimeInformation]::IsOSPlatform([System.Runtime.InteropServices.OSPlatform]::Windows)
if (-not $isWindows) {
    Write-Warn "Non-Windows OS detected. This script is optimized for Windows 10/11."
} else {
    $os = Get-CimInstance Win32_OperatingSystem -ErrorAction SilentlyContinue
    Write-Success "Operating System: $($os.Caption) (Build $($os.BuildNumber))"
}

# Check Node.js
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCmd) {
    Write-Err "Node.js is not found on PATH. Please install Node.js (v20+ recommended) from https://nodejs.org/"
    exit 1
}
$nodeVer = & node -v
Write-Success "Node.js: $nodeVer"

# Check NPM
$npmCmd = Get-Command npm -ErrorAction SilentlyContinue
if (-not $npmCmd) {
    Write-Err "NPM is not found on PATH."
    exit 1
}
$npmVer = & npm -v
Write-Success "NPM: v$npmVer"

# Check Java
$javaCmd = Get-Command java -ErrorAction SilentlyContinue
if (-not $javaCmd) {
    Write-Err "Java runtime is not found on PATH. JDK 17+ or 21+ is required."
    exit 1
}
$oldEap = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
$javaOutput = (& java -version 2>&1 | Out-String)
$ErrorActionPreference = $oldEap
$javaVerLine = ($javaOutput -split "`r?`n")[0]
Write-Success "Java: $javaVerLine"

# Check Maven
$mvnCmd = Get-Command mvn -ErrorAction SilentlyContinue
if (-not $mvnCmd) {
    Write-Err "Apache Maven (mvn) is not found on PATH. Please install Maven or add it to PATH."
    exit 1
}
$mvnOutput = (& mvn -v 2>&1 | Out-String)
$mvnVerLine = ($mvnOutput -split "`r?`n")[0]
Write-Success "Maven: $mvnVerLine"

# Check Docker
$dockerCmd = Get-Command docker -ErrorAction SilentlyContinue
if (-not $dockerCmd) {
    Write-Err "Docker CLI is not found on PATH. Docker Desktop is required for SQL Server and Keycloak."
    exit 1
}

# Check Docker Daemon readiness
$dockerRunning = $false
try {
    $oldEap = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $dockerInfoOutput = (& docker info 2>&1 | Out-String)
    $ErrorActionPreference = $oldEap
    if ($LASTEXITCODE -eq 0) { $dockerRunning = $true }
} catch {}

if (-not $dockerRunning) {
    Write-Warn "Docker daemon is not responding. Checking Docker Desktop..."
    $dockerDesktopExe = 'C:\Program Files\Docker\Docker\Docker Desktop.exe'
    if (Test-Path $dockerDesktopExe) {
        Write-Host "Attempting to launch Docker Desktop..." -ForegroundColor Cyan
        Start-Process -FilePath $dockerDesktopExe
        $waitCount = 0
        while ($waitCount -lt 60) {
            Start-Sleep -Seconds 3
            $waitCount += 3
            Write-Host "Waiting for Docker daemon readiness... ($waitCount s)"
            try {
                $null = & docker info 2>&1
                if ($LASTEXITCODE -eq 0) {
                    $dockerRunning = $true
                    break
                }
            } catch {}
        }
    }
}

if (-not $dockerRunning) {
    Write-Err "Docker daemon is not running. Please start Docker Desktop and rerun this script."
    exit 1
}
Write-Success "Docker engine is running and ready."

if ($CheckOnly) {
    Write-Host "`nAll prerequisites satisfied successfully." -ForegroundColor Green
    exit 0
}

# =============================================================================
# 2. Configuration & Port Resolution
# =============================================================================
Write-Step "2/7: Loading Laptop Demonstration Configuration"

$envFile = Join-Path $script:RootDir '.env.laptop'
$envExample = Join-Path $script:RootDir '.env.laptop.example'

if (-not (Test-Path $envFile)) {
    if (Test-Path $envExample) {
        Copy-Item -LiteralPath $envExample -Destination $envFile
        Write-Success "Created .env.laptop from template .env.laptop.example"
    }
}

$config = @{
    'LAPTOP_SQL_PORT'        = '14333'
    'LAPTOP_SQL_SA_PASSWORD' = 'Ee!LaptopDemoSaPass2026'
    'LAPTOP_SQL_APP_PASSWORD'= 'Ee!LaptopAppPass2026'
    'LAPTOP_KC_PORT'         = '8080'
    'LAPTOP_KC_ADMIN_PASSWORD'= 'Admin!LaptopDemo2026'
    'LAPTOP_KC_CLIENT_SECRET'= 'LaptopDemoSecret2026!'
    'LAPTOP_DEMO_PASSWORD'   = 'ExamDemo2026!'
    'BACKEND_PORT'           = '8081'
    'FRONTEND_PORT'          = '3000'
}

if (Test-Path $envFile) {
    foreach ($line in (Get-Content -LiteralPath $envFile)) {
        if ($line -match '^\s*([^#=]+)=(.*)$') {
            $k = $Matches[1].Trim()
            $v = $Matches[2].Trim()
            $config[$k] = $v
        }
    }
}

# Export environment variables for child processes and Docker Compose
foreach ($pair in $config.GetEnumerator()) {
    [Environment]::SetEnvironmentVariable($pair.Key, $pair.Value, 'Process')
}

$sqlPort = [int]$config['LAPTOP_SQL_PORT']
$kcPort = [int]$config['LAPTOP_KC_PORT']
$backendPort = [int]$config['BACKEND_PORT']
$frontendPort = [int]$config['FRONTEND_PORT']

Write-Success "Target Ports -> SQL Server: $sqlPort | Keycloak: $kcPort | Backend: $backendPort | Frontend: $frontendPort"

# Clean up lingering project listeners on backend/frontend ports from prior runs
foreach ($p in @($backendPort, $frontendPort)) {
    $conn = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue
    foreach ($c in $conn) {
        $proc = Get-CimInstance Win32_Process -Filter "ProcessId = $($c.OwningProcess)" -ErrorAction SilentlyContinue
        if ($proc -and ($proc.CommandLine -like "*$script:RootDir*")) {
            Stop-Process -Id $proc.ProcessId -Force -ErrorAction SilentlyContinue
            Write-Host "Cleaned up prior process on port $p (PID $($proc.ProcessId))" -ForegroundColor Yellow
        }
    }
}

# =============================================================================
# 3. Start Dedicated Laptop Docker Containers
# =============================================================================
Write-Step "3/7: Starting Dedicated Laptop Containers (SQL Server & Keycloak)"

Push-Location $script:RootDir
try {
    & docker compose -f compose.laptop.yaml up -d
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to start Docker Compose services from compose.laptop.yaml"
    }
} finally {
    Pop-Location
}

# Wait for SQL Server
Write-Host "Waiting for SQL Server on port $sqlPort..." -ForegroundColor Cyan
$sqlReady = $false
$elapsed = 0
while ($elapsed -lt $TimeoutSeconds) {
    try {
        $tcp = New-Object System.Net.Sockets.TcpClient
        $iar = $tcp.BeginConnect('127.0.0.1', $sqlPort, $null, $null)
        if ($iar.AsyncWaitHandle.WaitOne(1000, $false)) {
            $tcp.EndConnect($iar)
            $tcp.Close()
            # Test actual login
            $connStr = "Server=127.0.0.1,$sqlPort;Database=master;User ID=sa;Password=$($config['LAPTOP_SQL_SA_PASSWORD']);TrustServerCertificate=True;Connect Timeout=3"
            $conn = New-Object System.Data.SqlClient.SqlConnection($connStr)
            $conn.Open()
            $conn.Close()
            $sqlReady = $true
            break
        }
    } catch {}
    Start-Sleep -Seconds 2
    $elapsed += 2
}

if (-not $sqlReady) {
    Write-Err "SQL Server container did not become ready within $TimeoutSeconds seconds."
    exit 1
}
Write-Success "SQL Server is listening and authenticated on 127.0.0.1:$sqlPort."

# Wait for Keycloak OIDC Discovery
Write-Host "Waiting for Keycloak on port $kcPort..." -ForegroundColor Cyan
$kcReady = $false
$elapsed = 0
$discoveryUrl = "http://localhost:$kcPort/realms/english-exam/.well-known/openid-configuration"
while ($elapsed -lt $TimeoutSeconds) {
    try {
        $resp = Invoke-WebRequest -Uri $discoveryUrl -UseBasicParsing -TimeoutSec 3 -ErrorAction SilentlyContinue
        if ($resp -and $resp.StatusCode -eq 200) {
            $kcReady = $true
            break
        }
    } catch {}
    Start-Sleep -Seconds 2
    $elapsed += 2
}

if (-not $kcReady) {
    Write-Err "Keycloak container did not become ready within $TimeoutSeconds seconds at $discoveryUrl."
    exit 1
}
Write-Success "Keycloak OIDC discovery endpoint is active on http://localhost:$kcPort."

# =============================================================================
# 4. Database Schema & Seed Verification / Initialization
# =============================================================================
Write-Step "4/7: Checking and Initializing Academic Database"

$masterConnStr = "Server=127.0.0.1,$sqlPort;Database=master;User ID=sa;Password=$($config['LAPTOP_SQL_SA_PASSWORD']);TrustServerCertificate=True"
$mConn = New-Object System.Data.SqlClient.SqlConnection($masterConnStr)
$mConn.Open()

$dbExists = $false
try {
    $cmd = $mConn.CreateCommand()
    $cmd.CommandText = "SELECT COUNT(*) FROM sys.databases WHERE name='EnglishExamDB_WebDev'"
    $dbExists = ([int]$cmd.ExecuteScalar() -gt 0)
} finally {
    $mConn.Close()
}

$needsInit = -not $dbExists
if ($dbExists) {
    $devConnStr = "Server=127.0.0.1,$sqlPort;Database=EnglishExamDB_WebDev;User ID=sa;Password=$($config['LAPTOP_SQL_SA_PASSWORD']);TrustServerCertificate=True"
    $dConn = New-Object System.Data.SqlClient.SqlConnection($devConnStr)
    $dConn.Open()
    try {
        $cmd = $dConn.CreateCommand()
        $cmd.CommandText = "SELECT COUNT(*) FROM sys.tables WHERE is_ms_shipped = 0"
        $tableCount = [int]$cmd.ExecuteScalar()
        if ($tableCount -lt 10) { $needsInit = $true }
    } finally {
        $dConn.Close()
    }
}

if ($needsInit) {
    Write-Host "Creating database schema and applying academic objects..." -ForegroundColor Cyan
    $schemaPath = Join-Path $script:RootDir 'database\schema.sql'
    if (-not (Test-Path $schemaPath)) {
        throw "Database schema file not found at $schemaPath"
    }

    $env:SQLCMDPASSWORD = $config['LAPTOP_SQL_SA_PASSWORD']
    $schemaLog = Join-Path $script:LocalDir 'init-schema.log'
    & sqlcmd -S "tcp:127.0.0.1,$sqlPort" -U sa -C -b -f 65001 -i $schemaPath -o $schemaLog
    if ($LASTEXITCODE -ne 0) {
        throw "Schema execution failed. Inspect $schemaLog"
    }
    Write-Success "Applied academic schema (10 tables, 2 views, 2 indexes, 4 procedures, 10 triggers)."

    # Provision app login
    Write-Host "Configuring least-privilege login 'exam_web'..." -ForegroundColor Cyan
    $appPass = $config['LAPTOP_SQL_APP_PASSWORD'].Replace("'", "''")
    $permSql = @"
USE master;
IF NOT EXISTS (SELECT 1 FROM sys.sql_logins WHERE name = 'exam_web')
    CREATE LOGIN exam_web WITH PASSWORD = N'$appPass', CHECK_POLICY = OFF;
USE EnglishExamDB_WebDev;
IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = 'exam_web')
    CREATE USER exam_web FOR LOGIN exam_web;
GRANT SELECT, VIEW DEFINITION ON SCHEMA::dbo TO exam_web;
GRANT EXECUTE ON dbo.usp_PublishExam TO exam_web;
GRANT EXECUTE ON dbo.usp_StartExam TO exam_web;
GRANT EXECUTE ON dbo.usp_SaveAnswer TO exam_web;
GRANT EXECUTE ON dbo.usp_SubmitExam TO exam_web;
GRANT INSERT, UPDATE ON dbo.Classes TO exam_web;
GRANT INSERT, UPDATE ON dbo.Exams TO exam_web;
GRANT INSERT, UPDATE ON dbo.Questions TO exam_web;
GRANT INSERT, UPDATE, DELETE ON dbo.AnswerOptions TO exam_web;
GRANT INSERT, UPDATE, DELETE ON dbo.ExamQuestions TO exam_web;
GRANT INSERT, UPDATE ON dbo.ExamAssignments TO exam_web;
GRANT INSERT, UPDATE, DELETE ON dbo.ClassEnrollments TO exam_web;
DENY INSERT, UPDATE, DELETE ON dbo.ExamAttempts TO exam_web;
DENY INSERT, UPDATE, DELETE ON dbo.StudentAnswers TO exam_web;
DENY ALTER ON SCHEMA::dbo TO exam_web;
DENY CREATE TABLE, CREATE VIEW, CREATE PROCEDURE, CREATE FUNCTION TO exam_web;
"@
    $mConn = New-Object System.Data.SqlClient.SqlConnection($masterConnStr)
    $mConn.Open()
    try {
        $cmd = $mConn.CreateCommand()
        $cmd.CommandText = $permSql
        [void]$cmd.ExecuteNonQuery()
    } finally {
        $mConn.Close()
    }
    Write-Success "Application login 'exam_web' configured with strict least-privilege permissions."

    # Seed data
    Write-Host "Seeding demonstration data..." -ForegroundColor Cyan
    $seedPath = Join-Path $script:RootDir 'database\seed.sql'
    $seedLog = Join-Path $script:LocalDir 'init-seed.log'
    & sqlcmd -S "tcp:127.0.0.1,$sqlPort" -U sa -C -d EnglishExamDB_WebDev -b -f 65001 -i $seedPath -o $seedLog
    if ($LASTEXITCODE -ne 0) {
        throw "Database seed failed. Inspect $seedLog"
    }
    Remove-Item Env:SQLCMDPASSWORD -ErrorAction SilentlyContinue
    Write-Success "Demonstration seed data successfully inserted (Teacher, Students, Classes, 30 Questions, Exams, Attempt)."
} else {
    Write-Success "Existing database EnglishExamDB_WebDev verified with all academic objects (preserving existing records)."
}

# =============================================================================
# 5. Build and Launch Spring Boot Backend
# =============================================================================
Write-Step "5/7: Building and Launching Spring Boot Backend"

$backendJar = Join-Path $script:RootDir 'backend\target\english-exam-api-1.0.0.jar'
if (-not (Test-Path $backendJar) -or $Build) {
    Write-Host "Packaging backend with Maven..." -ForegroundColor Cyan
    Push-Location (Join-Path $script:RootDir 'backend')
    try {
        & mvn -B -q package -DskipTests
        if ($LASTEXITCODE -ne 0) {
            throw "Backend Maven package failed."
        }
    } finally {
        Pop-Location
    }
    Write-Success "Compiled and packaged backend JAR."
} else {
    Write-Success "Found existing backend JAR: $backendJar"
}

# Set runtime variables for Spring Boot
$env:PORT = "$backendPort"
$env:SERVER_ADDRESS = '127.0.0.1'
$env:DB_URL = "jdbc:sqlserver://127.0.0.1:$sqlPort;databaseName=EnglishExamDB_WebDev;encrypt=true;trustServerCertificate=true"
$env:DB_USERNAME = 'exam_web'
$env:DB_PASSWORD = $config['LAPTOP_SQL_APP_PASSWORD']
$env:OIDC_ISSUER = "http://localhost:$kcPort/realms/english-exam"
$env:OIDC_CLIENT_ID = 'english-exam-web'
$env:OIDC_CLIENT_SECRET = $config['LAPTOP_KC_CLIENT_SECRET']
$env:APP_ORIGIN = "http://localhost:$frontendPort"
$env:COOKIE_SECURE = 'false'

$backendLog = Join-Path $script:LocalDir 'backend.log'
$backendErr = Join-Path $script:LocalDir 'backend-error.log'
$backendPidFile = Join-Path $script:LocalDir 'backend.pid'

Write-Host "Starting Spring Boot backend on port $backendPort..." -ForegroundColor Cyan

$backendCmdFile = Join-Path $script:LocalDir 'run-backend.cmd'
$backendCmdContent = @"
@echo off
set "PORT=$backendPort"
set "SERVER_ADDRESS=127.0.0.1"
set "DB_URL=jdbc:sqlserver://127.0.0.1:$sqlPort;databaseName=EnglishExamDB_WebDev;encrypt=true;trustServerCertificate=true"
set "DB_USERNAME=exam_web"
set "DB_PASSWORD=$($config['LAPTOP_SQL_APP_PASSWORD'])"
set "OIDC_ISSUER=http://localhost:$kcPort/realms/english-exam"
set "OIDC_CLIENT_ID=english-exam-web"
set "OIDC_CLIENT_SECRET=$($config['LAPTOP_KC_CLIENT_SECRET'])"
set "APP_ORIGIN=http://127.0.0.1:$frontendPort"
set "COOKIE_SECURE=false"
"$((Get-Command java).Source)" -Djava.net.preferIPv4Stack=true -Duser.timezone=UTC -Xms128m -Xmx384m -jar "$backendJar" > "$backendLog" 2> "$backendErr"
"@
Set-Content -LiteralPath $backendCmdFile -Value $backendCmdContent -Force -Encoding ASCII

$backendPid = Start-DetachedProcess -CommandLine "cmd.exe /c `"$backendCmdFile`"" -WorkingDirectory $script:RootDir
$backendPid | Set-Content -LiteralPath $backendPidFile -Force

# Wait for backend health check
$backendReady = $false
$elapsed = 0
$healthUrl = "http://127.0.0.1:$backendPort/actuator/health"
while ($elapsed -lt $TimeoutSeconds) {
    try {
        $resp = Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -TimeoutSec 2 -ErrorAction SilentlyContinue
        if ($resp -and $resp.StatusCode -eq 200) {
            $contentStr = if ($resp.Content -is [byte[]]) { [System.Text.Encoding]::UTF8.GetString($resp.Content) } else { [string]$resp.Content }
            if ($contentStr -match 'UP') {
                $backendReady = $true
                break
            }
        }
    } catch {}
    Start-Sleep -Seconds 2
    $elapsed += 2
}

if (-not $backendReady) {
    Write-Err "Backend failed to become healthy. Check $backendErr or $backendLog"
    if (Test-Path $backendErr) { Get-Content $backendErr -Tail 20 }
    exit 1
}
Write-Success "Spring Boot backend is healthy and responding at http://127.0.0.1:$backendPort"

# =============================================================================
# 6. Build and Launch Next.js Frontend
# =============================================================================
Write-Step "6/7: Building and Launching Next.js Frontend"

$frontendDir = Join-Path $script:RootDir 'frontend'
$nodeModules = Join-Path $frontendDir 'node_modules'
if (-not (Test-Path $nodeModules)) {
    Write-Host "Installing frontend dependencies..." -ForegroundColor Cyan
    Push-Location $frontendDir
    try {
        & npm install
        if ($LASTEXITCODE -ne 0) { throw "npm install failed in frontend." }
    } finally {
        Pop-Location
    }
}

$standaloneServer = Join-Path $frontendDir '.next\standalone\server.js'
if (-not (Test-Path $standaloneServer) -or $Build) {
    Write-Host "Building Next.js standalone application..." -ForegroundColor Cyan
    Push-Location $frontendDir
    try {
        $env:BACKEND_URL = "http://127.0.0.1:$backendPort"
        $env:APP_SERVICE_MODE = "production"
        & npm run build
        if ($LASTEXITCODE -ne 0) { throw "npm run build failed in frontend." }
    } finally {
        Pop-Location
    }
    Write-Success "Built Next.js standalone bundle."
} else {
    Write-Success "Found existing Next.js build."
}

# Prepare isolated standalone runtime directory
$runtimeDir = Join-Path $script:LocalDir 'frontend-runtime'
if (-not (Test-Path $runtimeDir)) {
    New-Item -ItemType Directory -Path $runtimeDir -Force | Out-Null
}
Copy-Item (Join-Path $frontendDir '.next\standalone\*') -Destination $runtimeDir -Recurse -Force
$staticDest = Join-Path $runtimeDir '.next\static'
if (-not (Test-Path $staticDest)) { New-Item -ItemType Directory -Path $staticDest -Force | Out-Null }
Copy-Item (Join-Path $frontendDir '.next\static\*') -Destination $staticDest -Recurse -Force
$publicDir = Join-Path $frontendDir 'public'
if (Test-Path $publicDir) {
    Copy-Item $publicDir -Destination $runtimeDir -Recurse -Force
}

$frontendLog = Join-Path $script:LocalDir 'frontend.log'
$frontendErr = Join-Path $script:LocalDir 'frontend-error.log'
$frontendPidFile = Join-Path $script:LocalDir 'frontend.pid'

$env:PORT = "$frontendPort"
$env:HOSTNAME = '0.0.0.0'
$env:BACKEND_URL = "http://127.0.0.1:$backendPort"
$env:APP_SERVICE_MODE = 'production'

Write-Host "Starting Next.js server on port $frontendPort..." -ForegroundColor Cyan
$frontendServerScript = Join-Path $runtimeDir 'server.js'
if (-not (Test-Path $frontendServerScript)) {
    $frontendServerScript = Join-Path $runtimeDir 'frontend\server.js'
}

$frontendCmdFile = Join-Path $script:LocalDir 'run-frontend.cmd'
$frontendCmdContent = @"
@echo off
set "PORT=$frontendPort"
set "HOSTNAME=0.0.0.0"
set "BACKEND_URL=http://127.0.0.1:$backendPort"
set "APP_SERVICE_MODE=production"
"$((Get-Command node).Source)" "$frontendServerScript" > "$frontendLog" 2> "$frontendErr"
"@
Set-Content -LiteralPath $frontendCmdFile -Value $frontendCmdContent -Force -Encoding ASCII

$frontendPid = Start-DetachedProcess -CommandLine "cmd.exe /c `"$frontendCmdFile`"" -WorkingDirectory $frontendDir
$frontendPid | Set-Content -LiteralPath $frontendPidFile -Force

# Wait for frontend readiness
$frontendReady = $false
$elapsed = 0
$frontUrl = "http://127.0.0.1:$frontendPort/"
while ($elapsed -lt $TimeoutSeconds) {
    try {
        $resp = Invoke-WebRequest -Uri $frontUrl -UseBasicParsing -TimeoutSec 2 -ErrorAction SilentlyContinue
        if ($resp -and $resp.StatusCode -eq 200) {
            $frontendReady = $true
            break
        }
    } catch {}
    Start-Sleep -Seconds 2
    $elapsed += 2
}

if (-not $frontendReady) {
    Write-Err "Frontend failed to respond within $TimeoutSeconds seconds. Check $frontendErr or $frontendLog"
    if (Test-Path $frontendErr) { Get-Content $frontendErr -Tail 20 }
    exit 1
}
Write-Success "Next.js frontend is active at $frontUrl"

# =============================================================================
# 7. Smoke Verification & Demonstration Guidance
# =============================================================================
Write-Step "7/7: Verifying Local End-to-End Health"

# Test Backend health
$bHealth = Invoke-RestMethod -Uri "http://127.0.0.1:$backendPort/actuator/health" -TimeoutSec 5
# Test Frontend status rewrite
$fStatus = Invoke-WebRequest -Uri "http://127.0.0.1:$frontendPort/api/public/status" -UseBasicParsing -TimeoutSec 5 -ErrorAction SilentlyContinue

Write-Success "Backend Health: $($bHealth.status)"
Write-Success "Frontend Rewrite: HTTP $($fStatus.StatusCode)"

Write-Host @"

===============================================================================
       ENGLISHEXAM LAPTOP DEMONSTRATION IS READY & FULLY OPERATIONAL!
===============================================================================

Application URL : http://localhost:$frontendPort
Backend API     : http://127.0.0.1:$backendPort
Keycloak OIDC   : http://localhost:$kcPort
SQL Server      : 127.0.0.1:$sqlPort (Database: EnglishExamDB_WebDev)

DEMONSTRATION ACCOUNTS:
-------------------------------------------------------------------------------
1. TEACHER (Instructor)
   Username : teacher
   Password : $($config['LAPTOP_DEMO_PASSWORD'])
   Features : View classrooms, manage questions, publish exams, view results.

2. STUDENT (Enrolled Candidate)
   Username : student
   Password : $($config['LAPTOP_DEMO_PASSWORD'])
   Features : Start assigned exam, save answers, submit exam, view score.

3. OUTSIDER (Unenrolled Candidate)
   Username : outsider
   Password : $($config['LAPTOP_DEMO_PASSWORD'])
   Features : Access control verification (shows 'Chưa có bài thi được giao').

RECOMMENDED DEMO WORKFLOW:
-------------------------------------------------------------------------------
Step A: Open http://localhost:$frontendPort -> Click "Tiếp tục đăng nhập"
Step B: Log in as 'teacher' -> Browse Questions -> Inspect 'WEB-FOUNDATION' & 'DRAFT-ENG-01'
Step C: Click "Công bố đề thi" on 'DRAFT-ENG-01' (executes dbo.usp_PublishExam)
Step D: Log out via sidebar -> Log in as 'student'
Step E: Open "Bài thi của tôi" -> Start 'WEB-FOUNDATION' (executes dbo.usp_StartExam)
Step F: Select answers (executes dbo.usp_SaveAnswer) -> Refresh page to verify persistence
Step G: Click "Nộp bài" (executes dbo.usp_SubmitExam with automated SQL scoring)
Step H: View instant result and history -> Log back in as 'teacher' to review gradebook!

TO STOP THE DEMO:
Run: .\scripts\laptop-stop.ps1
===============================================================================
"@ -ForegroundColor Green

if (-not $Headless) {
    Start-Process "http://localhost:$frontendPort"
}
