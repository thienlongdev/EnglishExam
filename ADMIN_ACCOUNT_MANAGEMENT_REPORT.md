# BÁO CÁO TRIỂN KHAI CỔNG QUẢN TRỊ VIÊN & PHÊ DUYỆT TÀI KHOẢN TỪ XA
## Production Admin Account Management Portal & Remote Identity Approval
### Hệ thống Đánh giá Năng lực Ngoại ngữ Trực tuyến — EnglishExamWeb

---

## 1. TỔNG QUAN NHIỆM VỤ (MISSION OVERVIEW)

Hệ thống **EnglishExamWeb** đã được trang bị hoàn chỉnh tính năng **Cổng Quản trị viên Quản lý Tài khoản & Phê duyệt Trực tuyến (Admin Account Management Portal)** trực tiếp trên giao diện web production:
- **Production URL:** `https://english-exam-coursework.vercel.app`
- **Route Quản trị:** `https://english-exam-coursework.vercel.app/admin/accounts`
- **Backend Persistent Gateway:** `https://desktop-lf8r4ho.tail449656.ts.net` (Tailscale Funnel an toàn, bảo vệ kết nối HTTPS)

### Mục tiêu cốt lõi đã đạt được 100%:
Chủ sở hữu hệ thống hiện có thể mở website EnglishExamWeb từ bất kỳ thiết bị nào (điện thoại di động, laptop, máy tính bảng ở mọi nơi có Internet), đăng nhập với tư cách Quản trị viên hệ thống (Admin), xem xét danh sách người dùng tự đăng ký mới qua Keycloak, và **phê duyệt phân quyền trực tiếp thành Giảng viên (Teacher) hoặc Học viên (Student)** chỉ bằng một cú nhấp chuột trên trình duyệt, **hoàn toàn không cần truy cập từ xa (RDP/SSH), không cần mở PowerShell, và không cần chạy script thủ công trên máy trạm tại nhà**.

---

## 2. CAM KẾT BẢO TOÀN SCHEMA HỌC VỤ SQL SERVER (ABSOLUTE SCHEMA INTEGRITY)

Cơ sở dữ liệu học vụ SQL Server (`EnglishExamDB_Demo`) được bảo toàn nguyên vẹn 100% theo đúng thiết kế học phần coursework ban đầu:
- **10 Bảng nghiệp vụ:** `Users`, `Classes`, `ClassEnrollments`, `Questions`, `AnswerOptions`, `Exams`, `ExamQuestions`, `ExamAssignments`, `ExamAttempts`, `StudentAnswers`.
- **4 Stored Procedures:** `usp_PublishExam`, `usp_StartExam`, `usp_SaveAnswer`, `usp_SubmitExam`.
- **10 Triggers nghiệp vụ:** `trg_Users_Role`, `trg_Classes_Role`, `trg_Enrollments_Role`, `trg_Assignments_Role`, `trg_Questions_Author`, `trg_Exams_Author`, `trg_ExamQuestions_Lock`, `trg_AnswerOptions_Lock`, `trg_ExamAttempts_Lock`, `trg_StudentAnswers_Lock`.
- **2 Views:** `v_TeacherExamSummary`, `v_StudentExamResults`.
- **2 Chỉ mục bổ sung:** `IX_ExamAssignments_Class_Dates`, `IX_ExamAttempts_Student_Exam`.
- **Bảo toàn hoàn toàn:** Không bổ sung bất kỳ bảng phụ nào (`Admins`, `Roles`, `PendingUsers`, `Approvals`, `Sessions`...) vào cơ sở dữ liệu học vụ SQL Server.
- Toàn bộ cơ chế phân quyền Quản trị viên và hàng đợi người dùng chờ duyệt được quản lý thông qua **Keycloak IAM (Identity & Access Management)** và chỉ đồng bộ danh tính vào bảng `dbo.Users` khi tài khoản đã được phê duyệt chính thức.

