# BÁO CÁO KIỂM CHỨNG LỚP HỌC E2E — ENGLISHEXAMWEB

**ĐẠT luồng classroom local đã kiểm thử ngày 08/11/2026 (UTC+07).** Website đang chạy tại http://localhost:3000. Không triển khai production.

## 1. Công nghệ thực tế

- Frontend: Next.js **16.4.4**, React/React DOM **19.3.1**, TypeScript; production server cổng 3000, rewrite HTTP tới backend 8081.
- Backend: Spring Boot **3.5.16**, Spring Security, JdbcTemplate/JDBC, Maven; target Java **21**, JVM chạy thực tế **Java 25**. Không JPA auto-DDL/migration trong đợt này.
- SQL Server **2025 Express**, version **17.0.5035.5**, Docker bind `127.0.0.1:14339`; ứng dụng dùng login **exam_web**, database **EnglishExamDB_WebDev**. Integration test dùng **EnglishExamDB_WebTest**.
- Keycloak **26.4**, OIDC Authorization Code + PKCE, cổng 8180; email đã xác minh ánh xạ vào `Users`, quyền lấy từ SQL. Giữ session HttpOnly và CSRF.
- Đã kiểm tra Browser → Next.js → API → Identity/role/ownership → service/JDBC → procedures/triggers → response → UI. Luồng chính dùng SQL thật, không mock điểm hay lưu bài bằng localStorage.

## 2. Đối chiếu schema và an toàn dữ liệu

Tham chiếu SQL chính thức, audit học thuật cập nhật 07/11 và hướng dẫn đọc database; không kiểm định lại học thuật. WebDev/WebTest có **10 bảng, 4 procedures, 2 views, 10 triggers**. Columns, keys/indexes, FK và CHECK khớp database gốc. **16/16 module mỗi database khớp SQL nộp bài** sau chuẩn hóa CREATE/comment/xuống dòng; không sửa schema, procedure hay trigger.

Khóa ghép của ExamAssignments, ClassEnrollments, AnswerOptions, StudentAnswers được giữ nguyên. `MaxPoints` dẫn xuất từ `ExamQuestions`, không lưu trong `ExamAttempts`. `SchemaGuard.java` không thay đổi. Login `exam_web` chạy được 4 procedures nhưng không ALTER schema, UPDATE ExamAttempts hoặc INSERT StudentAnswers trực tiếp: [bằng chứng quyền](evidence/classroom/application-permissions.json).

Database **EnglishExamDB gốc** chỉ được đọc: schema và hash dữ liệu toàn bộ từng bảng trùng trước/sau. Bốn tệp nộp bài và `FINAL.zip` nguyên checksum. Schema WebDev/WebTest không đổi; không reset, truncate, restore đè hoặc xóa dữ liệu cũ để test đạt. Xem [đối chiếu trước/sau](evidence/classroom/contract-verification.json).

Trước khi ghi dữ liệu kiểm thử, đã BACKUP COPY_ONLY + CHECKSUM, RESTORE VERIFYONLY thành công và sao chép về:

- `.local/EnglishExamDB_WebDev-classroom-before-20261108-210738.bak`
- `.local/EnglishExamDB_WebTest-classroom-before-20261108-210739.bak`
- Source trước sửa: `.local/classroom-source-before-20261108-210737.zip`.

## 3. Vấn đề xác nhận và sửa

| Vấn đề tái hiện | Nguyên nhân và cách sửa |
|---|---|
| Logout rồi login tự vào lại giáo viên cũ | Phiên SSO Keycloak chưa kết thúc. Dùng `OidcClientInitiatedLogoutSuccessHandler`, POST form có CSRF để browser theo redirect, cấu hình post-logout URI cho client local. Đã đổi teacher → student trong cùng browser thành công. |
| Restart backend báo không rename được JAR | Maven repackage trước khi dừng JVM đang khóa file trên Windows; PID lưu có thể là launcher shim. Script nay dừng đúng Java có đường dẫn JAR của dự án trước build; bỏ nhánh dừng theo PID cũ không đủ xác minh. Restart và health UP đã kiểm tra lại. |
| Giao diện gọi DeadlineAt là “hạn nộp” | Sửa thành “hạn lưu đáp án” và giải thích vẫn nộp đáp án đã lưu sau hạn, đúng hợp đồng SQL. |
| Test cũ chưa chứng minh đề giáo viên tạo chính là đề học viên thi | Thêm hành trình UI chung ExamId/AttemptId, 5 câu tạo qua form, điểm trọng số, SQL tính lại độc lập, ảnh từng pha và các ca lỗi. |

Không phải sửa quy tắc chấm điểm hoặc schema. Hai lỗi định vị cảnh báo trong lần chạy test mới được sửa bằng selector `.notice[role="alert"]`, tránh announcer Next.js; giữ nguyên assertions.

## 4. Luồng thực thi cuối

