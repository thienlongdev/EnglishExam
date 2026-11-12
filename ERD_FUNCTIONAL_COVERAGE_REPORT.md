# BÁO CÁO NGHIỆM THU ĐỘ PHỦ TÍNH NĂNG TOÀN DIỆN TỪ ERD SANG WEBSITE
## EnglishExamWeb — Complete Academic ERD-to-Website Functional Coverage

- **Dự án:** `C:\BTL-CSDL\EnglishExamWeb`
- **Hệ thống cơ sở dữ liệu:** Microsoft SQL Server 2022 (Dedicated Container `english-exam-web-sql`)
- **Backend:** Spring Boot 3.5.16 / Java 25 (JdbcTemplate, Spring Security OIDC)
- **Frontend:** Next.js 16.4.4 / React 19.3.1 / TypeScript 5 / TailwindCSS
- **Identity Provider:** Keycloak 26.5 (Standalone demo container `english-exam-demo-identity`)
- **Website công khai:** [https://english-exam-coursework.vercel.app/](https://english-exam-coursework.vercel.app/)
- **Secure Gateway:** Cloudflare Quick Tunnel (Loopback Port 8090)
- **Ngày nghiệm thu:** 10/11/2026
- **Trạng thái:** **PASS — ĐẠT 100% TIÊU CHÍ NGHIỆM THU**

---

## 1. TỔNG QUAN VÀ KẾT LUẬN NGHIỆM THU (EXECUTIVE SUMMARY & VERDICT)

Dự án đã hoàn thành nâng cấp toàn diện mức độ bao phủ chức năng từ mô hình thực thể liên kết (Chen ERD) và lược đồ quan hệ chuẩn hóa 3NF sang ứng dụng web **EnglishExamWeb**.

### Kết luận chính:
1. **Không sửa đổi cơ sở dữ liệu học thuật:** Toàn bộ 10 bảng quan hệ, 4 Stored Procedure, 10 Trigger ràng buộc nghiệp vụ, 2 View thống kê và tính điểm, khóa chính, khóa ngoại, ràng buộc CHECK và DEFAULT được giữ nguyên 100%. Không thực hiện bất kỳ lệnh DDL nào làm thay đổi cấu trúc bảng, không thêm bảng vai trò hay cột thừa.
2. **Bảo tồn toàn vẹn các tệp được chỉ định:** Năm tệp tài liệu và cơ sở dữ liệu gốc (`BAO_CAO_CSDL.pdf`, `SLIDES.pptx`, `EnglishExamDB.sql`, `EnglishExamDB.bak`, `FINAL.zip`) được xác minh khớp SHA-256 từng byte.
3. **Phủ kín toàn bộ các mối quan hệ nghiệp vụ của ERD:**
   - **Giáo viên — Lớp học (1 : N):** Giáo viên có thể tự tạo nhiều lớp học (`ENG-A1`, `ENG-A2`, `ENG-B1`), chỉnh sửa thông tin lớp, xem danh sách đề thi đã giao theo lớp và danh sách học viên.
   - **Học viên — Lớp học (N : M thông qua ClassEnrollments):** Hỗ trợ đầy đủ ghi danh học viên vào nhiều lớp, hiển thị trạng thái đang học / tạm ngừng, kiểm tra và ngăn chặn ghi danh trùng lặp, hỗ trợ gỡ bỏ an toàn khi chưa phát sinh bài làm.
   - **Ngân hàng câu hỏi & Bản nháp (Questions & AnswerOptions):** Hỗ trợ lưu câu hỏi nháp linh hoạt (ít hơn 4 đáp án trong lúc soạn thảo) mà không vi phạm cơ sở dữ liệu. Stored Procedure `usp_PublishExam` tiếp tục là chốt chặn cuối cùng kiểm tra điều kiện xuất bản (tối thiểu 5 câu, đủ 4 lựa chọn A/B/C/D, đúng 1 đáp án đúng).
   - **Đóng băng bất biến câu hỏi đã xuất bản:** Trigger `trg_Questions_Guard` (`51207`) và `trg_Options_Freeze` (`51208`) chặn hoàn toàn mọi hành vi sửa đổi câu hỏi hoặc đáp án đã nằm trong đề công bố.
   - **Giao một đề cho nhiều lớp (Aggregation ExamAssignments):** Khóa chính phức hợp `(ExamId, ClassId)` cho phép một đề thi được giao độc lập cho nhiều lớp với cửa sổ làm bài (`OpensAt`, `ClosesAt`) và số lượt (`MaxAttempts`) riêng biệt. Lưu vết đầy đủ `AuthorizedBy` từ tài khoản giáo viên đăng nhập.
   - **Làm bài, lưu nháp & chấm điểm SQL tất định (ExamAttempts & StudentAnswers):** Học viên làm bài, tự động lưu câu trả lời, tải lại trang vẫn giữ nguyên đáp án đã chọn; nộp bài gọi Stored Procedure `usp_SubmitExam` tính điểm tuyệt đối theo trọng số `ExamQuestions.Points`; kết quả kiểm tra SQL độc lập khớp 100% với View `vw_StudentExamResults`.
   - **Báo cáo kết quả giáo viên:** Xem đầy đủ cả lượt đang làm (`InProgress`) và đã nộp (`Submitted`), tích hợp bộ lọc đa chiều (theo lớp, theo đề, theo trạng thái, tìm kiếm theo tên học viên).
4. **Không phát sinh chi phí & Không can thiệp hạ tầng VPS English Coach:** Tận dụng 100% hạ tầng PC cục bộ qua đường hầm Cloudflare Tunnel miễn phí kết nối về Vercel đã có sẵn.

---

## 2. MA TRẬN ĐỘ PHỦ TÍNH NĂNG TỪ CHEN ERD SANG WEBSITE (ERD-TO-APPLICATION CAPABILITY MATRIX)

| Thực thể / Mối quan hệ ERD | Bảng SQL | Hành động nghiệp vụ | Endpoint API | Thành phần UI (Frontend) | Quyền hạn | Trạng thái trước đây | Trạng thái sau nâng cấp | Bằng chứng xác minh |
|---|---|---|---|---|---|---|---|---|
| **Giảng viên quản lý Lớp học** (1 : N) | `Users`, `Classes` | Tạo lớp học mới mang định danh của giáo viên đăng nhập | `POST /api/teacher/classes` | Modal "Tạo lớp học mới", nút "+ Tạo lớp" trên trang `Lớp phụ trách` | Giáo viên (`IsTeacher = 1`) | Backend hỗ trợ demo class, thiếu UI tự tạo nhiều lớp | **Hoàn thành 100%**: Tạo đa lớp, tự sinh `TeacherId` từ session, kiểm tra trùng mã lớp | Scenario A: Tạo `ENG-A1`, `ENG-A2`, `ENG-B1`; SQL verify `TeacherId=1` |
| **Giảng viên cập nhật Lớp học** (1 : N) | `Classes` | Sửa tên lớp, trạng thái hoạt động (`IsActive`) | `PUT /api/teacher/classes/{id}` | Nút "Sửa thông tin" trên từng thẻ lớp | Giáo viên sở hữu lớp | Chưa có API và modal sửa thông tin lớp | **Hoàn thành 100%**: Kiểm tra quyền sở hữu (`ownClass`), cập nhật dữ liệu an toàn | Scenario A: Sửa tên lớp thành `(Nâng cao)`, SQL lưu chính xác |
| **Ghi danh học viên** (N : M) | `ClassEnrollments`, `Users`, `Classes` | Ghi danh học viên theo email vào lớp cụ thể | `PUT /api/teacher/classes/{id}/enrollments` | Tab "Học viên ghi danh" trong modal Chi tiết lớp | Giáo viên sở hữu lớp | Đã có nhưng chỉ gắn với 1 demo class duy nhất | **Hoàn thành 100%**: Ghi danh học viên vào bất kỳ lớp nào do giáo viên quản lý | Scenario B: S1 vào A1 & B1, S2 vào A2 & B1 |
| **Kiểm tra ghi danh trùng lặp** | `ClassEnrollments` | Tránh tạo trùng lặp cặp `(ClassId, StudentId)` | `PUT /api/teacher/classes/{id}/enrollments` | Thông báo trạng thái cập nhật trên UI | Giáo viên sở hữu lớp | Xử lý upsert cập nhật `IsActive` | **Hoàn thành 100%**: Tuân thủ khóa chính phức hợp `PK_ClassEnrollments` | Scenario B: Ghi danh lại S1 vào A1 không lỗi, giữ tính toàn vẹn |
| **Bật / Tắt trạng thái ghi danh** | `ClassEnrollments` | Chuyển đổi trạng thái "Đang học" / "Tạm ngừng" | `PUT /api/teacher/classes/{id}/enrollments` | Nút "Tạm ngừng" / "Kích hoạt" trên từng dòng học viên | Giáo viên sở hữu lớp | Chưa có nút thao tác trực tiếp trên UI học viên | **Hoàn thành 100%**: Cập nhật tức thời `ce.IsActive` | Scenario B: Đổi trạng thái S2 trong A2 sang Inactive rồi Active |
| **Gỡ bỏ ghi danh an toàn** | `ClassEnrollments` | Xóa học viên khỏi lớp khi chưa có bài làm | `DELETE /api/teacher/classes/{id}/enrollments/{studentId}` | Nút "Xóa" học viên (với xác nhận modal) | Giáo viên sở hữu lớp | Thiếu endpoint và UI xóa ghi danh | **Hoàn thành 100%**: Xóa hợp lệ khi chưa có attempt; nếu đã có attempt, khóa ngoại SQL bảo vệ toàn vẹn dữ liệu | Integration Test: `safeEnrollmentManagementAndRemoval` |
| **Góc nhìn học viên theo lớp** (N : M) | `Classes`, `ClassEnrollments` | Học viên xem tất cả các lớp mình đang ghi danh | `GET /api/student/classes` | Trang `Lớp học của tôi` (`/classes`) | Học viên (`IsStudent = 1`) | Đã có API, UI chỉ hiển thị số lượng trên dashboard | **Hoàn thành 100%**: Hiển thị lưới thẻ lớp đầy đủ thông tin giảng viên và mã lớp | Scenario B: S1 thấy A1 & B1; S2 thấy A2 & B1 |
| **Ngân hàng câu hỏi & Lựa chọn** (1 : N) | `Questions`, `AnswerOptions` | Tạo câu hỏi mới kèm đáp án A/B/C/D | `POST /api/teacher/questions` | Trang `Ngân hàng câu hỏi`, modal "Thêm câu hỏi mới" | Giáo viên (`IsTeacher = 1`) | Ép buộc phải có đủ 4 lựa chọn ngay khi tạo | **Hoàn thành 100%**: Cho phép soạn nháp linh hoạt (1-4 lựa chọn), chỉ yêu cầu đủ 4 khi công bố đề | Scenario C: Tạo Q1..Q5 đủ 4 đáp án; Q6..Q8 dạng nháp 2 đáp án |
| **Đóng băng câu hỏi đã công bố** | `Questions`, `AnswerOptions`, `ExamQuestions` | Chặn sửa câu hỏi / đáp án khi đề thi đã `Published` | `PUT /api/teacher/questions/{id}` | Khóa trường sửa, hiện huy hiệu "Đã khóa (đề công bố)" | Giáo viên (`IsTeacher = 1`) | UI không báo rõ lý do khi trigger SQL chặn | **Hoàn thành 100%**: Hiển thị khóa rõ ràng; Trigger `trg_Questions_Guard` & `trg_Options_Freeze` chặn trả về 409 | Scenario D: Thử sửa Q1 bị chặn bởi SQL (`SQL_51207`/`SQL_51208`) |
| **Biên soạn & Cấu trúc đề thi** (N : M) | `Exams`, `ExamQuestions` | Tạo đề Draft, thêm/bớt/đổi thứ tự/gán điểm câu hỏi | `POST /api/teacher/exams`, `PUT /api/teacher/exams/{id}/questions` | Trang `Soạn đề thi`, bảng cấu trúc câu hỏi | Giáo viên sở hữu đề | Đã có nhưng thiếu hiển thị tổng điểm động từ `ExamQuestions` | **Hoàn thành 100%**: Tính tổng điểm tự động từ `SUM(eq.Points)`, không dùng cột thừa | Scenario D: Gán điểm 1..5 cho 5 câu, tổng điểm 15 |
| **Quy trình Công bố đề thi** | `Exams`, `ExamQuestions`, `AnswerOptions` | Chuyển trạng thái `Draft` -> `Published` | `POST /api/teacher/exams/{id}/publish` | Nút "Công bố đề thi" kèm xác nhận | Giáo viên sở hữu đề | Đã có, gọi `usp_PublishExam` | **Hoàn thành 100%**: Bắt lỗi SQL `51102` (< 5 câu), `51103` (thiếu đáp án) trả thông báo tiếng Việt chuẩn xác | Scenario D: Thử công bố khi có 4 câu bị SQL từ chối (`SQL_51102`); thêm câu thứ 5 công bố thành công |
| **Giao đề thi cho nhiều lớp** (Aggregation) | `ExamAssignments`, `Classes`, `Exams` | Giao một đề công bố cho nhiều lớp học độc lập | `PUT /api/teacher/exams/{id}/assignments`, `POST /api/teacher/classes/{id}/assignments` | Modal "Giao / cập nhật lịch" từ trang Đề thi hoặc từ trang Chi tiết lớp | Giáo viên sở hữu đề/lớp | Chỉ giao được từ phía đề thi, chưa có góc nhìn từ lớp học | **Hoàn thành 100%**: Giao đa chiều (từ Đề -> nhiều Lớp, hoặc từ Lớp -> chọn Đề); lưu `AuthorizedBy` | Scenario E: Giao đề E1 cho A1 (cửa sổ 1h) và B1 (cửa sổ 2h) |
| **Hiển thị đề thi theo từng lớp** | `ExamAssignments`, `ClassEnrollments` | Học viên xem bài thi được giao đúng theo lớp mình học | `GET /api/student/exams` | Trang `Bài thi của tôi` (`/exams`), Trang chủ | Học viên ghi danh | Đã có cơ chế lọc SQL | **Hoàn thành 100%**: Học viên trong nhiều lớp thấy đầy đủ các lượt giao riêng biệt | Scenario E: S1 thấy 2 bài thi; S2 chỉ thấy 1 bài thi ở lớp B1 |
| **Bắt đầu làm bài & Cửa sổ thi** | `ExamAttempts` | Tạo lượt làm bài mới có kiểm tra hạn giờ | `POST /api/student/attempts` | Nút "Bắt đầu làm bài" -> "Tôi đã sẵn sàng" | Học viên ghi danh hợp lệ | Đã có qua `usp_StartExam` | **Hoàn thành 100%**: Kiểm tra cửa sổ `OpensAt`/`ClosesAt`, số lượt `MaxAttempts`, phân định theo `(ExamId, ClassId)` | Scenario F: S1 bắt đầu làm bài tại lớp A1; sau đó làm bài tại lớp B1 độc lập |
| **Lưu đáp án & Khôi phục sau reload** | `StudentAnswers`, `AnswerOptions` | Lưu đáp án từng câu và khôi phục khi F5/reload | `PUT /api/student/attempts/{id}/answers/{qid}` | Giao diện phòng thi trực tuyến | Học viên đang làm bài | Đã có qua `usp_SaveAnswer` | **Hoàn thành 100%**: Tự động lưu tức thì, F5 tải lại giữ nguyên trạng thái | Scenario F: Reload trang, đáp án A vẫn được checked |
| **Nộp bài & Chấm điểm SQL tất định** | `ExamAttempts`, `StudentAnswers`, `AnswerOptions` | Chấm điểm tự động và chuyển trạng thái `Submitted` | `POST /api/student/attempts/{id}/submit` | Nút "Nộp bài thi" trong phòng thi | Học viên đang làm bài | Đã có qua `usp_SubmitExam` | **Hoàn thành 100%**: Điểm số được tính toán nội bộ bằng SQL Server, trigger `trg_Attempts_Guard` bảo vệ | Scenario F: Đạt 3/15 điểm (20.00%), kiểm tra khớp tuyệt đối `vw_StudentExamResults` |
| **Báo cáo kết quả giảng viên** (View) | `vw_StudentExamResults`, `ExamAttempts` | Xem kết quả thi kèm bộ lọc và trạng thái InProgress/Submitted | `GET /api/teacher/results` | Trang `Kết quả học viên` (`/teacher/results`) | Giáo viên (`IsTeacher = 1`) | Chỉ hiển thị danh sách phẳng bài đã nộp | **Hoàn thành 100%**: Thêm bộ lọc Lớp, Đề, Trạng thái (Tất cả / Đã nộp / Đang làm), tìm kiếm học viên | Scenario G: Lọc theo lớp A1 thấy bài nộp S1; lọc Đang làm thấy bài thi lớp B1 |

---

## 3. DANH MỤC THÀNH PHẦN: BẢO TỒN — TÁI SỬ DỤNG — PHÁT TRIỂN MỚI

### 3.1. Thành phần Bảo tồn Nguyên vẹn (Preserved Without Modification)
- **Cơ sở dữ liệu học thuật:** Toàn bộ file script `EnglishExamDB.sql` và bản sao lưu `EnglishExamDB.bak`.
- **Lược đồ quan hệ 10 bảng:** `Users`, `Classes`, `ClassEnrollments`, `Questions`, `AnswerOptions`, `Exams`, `ExamQuestions`, `ExamAssignments`, `ExamAttempts`, `StudentAnswers`.
- **4 Stored Procedures:**
  - `dbo.usp_PublishExam`: Kiểm tra trạng thái Draft, tối thiểu 5 câu, mỗi câu 4 lựa chọn A-D, đúng 1 đáp án đúng.
  - `dbo.usp_StartExam`: Cấp khóa ứng dụng `sp_getapplock`, kiểm tra tư cách học viên, ghi danh hợp lệ, cửa sổ thời gian, số lượt cho phép, tính toán hạn giờ tất định `DeadlineAt`.
  - `dbo.usp_SaveAnswer`: Kiểm tra lượt đang làm bài và trong thời hạn, lưu đáp án học viên.
  - `dbo.usp_SubmitExam`: Kiểm tra lượt, tính tổng điểm đạt được theo trọng số `ExamQuestions.Points`, cập nhật `EarnedPoints` và đổi trạng thái sang `Submitted`.
- **10 Triggers nghiệp vụ:**
  - `trg_Users_Role`: Chặn hạ quyền giáo viên khi còn quan hệ nghiệp vụ, chặn hạ quyền học viên khi có ghi danh.
  - `trg_Classes_Role`: Đảm bảo `TeacherId` phụ trách lớp phải là giáo viên.
  - `trg_Enrollments_Role`: Đảm bảo `StudentId` ghi danh phải là học viên.
  - `trg_Assignments_Role`: Đảm bảo `AuthorizedBy` duyệt giao đề phải là giáo viên.
  - `trg_Questions_Guard`: Đảm bảo tác giả câu hỏi là giáo viên, chặn sửa câu hỏi thuộc đề đã công bố (`51207`).
  - `trg_Options_Freeze`: Chặn sửa lựa chọn của câu hỏi thuộc đề đã công bố (`51208`).
  - `trg_ExamQuestions_Freeze`: Chặn sửa cấu trúc câu hỏi / điểm số của đề đã công bố (`51209`).
  - `trg_Exams_Guard`: Đảm bảo tác giả đề là giáo viên, đề công bố là bất biến (`51211`), bắt buộc >= 5 câu hợp lệ khi chuyển sang Published (`51212`).
  - `trg_Attempts_Guard`: Lượt đã nộp là bất biến (`51213`), không sửa mốc thời gian (`51214`), bảo vệ tính toàn vẹn cửa sổ thi (`51216`), đối chiếu điểm nộp khớp với dữ liệu chấm (`51217`).
  - `trg_StudentAnswers_Guard`: Chặn sửa đáp án khi lượt đã nộp hoặc hết giờ (`51218`), chặn câu ngoài đề (`51219`).
- **2 Views:**
  - `vw_StudentExamResults`: Phục vụ học viên và giáo viên tra cứu kết quả thi có tính phần trăm điểm.
  - `vw_ExamStatistics`: Phục vụ tổng hợp thống kê số lượt thi, điểm trung bình, điểm cao nhất, điểm thấp nhất.
- **Hệ thống xác thực:** Luồng OIDC PKCE thông qua Keycloak, quy trình duyệt tài khoản giảng viên đăng ký tự do thông qua script quản trị nội bộ.
- **Hạ tầng mạng:** Độc lập hoàn toàn với VPS English Coach; tiếp tục vận hành Cloudflare Quick Tunnel và Vercel Serverless.

### 3.2. Thành phần Nâng cấp Tái sử dụng (Enhanced Existing)
- **`backend/src/main/java/vn/edu/englishexam/service/TeacherService.java`:**
  - Mở rộng hỗ trợ quản lý đa lớp: thêm phương thức `createClass`, `editClass`, `classDetails`, `classExams`, `assignToClass`, `removeEnrollment`.
  - Nới lỏng kiểm tra số lượng đáp án khi lưu nháp câu hỏi (`validateOptions`), cho phép lưu từ 1 đến 4 lựa chọn trong giai đoạn soạn thảo, đồng thời tiếp tục giữ quy tắc các mã lựa chọn phải duy nhất trong tập `[A, B, C, D]` và tối đa 1 đáp án đúng.
  - Mở rộng `results(...)` để truy vấn trực tiếp bảng `dbo.ExamAttempts` kết hợp `LEFT JOIN dbo.vw_StudentExamResults`, trả về cả lượt thi đang diễn ra (`InProgress`) và lượt đã nộp (`Submitted`), bổ sung các tham số lọc `classId`, `examId`, `status`, `search`.
- **`backend/src/main/java/vn/edu/englishexam/api/Requests.java`:**
  - Thêm record `ClassRecord(String classCode, String className, boolean isActive)`.
  - Thêm record `ClassAssignment(int examId, Instant opensAt, Instant closesAt, int maxAttempts, boolean isActive)`.
  - Điều chỉnh validation `@Size(max=4)` cho danh sách lựa chọn trong câu hỏi nháp.
- **`frontend/src/components/teacher.tsx`:**
  - Bổ sung nút bấm và modal **"Tạo lớp"** trên giao diện Lớp phụ trách.
  - Bổ sung nút **"Sửa thông tin"** và modal cập nhật lớp học.
  - Bổ sung giao diện hai tab trong modal Chi tiết lớp: **"Học viên ghi danh"** (có nút bật/tắt trạng thái và xóa học viên an toàn) và **"Đề thi đã giao"** (danh sách đề thi được giao kèm nút "Giao thêm đề thi cho lớp này").
  - Cập nhật bảng kết quả học viên với thanh công cụ lọc đa chiều (Lọc theo Lớp, theo Đề, theo Trạng thái, tìm kiếm tên học viên).
  - Tối ưu hóa hiển thị khóa câu hỏi trong ngân hàng câu hỏi khi câu hỏi đã nằm trong đề công bố.

### 3.3. Thành phần Xây dựng Mới (Newly Created)
- **Các Endpoint API mới:**
  - `POST /api/teacher/classes`: Tạo lớp học mới.
  - `GET /api/teacher/classes/{id}`: Xem chi tiết thông tin lớp học.
  - `PUT /api/teacher/classes/{id}`: Cập nhật thông tin lớp học.
  - `GET /api/teacher/classes/{id}/exams`: Xem danh sách đề thi đã giao cho lớp.
  - `POST /api/teacher/classes/{id}/assignments`: Giao đề thi trực tiếp từ giao diện quản lý lớp.
  - `DELETE /api/teacher/classes/{id}/enrollments/{studentId}`: Xóa ghi danh học viên an toàn.
- **Bộ kiểm thử Tích hợp Tự động Mới:**
  - `frontend/tests-production/scenarios-coverage.spec.ts`: Kịch bản E2E kiểm thử toàn bộ 8 kịch bản nghiệp vụ (Scenarios A - H) trên môi trường website công khai và database thật.
  - Bổ sung 5 phương thức kiểm thử tích hợp trong `backend/src/test/java/vn/edu/englishexam/SqlWorkflowTest.java` (nâng tổng số test case từ 12 lên 17, đạt tỉ lệ PASS 17/17).

---

## 4. BẰNG CHỨNG BẢO TỒN CƠ SỞ DỮ LIỆU VÀ TÀI LIỆU GỐC

### 4.1. Đối chiếu Hash SHA-256 của 5 tệp tài liệu và CSDL bắt buộc bảo tồn
Toàn bộ 5 tệp học thuật gốc được kiểm tra bằng thuật toán SHA-256 đối chiếu với bản ghi chuẩn trong `evidence/coursework-before.json`:

| Tên tệp | Đường dẫn thực tế | SHA-256 Hiện tại | SHA-256 Chuẩn trước đây | Kết quả đối chiếu |
|---|---|---|---|---|
| `BAO_CAO_CSDL.pdf` | `C:\BTL-CSDL\BÀI TẬP LỚN\BAO_CAO_CSDL.pdf` | `49e304021ae06c71e326d15934f06fa721050e81f85cee3251cf704aaa673dcd` | `49e304021ae06c71e326d15934f06fa721050e81f85cee3251cf704aaa673dcd` | **Trùng khớp từng byte** |
| `EnglishExamDB.bak` | `C:\BTL-CSDL\BÀI TẬP LỚN\EnglishExamDB.bak` | `5406c0ad12c9d47215919eb2b82d7c744a34e547420ffbeed17fbaf5e833af44` | `5406c0ad12c9d47215919eb2b82d7c744a34e547420ffbeed17fbaf5e833af44` | **Trùng khớp từng byte** |
| `EnglishExamDB.sql` | `C:\BTL-CSDL\BÀI TẬP LỚN\EnglishExamDB.sql` | `8c6b667419efcc7c79b19362f2b7c89c33c490d42693c47058a5e57ac0224bf0` | `8c6b667419efcc7c79b19362f2b7c89c33c490d42693c47058a5e57ac0224bf0` | **Trùng khớp từng byte** |
| `SLIDES.pptx` | `C:\BTL-CSDL\BÀI TẬP LỚN\SLIDES.pptx` | `ea1a7eb98a794d6774290c2266dffb3f2f4a1c7e766d667b911c605d55e031cc` | `ea1a7eb98a794d6774290c2266dffb3f2f4a1c7e766d667b911c605d55e031cc` | **Trùng khớp từng byte** |
| `FINAL.zip` | `C:\BTL-CSDL\FINAL.zip` | `3e0fe14e7e58d6d940bb2addd8e385f7d6d43025eca3f85cb2b071924d896276` | `3e0fe14e7e58d6d940bb2addd8e385f7d6d43025eca3f85cb2b071924d896276` | **Trùng khớp từng byte** |

### 4.2. Xác minh tính toàn vẹn của Lược đồ cơ sở dữ liệu (Contract Verification)
Chạy script kiểm chứng tự động `scripts/classroom-verify.py`:
- `protectedFilesUnchanged`: `true`
- `originalSchemaUnchanged`: `true`
- `originalAllTableDataUnchanged`: `true`
- `tableCount`: 10 bảng
- `objectCounts`: 4 Procedures (`P`), 2 Views (`V`), 10 Triggers (`TR`)
- `noStoredMaxPoints`: `true` (Xác nhận tuyệt đối không phát sinh cột dư thừa `MaxPoints` trong bảng `ExamAttempts`)
- `schemaMatchesOriginal`: 100% khớp các cột, khóa chính, khóa ngoại, ràng buộc kiểm tra.

---

## 5. BẰNG CHỨNG NGHIỆM THU E2E ĐA VAI TRÒ (SCENARIOS A – H)

Bộ kiểm thử E2E tự động `frontend/tests-production/scenarios-coverage.spec.ts` đã thực thi trực tiếp trên website công khai `https://english-exam-coursework.vercel.app/` kết nối backend demo và SQL Server thật, ghi nhận toàn bộ kết quả trong `evidence/production/scenarios/scenarios-coverage-evidence.json`:

### Scenario A: Một giảng viên quản lý nhiều lớp học
- **Hành động:** Giảng viên `teacher` tạo 3 lớp học mới: `ENG-A1-743091` (ClassId: 8), `ENG-A2-743091` (ClassId: 9), `ENG-B1-743091` (ClassId: 10).
- **Cập nhật:** Đổi tên lớp `ENG-A1-743091` thành `Lớp tiếng Anh ENG-A1-743091 (Nâng cao)`.
- **Xác minh SQL:**
  ```sql
  SELECT ClassId, ClassCode, ClassName, TeacherId, IsActive 
  FROM dbo.Classes WHERE ClassId IN (8, 9, 10);
  ```
  Kết quả trả về: Cả 3 lớp đều có `TeacherId = 1` (Minh Nguyễn), `IsActive = 1`, tên lớp đã được cập nhật chính xác.
- **Hình ảnh giao diện:** `evidence/production/scenarios/scenario-a-multi-classes.png` hiển thị đầy đủ thẻ của 3 lớp học mới.

### Scenario B: Ghi danh nhiều học viên vào nhiều lớp (N : M)
- **Hành động:**
  - Ghi danh Học viên 1 (`student.demo@englishexam.invalid`) vào lớp `ENG-A1` và `ENG-B1`.
  - Ghi danh Học viên 2 (`outsider.demo@englishexam.invalid`) vào lớp `ENG-A2` và `ENG-B1`.
  - Thử ghi danh lại Học viên 1 vào `ENG-A1`: Hệ thống xử lý an toàn (HTTP 200/409), không vi phạm khóa chính.
  - Chuyển đổi trạng thái của Học viên 2 tại `ENG-A2`: Tạm ngừng (`isActive=false`) -> Kích hoạt lại (`isActive=true`).
- **Góc nhìn học viên:**
  - Học viên 1 đăng nhập: Thấy danh sách lớp gồm `ENG-A1` và `ENG-B1` (không thấy `ENG-A2`).
  - Học viên 2 đăng nhập: Thấy danh sách lớp gồm `ENG-A2` và `ENG-B1` (không thấy `ENG-A1`).
- **Hình ảnh giao diện:**
  - `evidence/production/scenarios/scenario-b-student1-classes.png` (Góc nhìn Học viên 1)
  - `evidence/production/scenarios/scenario-b-student2-classes.png` (Góc nhìn Học viên 2)

### Scenario C: Ngân hàng câu hỏi dùng chung và Lưu nháp câu hỏi
- **Hành động:** Giảng viên tạo 8 câu hỏi trong ngân hàng:
  - `Q1` .. `Q5`: Câu hỏi hoàn chỉnh với đủ 4 lựa chọn (A, B, C, D) và đúng 1 đáp án đúng.
  - `Q6` .. `Q8`: Câu hỏi nháp chỉ có 2 lựa chọn (A và B).
- **Kết quả:** Cả 8 câu hỏi được lưu thành công vào cơ sở dữ liệu (`dbo.Questions` và `dbo.AnswerOptions`) và hiển thị đầy đủ trong Ngân hàng câu hỏi của giảng viên.
- **Hình ảnh giao diện:** `evidence/production/scenarios/scenario-c-question-bank.png`.

### Scenario D: Biên soạn đề thi, Ràng buộc công bố và Tính bất biến
- **Hành động 1 (Chặn xuất bản không hợp lệ):** Giảng viên tạo đề thi `EX-743091` (ExamId: 11) và chỉ đưa vào 4 câu hỏi (`Q1`..`Q4`). Bấm "Công bố đề thi".
  - **Kết quả:** Stored Procedure `dbo.usp_PublishExam` chặn lại với mã lỗi `SQL_51102` (`Đề cần ít nhất 5 câu.`), API trả về HTTP 409 với thông báo lỗi rõ ràng.
- **Hành động 2 (Xuất bản hợp lệ):** Giảng viên thêm câu hỏi thứ 5 (`Q5`), cấu hình trọng số điểm từng câu: Câu 1 (1đ), Câu 2 (2đ), Câu 3 (3đ), Câu 4 (4đ), Câu 5 (5đ) -> Tổng điểm 15 điểm. Bấm "Công bố đề thi".
  - **Kết quả:** Đề thi chuyển trạng thái từ `Draft` sang `Published` thành công.
- **Hành động 3 (Bảo vệ bất biến):** Thử gửi yêu cầu cập nhật đáp án cho câu hỏi `Q1` (đã nằm trong đề công bố `EX-743091`).
  - **Kết quả:** Trigger `dbo.trg_Questions_Guard` / `dbo.trg_Options_Freeze` lập tức chặn lại với mã lỗi `SQL_51207` / `SQL_51208` (`Không sửa câu thuộc đề công bố.`), API trả về HTTP 409.
- **Hình ảnh giao diện:** `evidence/production/scenarios/scenario-d-published-exam.png`.

### Scenario E: Giao một đề thi cho nhiều lớp học (Aggregation)
- **Hành động:** Giảng viên giao đề thi `EX-743091` cho:
  - Lớp `ENG-A1-743091` (ClassId: 8) với cửa sổ thi 1 giờ, tối đa 2 lượt làm bài.
  - Lớp `ENG-B1-743091` (ClassId: 10) với cửa sổ thi 2 giờ, tối đa 2 lượt làm bài.
- **Xác minh SQL:**
  ```sql
  SELECT ExamId, ClassId, MaxAttempts, IsActive, AuthorizedBy 
  FROM dbo.ExamAssignments WHERE ExamId=11 ORDER BY ClassId;
  ```
  Kết quả trả về đúng 2 bản ghi riêng biệt với khóa phức hợp `(ExamId, ClassId)`:
  - Bản ghi 1: `(11, 8)` | `MaxAttempts = 2` | `AuthorizedBy = 1`
  - Bản ghi 2: `(11, 10)` | `MaxAttempts = 2` | `AuthorizedBy = 1`
- **Góc nhìn học viên:**
  - Học viên 1 (thuộc cả A1 và B1): Nhìn thấy 2 lượt thi tương ứng với 2 lớp với hạn chót khác nhau.
  - Học viên 2 (chỉ thuộc A2 và B1): Chỉ nhìn thấy đúng 1 lượt thi của lớp B1.

### Scenario F: Học viên làm bài, Lưu nháp reload và Chấm điểm SQL
- **Hành động:**
  - Học viên 1 vào thi đề `EX-743091` tại lớp `ENG-A1` (Khởi tạo AttemptId: 10).
  - Chọn đáp án: Câu 1 chọn A (Đúng: 1đ), Câu 2 chọn A (Đúng: 2đ), Câu 3 chọn B (Sai: 0/3đ), Câu 4 và 5 bỏ trống.
  - **Kiểm tra Reload:** Nhấn F5 tải lại trang phòng thi -> Đáp án đã chọn vẫn hiển thị checked chính xác.
  - Nộp bài: Gọi `POST /api/student/attempts/10/submit` thực thi `dbo.usp_SubmitExam`.
- **Đối chiếu tính điểm độc lập với SQL Server:**
  - `EarnedPoints` trong `dbo.ExamAttempts`: **3 điểm**.
  - `dbo.vw_StudentExamResults`:
    ```json
    {
      "AttemptId": 10,
      "EarnedPoints": 3,
      "MaxPoints": 15,
      "ScorePercent": 20.0
    }
    ```
  - Trạng thái lượt thi chuyển sang `Submitted`, thời điểm nộp `SubmittedAt` được ghi nhận. Học viên bị chặn không thể sửa đáp án (`SQL_51218`).
  - Học viên 1 tiếp tục vào làm đề `EX-743091` tại lớp `ENG-B1`: Tạo thành công lượt thi độc lập mới (AttemptId: 11, trạng thái `InProgress`), chứng minh việc làm bài theo từng lớp hoàn toàn độc lập.
- **Hình ảnh giao diện:** `evidence/production/scenarios/scenario-f-attempt-answers-persisted.png`.

### Scenario G: Báo cáo kết quả giảng viên và Bộ lọc đa chiều
- **Hành động:** Giảng viên truy cập trang `Kết quả học viên` (`/teacher/results`) và áp dụng các bộ lọc:
  - Lọc theo Lớp `ENG-A1-743091`: Hiển thị đúng kết quả bài nộp của Học viên 1 (3/15 điểm, 20%).
  - Lọc theo Trạng thái `Submitted`: Chỉ hiển thị các bài đã hoàn thành (AttemptId: 10).
  - Lọc theo Trạng thái `InProgress`: Hiển thị lượt đang làm tại lớp B1 (AttemptId: 11).
- **Hình ảnh giao diện:** `evidence/production/scenarios/scenario-g-teacher-results.png`.

### Scenario H: Kiểm tra tính hồi quy dữ liệu gốc (Regression Verification)
- **Xác minh lớp học gốc:** Lớp demo gốc `DEMO-ENG-01` vẫn tồn tại nguyên vẹn, đầy đủ danh sách học viên và đề thi đã giao.
- **Xác minh kết quả thi cũ:**
  ```sql
  SELECT COUNT(*) AS Cnt FROM dbo.ExamAttempts 
  WHERE ClassId IN (SELECT ClassId FROM dbo.Classes WHERE ClassCode='DEMO-ENG-01');
  ```
  Kết quả ghi nhận: Toàn bộ 9 kết quả thi demo ban đầu được bảo toàn nguyên vẹn, không bị ghi đè hay mất mát dữ liệu.

---

## 6. TRẠNG THÁI TRIỂN KHAI VÀ HẠ TẦNG (DEPLOYMENT STATUS)

| Thành phần | Thông số / Trạng thái | Ghi chú vận hành |
|---|---|---|
| **Deployment ID Hiện hành** | `dpl_2rjiZxJ2xQQRSkqEFjPpr8Zb1HBN` (Vercel Production) | Trạng thái `READY`, đã alias về `https://english-exam-coursework.vercel.app` |
| **Deployment URL** | `https://english-exam-coursework-xs2nndqho-long-a2b9.vercel.app` | Bản build Next.js 16.4.4 mới nhất chứa toàn bộ UI đa lớp, ngân hàng câu hỏi, modal tạo lớp |
| **Deployment Trước đó** | `dpl_AwQC7QQpVYPaox6HqgZe5iyLKJkG` | Đã được thay thế thành công bằng bản mới |
| **Vercel Project** | `english-exam-coursework` (`prj_gBzNA7EV8w2vOUrQ52vo3KyZYcTX`) | Cấu hình proxy `/api`, `/oauth2` về Cloudflare Tunnel |
| **Cloudflare Quick Tunnel** | `https://workplace-brick-return-discount.trycloudflare.com` | Đường hầm HTTPS bảo mật, trỏ về Gateway 8090 |
| **Local Gateway** | Loopback Port `8090` (`scripts/demo-gateway.mjs`) | Điều hướng `/realms` về Keycloak (8280) và `/api` về Spring Boot (8082) |
| **Backend API** | Spring Boot 3.5.16 (`english-exam-demo-api.jar`) | Tiến trình Java riêng biệt, bind cổng `8082`, Health `UP` |
| **Cơ sở dữ liệu nghiệp vụ** | `EnglishExamDB_Demo` trên Docker port `14339` | Lưu trữ dữ liệu vận hành demo, giữ nguyên 100% schema chuẩn |
| **Identity Database** | `EnglishExamDB_DemoIdentity` trên Docker port `14339` | Lưu trữ cấu hình Realm, Client và User Keycloak |
| **Tài khoản Demo QA** | `teacher`, `student`, `outsider` | Sẵn sàng đăng nhập kiểm thử qua Keycloak SSO |
| **Quy tắc chi phí** | **0 VNĐ (Hoàn toàn miễn phí)** | Không phát sinh chi phí hạ tầng, không dùng tài khoản tính phí |
| **Quy tắc VPS English Coach**| **Không can thiệp (100% cách ly)** | Không động chạm tới bất kỳ tài nguyên hay domain nào của English Coach |

---

## 7. HƯỚNG DẪN VẬN HÀNH DÀNH CHO GIẢNG VIÊN VÀ HỌC VIÊN

### 7.1. Dành cho Giảng viên

#### 1. Tạo và quản lý nhiều lớp học
1. Đăng nhập với tài khoản giảng viên, truy cập mục **Lớp phụ trách** trên thanh điều hướng.
2. Nhấn nút **"+ Tạo lớp"** ở góc trên bên phải.
3. Nhập **Mã lớp** (ví dụ: `ENG-A1`, `IELTS-K01`), **Tên lớp học** (ví dụ: `Tiếng Anh Giao Tiếp A1`) và tích chọn **Đang hoạt động**.
4. Nhấn **"Lưu lớp học"**. Lớp học mới sẽ xuất hiện ngay lập tức trong danh sách các lớp phụ trách.
5. Để sửa thông tin lớp, nhấn nút **"Sửa thông tin"** trên thẻ lớp tương ứng, cập nhật tên hoặc trạng thái hoạt động rồi bấm **"Lưu thay đổi"**.

#### 2. Ghi danh và quản lý học viên
1. Trên thẻ lớp học, nhấn **"Danh sách học viên"**.
2. Tại tab **"Học viên ghi danh"**:
   - Nhập email của học viên vào ô tìm kiếm/ghi danh (học viên phải có tài khoản hợp lệ trong hệ thống).
   - Nhấn **"Thêm học viên"**.
3. Để tạm ngừng học viên mà vẫn giữ lịch sử bài làm: Nhấn nút **"Tạm ngừng"** bên cạnh tên học viên.
4. Để xóa học viên: Nhấn nút **"Xóa"** (chỉ thực hiện được khi học viên chưa có bài làm nào trong lớp; nếu đã có bài làm, hệ thống sẽ ngăn chặn để bảo toàn tính toàn vẹn dữ liệu).

#### 3. Soạn câu hỏi và Quản lý Ngân hàng câu hỏi
1. Truy cập mục **Ngân hàng câu hỏi**.
2. Nhấn nút **"Thêm câu hỏi mới"**.
3. Nhập nội dung câu hỏi, chọn thể loại (Grammar, Vocabulary, Reading...) và độ khó (Easy, Medium, Hard).
4. Bạn có thể soạn nháp nhanh với 1 đến 4 lựa chọn A/B/C/D.
5. Đối với câu hỏi hoàn chỉnh để đưa vào đề thi, hãy đảm bảo có đủ 4 lựa chọn A, B, C, D và tích chọn đúng 1 đáp án chính xác.
6. **Lưu ý:** Các câu hỏi đã nằm trong đề thi công bố sẽ được gắn nhãn khóa và không thể chỉnh sửa nội dung hay đáp án nhằm bảo vệ tính toàn vẹn điểm thi.

#### 4. Biên soạn và Công bố đề thi
1. Truy cập mục **Đề thi đã tạo**, nhấn **"Tạo đề thi mới"**.
2. Nhập mã đề, tiêu đề đề thi và thời lượng làm bài (phút). Đề thi mới sẽ ở trạng thái `Draft` (Bản nháp).
3. Nhấn vào đề thi để vào màn hình biên soạn cấu trúc:
   - Thêm các câu hỏi từ ngân hàng câu hỏi vào đề.
   - Sắp xếp thứ tự câu hỏi và chỉ định số điểm (`Points`) cho từng câu.
   - Tổng điểm tối đa của đề thi sẽ tự động được tính bằng tổng điểm các câu hỏi.
4. **Điều kiện công bố đề thi:**
   - Đề thi phải có ít nhất **5 câu hỏi**.
   - Mỗi câu hỏi trong đề phải có **đủ 4 lựa chọn (A, B, C, D)** và **đúng 1 đáp án đúng**.
5. Nhấn nút **"Công bố đề thi"**. Sau khi công bố, đề thi sẽ chuyển sang trạng thái `Published` và sẵn sàng để giao cho các lớp học.

#### 5. Giao một đề thi cho nhiều lớp học độc lập
- **Cách 1 (Từ màn hình Đề thi):** Tại đề thi đã công bố, nhấn **"Giao / cập nhật lịch"**, chọn lớp học cần giao, thiết lập thời gian mở đề (`OpensAt`), thời gian đóng đề (`ClosesAt`) và số lượt làm bài tối đa (`MaxAttempts`), rồi nhấn **"Lưu lịch thi"**. Lặp lại thao tác này cho các lớp học khác nhau.
- **Cách 2 (Từ màn hình Lớp học):** Mở modal chi tiết lớp, chuyển sang tab **"Đề thi đã giao"**, nhấn **"+ Giao đề thi cho lớp này"**, chọn đề thi mong muốn và thiết lập lịch thi tương ứng.

#### 6. Theo dõi và Phân tích kết quả học viên
1. Truy cập mục **Kết quả học viên**.
2. Sử dụng thanh công cụ lọc phía trên để phân tích kết quả theo nhu cầu:
   - **Lọc theo Lớp:** Chọn lớp cụ thể để xem danh sách điểm số của riêng lớp đó.
   - **Lọc theo Đề thi:** Chọn đề thi cụ thể để đánh giá phổ điểm.
   - **Lọc theo Trạng thái:** Chọn `Tất cả`, `Đã nộp` (kết quả chính thức), hoặc `Đang làm` (các học viên đang trong phòng thi).
   - **Tìm kiếm:** Gõ tên học viên để tra cứu nhanh.
3. Bảng hiển thị đầy đủ thông tin: Tên học viên, Lớp học, Bài thi, Lượt thi, Trạng thái, Điểm đạt được/Điểm tối đa, Phần trăm điểm, và Thời điểm nộp bài.

---

### 7.2. Dành cho Học viên

#### 1. Xem danh sách lớp học và bài thi
1. Đăng nhập với tài khoản học viên.
2. Trang **Tổng quan (Dashboard)** hiển thị tóm tắt số lượng lớp học đang tham gia và các bài thi đang mở.
3. Vào mục **Lớp học của tôi** (`/classes`) để xem tất cả các lớp mà bạn đã được giảng viên ghi danh, kèm thông tin giảng viên phụ trách và số lượng bài thi.
4. Vào mục **Bài thi của tôi** (`/exams`) để xem danh sách bài thi được giao cho các lớp của bạn, được phân loại theo trạng thái:
   - **Đang mở (Open):** Có thể bắt đầu làm bài.
   - **Sắp mở (Upcoming):** Chưa tới giờ mở đề thi.
   - **Đã đóng (Closed):** Đã quá hạn làm bài.
   - **Hết lượt:** Bạn đã sử dụng hết số lượt làm bài cho phép.

#### 2. Quy trình làm bài thi trực tuyến
1. Chọn bài thi đang mở, đọc kỹ thông tin thời lượng và số câu hỏi, nhấn **"Bắt đầu làm bài"** -> **"Tôi đã sẵn sàng"**.
2. Hệ thống sẽ khởi tạo lượt làm bài và kích hoạt đồng hồ đếm ngược tất định.
3. Chọn đáp án cho từng câu hỏi (A, B, C hoặc D). Hệ thống sẽ tự động lưu đáp án của bạn ngay khi chọn.
4. **Yên tâm khi gặp sự cố mạng hoặc lỡ tắt trình duyệt:** Bạn có thể mở lại trang hoặc tải lại (F5), tất cả các đáp án đã chọn trước đó sẽ được khôi phục nguyên vẹn.
5. Khi hoàn thành, nhấn nút **"Nộp bài thi"** để nộp bài và nhận điểm số ngay lập tức. Nếu hết thời gian làm bài, hệ thống sẽ tự động nộp bài và khóa quyền chỉnh sửa đáp án.

#### 3. Tra cứu lịch sử bài làm và Điểm số
1. Truy cập mục **Lịch sử bài làm** (`/history`).
2. Danh sách hiển thị toàn bộ các lượt thi bạn từng tham gia (bao gồm cả lượt đã nộp và lượt đang diễn ra).
3. Nhấn vào **"Kết quả"** trên dòng tương ứng để xem bảng điểm chi tiết, bao gồm: Điểm đạt được, Điểm tối đa của đề thi, Điểm phần trăm (thang 100), và thời gian làm bài.

---

## 8. TỔNG KẾT VÀ BÀN GIAO SẢN PHẨM

Toàn bộ các mục tiêu trong yêu cầu nghiệp vụ đã được triển khai trọn vẹn, vượt qua toàn bộ các bài kiểm thử tự động, tích hợp và kiểm thử giao diện E2E trên hệ thống đang hoạt động công khai. 

Ứng dụng **EnglishExamWeb** hiện tại đã phản ánh trung thực, đầy đủ và chuẩn xác 100% mô hình dữ liệu quan hệ và các ràng buộc nghiệp vụ trong đồ án cơ sở dữ liệu học thuật.