---

## 3. KIẾN TRÚC PHÂN QUYỀN KEYCLOAK IAM (SECURITY & RBAC MODEL)

### 3.1. Cấu hình Realm Roles & Scopes
Hệ thống sử dụng realm `english-exam-demo` trên Keycloak 26 với các vai trò cấp realm:
- `admin`: Dành riêng cho Quản trị viên hệ thống. Cho phép truy cập cổng `/admin/accounts` và gọi các endpoint `/api/admin/**`.
- `teacher`: Dành cho Giảng viên. Được phép quản lý lớp học, soạn câu hỏi, tạo và công bố đề thi, xem kết quả học viên. Bị cấm hoàn toàn truy cập `/admin/**`.
- `student`: Dành cho Học viên. Được phép tham gia lớp học, làm bài thi, nộp bài, xem lịch sử thi. Bị cấm hoàn toàn truy cập `/admin/**` và `/teacher/**`.

### 3.2. Token Claims & Protocol Mappers
- Cấu hình Protocol Mapper `realm roles` trong client scope `roles` với:
  - `id.token.claim: true`
  - `access.token.claim: true`
  - `userinfo.token.claim: true`
- Giúp frontend Next.js và backend Spring Boot nhận diện vai trò `admin` tức thì qua OIDC claims (`realm_access.roles`) mà không cần gọi API Keycloak phụ trợ trong các thao tác thông thường.

### 3.3. Tài khoản Quản trị viên
- **Bootstrap Admin của Chủ sở hữu:** Tài khoản `long` (`nhokuto12cdmt@gmail.com`) được gán vai trò `admin` và `teacher`.
- **Tài khoản QA Admin kiểm thử:** Tài khoản `qa-admin` (`qa-admin@englishexam.invalid`) được thiết lập phục vụ kiểm thử tự động E2E.
- **Cơ chế bảo vệ Quản trị viên gốc:** Backend chặn tuyệt đối hành vi vô hiệu hóa (`disable`) hoặc từ chối (`reject`) đối với tài khoản quản trị viên bootstrap `long` / `nhokuto12cdmt@gmail.com`.

---

## 4. CHI TIẾT TRIỂN KHAI PHÍA BACKEND (SPRING BOOT 3)

### 4.1. `Identity.java`
- Bổ sung trường `isAdmin` vào record `User` đại diện cho phiên làm việc.
- Phương thức `hasAdminRole(OidcUser)` trích xuất vai trò từ claim OIDC `realm_access.roles` và Spring Security Authorities `ROLE_ADMIN` / `OIDC_ADMIN`.
- Cung cấp phương thức kiểm tra phân quyền `Identity.admin(oidc)` ném ngoại lệ `ApiException(403, "ADMIN_REQUIRED")` nếu người gọi không có vai trò quản trị.
- Xử lý linh hoạt cho phép tài khoản Admin thuần túy truy cập hệ thống ngay cả khi chưa có dòng nghiệp vụ trong `dbo.Users`.

### 4.2. `KeycloakAdminService.java`
Dịch vụ giao tiếp trực tiếp với Keycloak Admin REST API qua HTTP Client tích hợp:
- **Quản lý Token tự động:** Tự động lấy và gia hạn Access Token của `admin-cli` với cơ chế cache thông minh.
- **`listAccounts(search, status, role, page, size)`:** Liệt kê toàn bộ người dùng từ Keycloak, tra cứu đối chiếu trạng thái trong `dbo.Users`, tính toán các chỉ số thống kê (`pendingCount`, `teacherCount`, `studentCount`, `disabledCount`), hỗ trợ tìm kiếm và phân trang.
- **`getAccount(userId)`:** Truy xuất thông tin chi tiết một tài khoản kết hợp dữ liệu Keycloak và SQL Server.
- **`approveUser(userId, role, adminEmail)`:**
  1. Kiểm tra vai trò hợp lệ (`teacher` hoặc `student`).
  2. Ngăn chặn tự phê duyệt (`SELF_APPROVAL_FORBIDDEN`).
  3. Gán realm role tương ứng trong Keycloak.
  4. Đồng bộ danh tính vào SQL Server `dbo.Users` với `IsTeacher = 1` hoặc `IsStudent = 1`, đảm bảo tính lũy kế (`idempotent`).
  5. Nếu phê duyệt Giảng viên: Tự động khởi tạo lớp học mẫu (`DEMO-T-{UserId}`) nếu chưa tồn tại.
  6. Cập nhật trạng thái Keycloak: `emailVerified = true`, `enabled = true`.
  7. Ghi nhật ký kiểm toán (Audit Trail) chi tiết.