**TeacherId=161, StudentId=162, ClassId=17 / WEB-ENG-01, ExamId=41, AttemptId=317.** Đề: **Classroom E2E 4147503076**. Dữ liệu đầy đủ: [workflow.json](evidence/classroom/workflow.json).

| Pha | Kết quả và ảnh |
|---|---|
| Teacher login | PASS — OIDC thật; reload giữ phiên. [01](evidence/classroom/01-teacher-authenticated.png) |
| Class/enrollment | PASS — chọn lớp đang phụ trách, gửi ghi danh bằng email qua form; gửi lặp vẫn đúng 1 dòng khóa ghép. [02](evidence/classroom/02-enrollment.png) |
| Questions | PASS — tạo 5 câu bằng UI, mỗi câu đủ A/B/C/D và đúng một lựa chọn. [03](evidence/classroom/03-five-authored-questions.png) |
| Draft → publish | PASS — lưu/reload nháp rỗng; publish bị 409; thêm 5 câu, đổi thứ tự, trọng số 1–5, thời lượng 20 phút; lưu/reload rồi công bố; khóa nội dung. [04](evidence/classroom/04-published-weighted-exam.png) |
| Assignment | PASS — lưu giờ mở/đóng, MaxAttempts=1, đúng cặp `(41,17)`, AuthorizedBy=161 từ giáo viên xác thực sở hữu đề/lớp. Không thêm quy trình duyệt khác schema. [05](evidence/classroom/05-assigned-to-class.png) |
| Student login | PASS — giáo viên logout, context học viên riêng; mở lớp và đề vừa giao. [06](evidence/classroom/06-student-authenticated.png) |
| Start attempt | PASS — SQL tạo AttemptNo=1, Status=InProgress; StartedAt/DeadlineAt cách 20 phút; đủ 5 câu. [07](evidence/classroom/07-attempt-started.png) |
| Save/change/refresh | PASS — 3 câu đúng, 1 sai, 1 trống; câu 3 đổi sai → đúng; refresh giữ 4 dòng đáp án SQL. [08](evidence/classroom/08-answers-restored-after-refresh.png) |
| Submit/score | PASS — xác nhận còn 1 câu trống; `usp_SubmitExam` chấm; SubmittedAt có giá trị, Status=Submitted, **8/15 = 53,33%**. [09](evidence/classroom/09-student-score.png) |
| Student results | PASS — logout/re-login, mở lịch sử vẫn có kết quả. [10](evidence/classroom/10-student-result-after-relogin.png) |
| Teacher results | PASS — giáo viên re-login thấy đúng học viên/đề/điểm. [11](evidence/classroom/11-teacher-result.png) |
| Logout/protection | PASS — kết thúc session ứng dụng và SSO; protected API 401, trang không hiện dữ liệu. [12](evidence/classroom/12-logout-protected.png) |

## 5. Chấm lại độc lập bằng SQL chỉ đọc

Trọng số theo thứ tự là **1, 2, 3, 4, 5**. Câu 1/3/4 đúng nhận **1+3+4=8**; câu 2 sai và câu 5 chưa trả lời nhận **0**. Câu đổi đáp án không tạo dòng trùng.

Đã chạy phép tổng độc lập, không lấy điểm từ procedure/view:

```sql
SELECT SUM(eq.Points) AS MaxPoints,
       SUM(CASE WHEN ao.IsCorrect=1 THEN eq.Points ELSE 0 END) AS EarnedPoints,
       CONVERT(decimal(6,2),100.0 *
         SUM(CASE WHEN ao.IsCorrect=1 THEN eq.Points ELSE 0 END) /
         SUM(eq.Points)) AS ScorePercent
FROM dbo.ExamAttempts a
JOIN dbo.ExamQuestions eq ON eq.ExamId=a.ExamId
LEFT JOIN dbo.StudentAnswers sa
  ON sa.AttemptId=a.AttemptId AND sa.QuestionId=eq.QuestionId
LEFT JOIN dbo.AnswerOptions ao
  ON ao.QuestionId=sa.QuestionId AND ao.OptionCode=sa.SelectedOptionCode
WHERE a.AttemptId=317;
```

**SQL: EarnedPoints=8.00, MaxPoints=15.00, ScorePercent=53.33**, trùng dữ liệu persisted và hai UI. Chi tiết từng QuestionId/option/trọng số/thời gian ở `scoreRows`, `independentSqlScore`, `started`, `final` trong [workflow.json](evidence/classroom/workflow.json).

## 6. Ca từ chối/phục hồi đã chạy