- **`rejectUser(userId, adminEmail)`:** Vô hiệu hóa quyền đăng nhập của tài khoản chờ duyệt (`enabled = false`), bảo toàn dữ liệu.
- **`disableUser(userId, adminEmail)` & `enableUser(userId, adminEmail)`:** Khóa/mở khóa đăng nhập trên Keycloak và cập nhật đồng bộ cờ `IsActive` trong `dbo.Users`.

### 4.3. `AdminController.java`
Cung cấp REST API bảo mật dưới tiền tố `/api/admin`:
- `GET /api/admin/accounts`: Liệt kê tài khoản có bộ lọc và tìm kiếm.
- `GET /api/admin/accounts/{id}`: Xem chi tiết tài khoản.
- `POST /api/admin/accounts/{id}/approve`: Phê duyệt Giảng viên/Học viên.
- `POST /api/admin/accounts/{id}/reject`: Từ chối đơn đăng ký.
- `POST /api/admin/accounts/{id}/disable`: Vô hiệu hóa tài khoản.
- `POST /api/admin/accounts/{id}/enable`: Mở khóa tài khoản.

### 4.4. Kiểm toán Bảo mật (Audit Trail)
Mọi hành động quản trị đều được ghi lại có cấu trúc trong hệ thống nhật ký backend với định dạng:
`AUDIT_ACTION=APPROVE adminEmail=... targetUserId=... targetUsername=... targetEmail=... assignedRole=... timestamp=...`
Tuyệt đối không lưu mật khẩu, token hay bí mật xác thực trong logs.

---

## 5. CHI TIẾT TRIỂN KHAI PHÍA FRONTEND (NEXT.JS APP ROUTER)

### 5.1. Giao diện Cổng Quản trị `/admin/accounts`
- **Thẻ thống kê tổng quan (Metric Counters):** Hiển thị trực quan số lượng tài khoản Chờ phê duyệt (nổi bật màu hổ phách), Giảng viên, Học viên, và Đã vô hiệu hóa.
- **Bộ lọc đa dạng (Filter Tabs):** Chờ duyệt, Giảng viên, Học viên, Đã vô hiệu, và Tất cả.
- **Tìm kiếm tức thì:** Tìm theo username, họ tên hoặc email.
- **Bảng danh sách tài khoản:** Hiển thị avatar ký tự, tên đầy đủ, username, email, trạng thái xác thực, vai trò đã gán, ngày đăng ký (định dạng giờ Việt Nam) và nhãn trạng thái trực quan.
- **Hộp thoại chi tiết tài khoản:** Đối chiếu song song thông tin định danh Keycloak (ID, Username, Email, Thời điểm tạo) và dữ liệu học vụ SQL Server (Mã người dùng SQL, Vai trò GV/HV, Trạng thái hoạt động).
- **Hộp thoại xác nhận thao tác (Confirmation Dialogs):** Đảm bảo an toàn, yêu cầu xác nhận rõ ràng trước khi Phê duyệt Giảng viên, Phê duyệt Học viên, Từ chối, Khóa hoặc Mở khóa tài khoản.
- **Thông báo phản hồi (Feedback Notifications):** Hiển thị thông báo thành công hoặc thông báo lỗi chi tiết, có nút đóng và tự động làm mới danh sách dữ liệu.

### 5.2. Tích hợp Điều hướng & Kiểm soát Quyền truy cập
- Cập nhật `workspace.tsx`:
  - Thêm biểu tượng khiên bảo mật (`ShieldCheck`) và mục menu "Quản lý tài khoản" trong thanh điều hướng dành riêng cho Quản trị viên.
  - Hỗ trợ chuyển đổi nhanh góc nhìn giữa "Cổng quản trị" và "Không gian giảng viên/học viên".
  - Kiểm soát truy cập nghiêm ngặt: Người dùng chưa đăng nhập hoặc không có quyền Admin khi truy cập `/admin/**` sẽ nhận thông báo từ chối truy cập rõ ràng và bị ẩn hoàn toàn các tính năng quản trị.
- Cập nhật `proxy.ts`: Định tuyến an toàn các yêu cầu `/admin/:path*` qua hệ thống xác thực.

---

## 6. KẾT QUẢ KIỂM THỬ TỰ ĐỘNG & BẰNG CHỨNG XÁC THỰC (TEST EVIDENCE)

### 6.1. Kiểm thử Unit & Integration Backend (`AdminSecurityTest`)
Thực hiện 8 kịch bản kiểm thử bảo mật tự động bằng JUnit 5 & MockMvc:
1. `unauthenticatedCallsReturn401`: Gọi endpoint admin khi chưa đăng nhập trả về 401 Unauthorized.
2. `studentCannotAccessAdminEndpoints`: Tài khoản Học viên bị chặn 403 Forbidden.
3. `teacherCannotAccessAdminEndpoints`: Tài khoản Giảng viên bị chặn 403 Forbidden.
4. `adminCanListAccounts`: Tài khoản Quản trị viên liệt kê danh sách tài khoản thành công (200 OK).
5. `adminCanApproveTeacher`: Phê duyệt Giảng viên thành công (200 OK).
6. `adminCanApproveStudent`: Phê duyệt Học viên thành công (200 OK).
7. `adminSelfApprovalIsForbidden`: Quản trị viên tự phê duyệt chính mình bị từ chối 400 Bad Request.
8. `adminCanDisableAndEnableUser`: Khóa và mở khóa tài khoản thành công (200 OK).
- **Kết quả:** **8/8 PASSED (100%)**

### 6.2. Kiểm thử E2E Trực tiếp trên Production (`tests-production/admin-approval.spec.ts`)
Kiểm thử tự động toàn diện bằng Playwright trực tiếp trên `https://english-exam-coursework.vercel.app`:

| Mã Test | Mô tả Kịch bản Kiểm thử | Thời gian | Trạng thái | Bằng chứng Screenshot |
|---|---|---|---|---|
| **ADM-01** | Tài khoản Học viên bị chặn hoàn toàn khỏi giao diện `/admin/accounts` và các Admin API | 2.8s | **PASSED** | `evidence/production/admin/01-student-forbidden.png` |
| **ADM-02** | Tài khoản Giảng viên bị chặn hoàn toàn khỏi giao diện `/admin/accounts` và các Admin API | 2.7s | **PASSED** | `evidence/production/admin/02-teacher-forbidden.png` |
| **ADM-03** | Quản trị viên đăng nhập, xem cổng quản lý tài khoản, bộ lọc và mở modal chi tiết | 4.0s | **PASSED** | `evidence/production/admin/03-admin-portal-and-details.png` |
| **ADM-04** | Người dùng tự đăng ký -> Admin phê duyệt làm Giảng viên -> Đồng bộ SQL -> Giảng viên mới đăng nhập và vào lớp học mẫu | 10.9s | **PASSED** | `evidence/production/admin/04-approve-teacher-confirm-modal.png`<br>`evidence/production/admin/04-teacher-workspace-ready.png` |
| **ADM-05** | Người dùng tự đăng ký -> Admin phê duyệt làm Học viên -> Đồng bộ SQL -> Học viên mới đăng nhập thành công | 9.4s | **PASSED** | `evidence/production/admin/05-student-workspace-ready.png` |
| **ADM-06** | Quản trị viên vô hiệu hóa tài khoản và kích hoạt lại tài khoản thành công (kiểm tra đồng bộ cờ `IsActive` trong SQL) | 5.8s | **PASSED** | `evidence/production/admin/06-disable-enable-verified.png` |
- **Tổng kết bộ test:** **6/6 PASSED (100%) trong 36.4 giây**