- Student tạo/công bố đề: **403**; teacher-only bắt đầu thi: **403**; ghi danh trái role/ownership: **403/404**.
- Không ghi danh hoặc ghi danh inactive: từ chối; duplicate ghi danh: 1 dòng. Email không phải học viên: từ chối.
- Chưa mở, đã đóng, assignment inactive: **409**, UI không cho bắt đầu. Vượt MaxAttempts: **409 / SQL_51114**.
- Câu ngoài đề: **409 / SQL_51121**; option Z: **400**; chèn QuestionId khác vào body: **400**. A–D không phải ID toàn cục; lựa chọn thuộc câu được xác định bằng khóa ghép.
- Save sau DeadlineAt: **409 / SQL_51120**; submit sau hạn vẫn thành công. Đã quan sát request tự nộp từ trang đang mở. Khi chặn request đó một lần, UI báo lỗi; bấm nộp lại chấm dữ liệu đã lưu thành công.
- Sau nộp, sửa đáp án: **409**; nộp lặp/đồng thời trả cùng kết quả, đúng 1 dòng kết quả. Backend kiểm tra thêm 4 start đồng thời với limit 2 và 2 submit đồng thời khi đang InProgress.
- Logout thực ở tab khác làm session mất hiệu lực: API **401**, đáp án mới không được tính đã lưu; re-login giữ đáp án cũ và nộp được.
- Sửa metadata, câu/options hoặc cấu trúc đề đã công bố bị chặn. Nháp có hai đáp án đúng bị chặn công bố; sửa hợp lệ rồi công bố được.

Bằng chứng: [edge-cases.json](evidence/classroom/edge-cases.json), [session-recovery.json](evidence/classroom/session-recovery.json), [logout.json](evidence/classroom/logout.json).

## 7. Automated tests và build

| Kiểm tra | Kết quả |
|---|---|
| `scripts/test-backend.ps1`, SQL Server WebTest thật | **12/12 PASS**, 0 lỗi/skip. [Log](evidence/classroom/backend-tests.log) |
| Toàn bộ Playwright/Chrome: 7 test cũ + 4 bổ sung | **11/11 PASS**, 0 skip/flaky. [JSON](evidence/classroom/playwright-full-results.json) |
| Chạy lại classroom với SUM/CASE độc lập sau build/restart cuối | **1/1 PASS**. [JSON](evidence/classroom/playwright-score-results.json) |
| `npm run typecheck` | PASS. [Log](evidence/classroom/typecheck.log) |
| `npm run build` | PASS. [Log](evidence/classroom/frontend-build.log) |
| Maven package + restart backend | PASS. [Log](evidence/classroom/backend-restart.log) |
| Checksum/schema/data trước-sau | PASS. [JSON](evidence/classroom/contract-verification.json) |

Luồng classroom cuối ghi nhận **0 pageerror, 0 HTTP 5xx**. Test chất lượng hiện có kiểm tra responsive và axe, không có serious/critical trong trang được kiểm tra. Đã xem ảnh kết quả học viên/giáo viên. Cảnh báo Maven/Mockito/JDK mới không gây lỗi build/test.

## 8. Tệp thay đổi

- Backend: `api/ApiController.java`, `security/SecurityConfig.java`; `backend/src/test/java/vn/edu/englishexam/SqlWorkflowTest.java`.
- Frontend: `src/lib/api.ts`, `src/components/workspace.tsx`, `src/components/student.tsx`; thêm `tests/classroom.spec.ts`.
- Scripts: sửa `start-backend.ps1`, `prepare-local.py`; thêm `classroom-files.py`, `classroom-database.ps1`, `classroom-query.ps1`, `classroom-verify.py`.
- Tài liệu: `README.md`, báo cáo này. Runtime: cập nhật thuộc tính post-logout URI trong Keycloak client và `.local/realm.json`; có bản sao cấu hình trước sửa trong `.local/`.
- Sinh thêm evidence, screenshots, logs, source/database backups và build/runtime outputs. Không Git init/commit/push/branch/tag; không deploy.

## 9. Bốn tệp nộp bài không đổi

Đối chiếu SHA-256 trực tiếp trước/sau: **BAO_CAO_CSDL.pdf, SLIDES.pptx, EnglishExamDB.sql, EnglishExamDB.bak đều trùng từng byte**. `FINAL.zip` cũng không đổi. Hash đầy đủ và kích thước: [protected-before.json](evidence/classroom/protected-before.json), [protected-after.json](evidence/classroom/protected-after.json); cờ `protectedFilesUnchanged=true` trong đối chiếu hợp đồng.

## 10. Giới hạn và trạng thái cuối

**Không còn blocker cho luồng classroom local đã kiểm thử.** Không kết luận public hosting/production đã sẵn sàng. Dùng lớp và test identities có sẵn; không bổ sung chức năng tạo lớp/tài khoản.

Tự nộp là hành vi frontend khi trang đang chạy; **không có scheduler tự nộp phía server khi browser đóng**. Mất mạng lúc hết giờ cần kết nối lại và bấm nộp lại. Đã kiểm thử session bị hủy thực ở tab khác, không chờ đủ idle timeout 4 giờ. Dữ liệu QA mới được giữ để kiểm tra lại. Smoke test cũ vẫn dùng đề demo có MaxAttempts hữu hạn; suite classroom mới tạo đề riêng mỗi lần.