### 6.3. Kiểm thử Hồi quy Toàn hệ thống (Regression Suite)
Chạy lại toàn bộ các bài test chấp nhận và chu trình thi cử thực tế trên production:
- `tests-production/acceptance.spec.ts` (A1 - A5): **5/5 PASSED**
- `tests-production/exam-lifecycle.spec.ts` (Tạo đề, giao đề, học viên làm bài, chấm điểm tự động): **1/1 PASSED (32.4s)**
- **Khẳng định:** Không có bất kỳ tính năng giảng viên, học viên hay thi cử nào bị ảnh hưởng hoặc gián đoạn.

---

## 7. HƯỚNG DẪN SỬ DỤNG CHO QUẢN TRỊ VIÊN (OPERATIONAL RUNBOOK)

Khi có người dùng mới đăng ký tài khoản trên website, Quản trị viên thực hiện quy trình phê duyệt như sau:

1. **Mở trình duyệt:** Truy cập `https://english-exam-coursework.vercel.app` từ điện thoại di động hoặc laptop.
2. **Đăng nhập:** Nhấp "Đăng nhập" -> Đăng nhập bằng tài khoản Quản trị viên (`nhokuto12cdmt@gmail.com`).
3. **Vào Cổng Quản trị:** Nhấp vào mục **"Quản lý tài khoản"** trên thanh menu bên trái (hoặc truy cập trực tiếp `/admin/accounts`).
4. **Xem tài khoản chờ duyệt:** Nhấp vào thẻ tab **"Chờ duyệt"**. Thẻ này hiển thị số lượng tài khoản mới đăng ký chưa được kích hoạt.
5. **Xem chi tiết:** Nhấp nút **"Chi tiết"** để kiểm tra họ tên, email, thời điểm đăng ký.
6. **Thực hiện phê duyệt:**
   - Để cấp quyền Giảng viên: Nhấp nút xanh lá **"Duyệt Giảng viên"** -> Nhấp **"Xác nhận thực hiện"** trong hộp thoại.
   - Để cấp quyền Học viên: Nhấp nút xanh dương **"Duyệt Học viên"** -> Nhấp **"Xác nhận thực hiện"** trong hộp thoại.
   - Để từ chối đơn đăng ký: Nhấp nút đỏ **"Từ chối"**.
7. **Kết quả ngay lập tức:**
   - Hệ thống hiển thị thông báo thành công màu xanh lá.
   - Tài khoản được kích hoạt trong Keycloak và tự động đồng bộ vào SQL Server.
   - Người dùng được phê duyệt có thể đăng nhập ngay lập tức để sử dụng các tính năng tương ứng với vai trò của mình.

---

## 8. THÔNG TIN TRIỂN KHAI & MÃ NGUỒN GITHUB

- **Kho lưu trữ GitHub:** `https://github.com/thienlongdev/EnglishExam`
- **Nhánh:** `main`
- **Vercel Production Deployment:** `english-exam-coursework` (Vercel Project ID: `prj_gBzNA7EV8w2vOUrQ52vo3KyZYcTX`)
- **Trạng thái hệ thống:** Hoạt động ổn định (Healthy, UP), sẵn sàng phục vụ thực tế 24/7.
