# EnglishExam — triển khai công khai và nghiệm thu E2E

**Ngày kiểm tra: 08/11/2026, UTC+07.**

**PRODUCTION ACCEPTANCE / PUBLIC COURSEWORK DEMO: PASS**, theo yêu cầu đã điều chỉnh: website công khai, dịch vụ miễn phí, backend/SQL/Keycloak riêng trên PC qua HTTPS tunnel, không yêu cầu hoạt động 24/7. Thầy cô có thể tự đăng ký và được chủ dự án duyệt quyền. Không dùng bất kỳ VPS, domain, cấu hình Cloudflare, database hay container English Coach nào.

Website thật: **https://english-exam-coursework.vercel.app/**. Luồng giáo viên → học viên → SQL chấm điểm đã chạy bằng Chrome/Playwright trên URL này. Không dùng localhost làm bằng chứng website công khai, không giả API/điểm. Các truy vấn đối chiếu SQL chạy cục bộ, chỉ đọc đúng database mà backend công khai đang sử dụng.

## 1. Triển khai và topology thực tế

| Thành phần | Trạng thái đã xác minh |
|---|---|
| Vercel project | `english-exam-coursework`, `prj_gBzNA7EV8w2vOUrQ52vo3KyZYcTX`; team `Long / long-a2b9` |
| Deployment cuối | `dpl_7hAh98W41BXtbGAs2poScQoWNFVD`, target `production`, **READY**, alias công khai đã trỏ đúng |
| Deployment URL | https://english-exam-coursework-2q6yqguxi-long-a2b9.vercel.app |
| Frontend | Next.js 16.4.4, React 19.3.1; logo đã đổi thành **EnglishExam**, bỏ dấu chấm theo yêu cầu |
| Backend | Spring Boot 3.5.16; tiến trình Java riêng của demo, bind loopback; health nội bộ `UP`; API công khai trả dữ liệu thật |
| HTTPS gateway | Cloudflare Quick Tunnel không tài khoản, binary 2026.10.7 được đối chiếu SHA-256 với digest release GitHub chính thức |
| Tunnel hiện hành | https://yorkshire-thinking-pie-mighty.trycloudflare.com |
| Keycloak | 26.4.7, **production profile**, container riêng `english-exam-demo-identity`; realm `english-exam-demo` |
| OIDC issuer | https://yorkshire-thinking-pie-mighty.trycloudflare.com/realms/english-exam-demo |
| Database nghiệp vụ | **EnglishExamDB_Demo**, trên SQL Server Express hiện có của EnglishExamWeb; login riêng `exam_demo` |
| Database định danh | **EnglishExamDB_DemoIdentity**, login riêng chỉ có quyền trên database này; Keycloak không dùng H2 tạm |
| Lưu trữ | Hai database ở volume SQL Server EnglishExamWeb hiện có; dữ liệu vẫn còn sau khi restart backend và Keycloak |

Luồng thực tế: trình duyệt → Vercel HTTPS → rewrite tới Cloudflare HTTPS → gateway loopback → Spring Boot → SQL Server riêng. Đăng nhập chuyển trình duyệt tới Keycloak qua cùng tunnel, rồi quay về callback Vercel. Gateway không phục vụ tệp máy tính hoặc chuyển tiếp TCP SQL.

Production có `APP_SERVICE_MODE=live` và `BACKEND_URL` của tunnel; Preview vẫn giữ `APP_SERVICE_MODE=preview`. Chỉ hai giá trị không bí mật được lưu tại Vercel. Mật khẩu SQL, client secret và tài khoản quản trị chỉ ở `.local/demo/`, không đóng gói vào frontend. [Metadata triển khai](evidence/production/deployment.json), [loopback bindings](evidence/production/loopback-bindings.json).

Không chạy Git init/commit/push/branch/tag. Dùng `scripts/package-release.py` và API của kết nối Vercel để deploy source vào project hiện có. Bản đầu bật ứng dụng là `dpl_ANasSXyMbUSuAKzGjmW6LwMr6j3f`; bản tiếp theo bổ sung hướng dẫn đăng ký là `dpl_DvkeV9JREa9StpDDyLprcUPuUjPt`; bản cuối chỉ cập nhật logo.

## 2. Lựa chọn giải pháp miễn phí

Đã tra tài liệu chính thức, không đăng ký dịch vụ trả phí hoặc nhập thông tin thanh toán:

| Phương án | Kết quả nghiên cứu và quyết định |
|---|---|
| Render Free | Docker chạy Java được, RAM 512 MB, filesystem tạm, ngủ khi không có request. Không phù hợp để giữ dữ liệu Keycloak tại ổ đĩa local; vẫn cần identity database bên ngoài. [Giới hạn](https://render.com/docs/free), [giá/RAM](https://render.com/pricing). |
| Koyeb Free | Một instance 512 MB/0.1 vCPU, không dùng persistent volumes; trang billing yêu cầu thẻ. Không đáp ứng điều kiện không thẻ. [Instances](https://www.koyeb.com/docs/reference/instances), [billing](https://www.koyeb.com/docs/faqs/pricing). |
| Northflank Sandbox | Có lựa chọn không thẻ, 2 services và 1 database/addon, tối đa $20 tài nguyên/tháng. Đây là ứng viên cloud có thật, nhưng không có tài khoản/kết nối được provision trong phiên này; chưa xác minh một tổ hợp SQL Server + Keycloak đáp ứng các giới hạn trên tài khoản thực. Không kết luận mọi phương án cloud miễn phí đều bất khả thi. [Giá](https://northflank.com/pricing), [Sandbox](https://northflank.com/docs/v1/application/billing/pricing-on-northflank). |
| MonsterASP MSSQL | Có MSSQL miễn phí không thẻ; remote connection theo hướng dẫn cần `TrustServerCertificate=True`, không xác thực certificate qua public CA. Chưa có tài khoản/database/CA được cấp; không chọn hạ xác thực TLS cho SQL đi qua Internet. [Kết nối](https://help.monsterasp.net/databases/mssql/connection-string), [TLS](https://help.monsterasp.net/books/databases/page/secure-connection-ssltls-to-mssql). |
| PC + Quick Tunnel | Được người dùng cho phép rõ ràng. Không cần tài khoản/domain Cloudflare, không mua tài nguyên; giữ nguyên công nghệ và lưu dữ liệu bền trên PC. Không có SLA, hostname đổi khi tạo tunnel mới, tối đa 200 request đồng thời và không hỗ trợ SSE. Ứng dụng này không dùng SSE. [Tài liệu chính thức](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/do-more-with-tunnels/trycloudflare). |

Vì chưa có tổ hợp cloud đầy đủ được kiểm chứng và kết nối sẵn, đã triển khai fallback PC được cho phép. Không dùng Azure, VPS khác, PostgreSQL/MySQL/SQLite hoặc provider thay thế SQL Server. Tại thời điểm đo, Keycloak dùng khoảng 548 MiB trong giới hạn 1 GiB, SQL container khoảng 815 MiB trong giới hạn 3 GiB. Không tạo tài nguyên cloud có tính phí.

## 3. Bảo vệ database và xác thực

- Tạo database demo **mới**, từ riêng phần DDL/module chính thức trước mục seed. Không sao chép dữ liệu riêng của WebDev sang web công khai; chỉ tạo các identity/lớp QA riêng. Không chạy seed/validation coursework vào production và không restore/reset database đang tồn tại.
- Đối chiếu database mới với contract đã kiểm chứng: **10 bảng, 4 procedures, 10 triggers, 2 views**; columns, PK/UNIQUE/indexes, FK, CHECK và modules đều khớp. Đây là gate triển khai database mới, không lặp lại audit học thuật. [Bằng chứng](evidence/production/demo-contract.json).
- `exam_demo` được thực thi 4 procedures và quyền nội dung/lớp cần thiết, không ALTER schema, không ghi trực tiếp ExamAttempts/StudentAnswers, không truy cập WebDev hoặc identity database. [Quyền thực tế](evidence/production/public-boundary.json).
- SQL, Keycloak trực tiếp, backend trực tiếp và gateway chỉ bind loopback. Public `/admin/`, master realm, account console, actuator, metrics, health và `.env` đều trả **404**. Chỉ công khai API ứng dụng, callback và OIDC/resource routes cần thiết. Chính sách dựa trên [hướng dẫn reverse proxy Keycloak](https://www.keycloak.org/server/reverseproxy).
- OIDC Authorization Code + PKCE, client confidential; callback chính xác `https://english-exam-coursework.vercel.app/login/oauth2/code/exam`, logout về URL gốc. Không wildcard callback. Registration mở; direct-access grants cho client ứng dụng tắt; brute-force protection bật.
- Cookie `EXAMSESSION`: **Secure, HttpOnly, SameSite=Lax**. POST không CSRF bị **403**; origin lạ không nhận CORS allow header. API chưa đăng nhập trả **401**. Không đổi quy tắc role/ownership của nghiệp vụ.

## 4. E2E công khai — toàn bộ hành trình

**TeacherId=1, StudentId=2, ClassId=1 / DEMO-ENG-01, ExamId=1, AttemptId=1.** Đề **Public Classroom E2E 4149632828**. Các ID được đối chiếu xuyên suốt browser/API/SQL, không dùng đề khác giữa hai vai trò. [Workflow và SQL chi tiết](evidence/production/classroom/workflow.json).

| Bước yêu cầu | Kết quả |
|---|---|
| 1–3: website, teacher login, quyền | PASS, OIDC thật, reload vẫn giữ phiên; [ảnh](evidence/production/classroom/01-teacher-authenticated.png). |
| 4–5: lớp và ghi danh | PASS, lớp riêng, ghi danh qua UI, gửi lặp chỉ có một dòng khóa ghép; [ảnh](evidence/production/classroom/02-enrollment.png). |
| 6–7: 5 câu, 4 lựa chọn, 1 đáp án đúng | PASS, tạo bằng UI, đáp án đúng phân bố A/B/C/D/A; [ảnh](evidence/production/classroom/03-five-authored-questions.png). |
| 8–10: nháp, cấu trúc, công bố | PASS, publish nháp rỗng bị 409, sắp thứ tự, trọng số 1–5, reload rồi công bố và khóa nội dung; [ảnh](evidence/production/classroom/04-published-weighted-exam.png). |
| 11: giao lớp | PASS, giờ mở/đóng và MaxAttempts=1 lưu thật, AuthorizedBy đúng teacher; [ảnh](evidence/production/classroom/05-assigned-to-class.png). |
| 12–14: logout teacher, login student, bắt đầu | PASS, phiên riêng, đúng đề/lớp, InProgress và mốc thời gian thật; [ảnh](evidence/production/classroom/07-attempt-started.png). |
| 15–17: đúng/sai/trống, đổi đáp án, refresh | PASS, 4 dòng đáp án lưu; câu 3 đổi sai sang đúng, câu 5 để trống; [ảnh](evidence/production/classroom/08-answers-restored-after-refresh.png). |
| 18–20: nộp và tính lại SQL | PASS, Submitted, SubmittedAt có giá trị; **8/15 = 53,33%**; [ảnh](evidence/production/classroom/09-student-score.png). |
| 21: student re-login | PASS, lịch sử và kết quả giữ nguyên; [ảnh](evidence/production/classroom/10-student-result-after-relogin.png). |
| 22: teacher re-login | PASS, thấy đúng học viên/đề/điểm; [ảnh](evidence/production/classroom/11-teacher-result.png). |
| 23: logout và truy cập trái phép | PASS, phiên SSO kết thúc, API 401, UI không hiện dữ liệu bảo vệ; [ảnh](evidence/production/classroom/12-logout-protected.png). |

Luồng chính ghi nhận **0 pageerror, 0 HTTP 5xx**. Điểm SQL độc lập không lấy kết quả của stored procedure/view làm nguồn tính:

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
WHERE a.AttemptId=1;
```

SQL trả **MaxPoints=15, EarnedPoints=8, ScorePercent=53.33**: câu theo thứ tự 1/3/4 đạt 1+3+4=8; câu 2 sai và câu 5 trống đạt 0. Truy vấn chỉ đọc qua `scripts/demo-query.ps1`, có guard `DB_NAME()=EnglishExamDB_Demo`.

## 5. Các ca từ chối, đăng ký và lưu bền

- Student-only tạo/công bố/giao đề: **403**; teacher-only bắt đầu thi: **403**; ghi danh trái quyền: **403**.
- Chưa mở, đã đóng, assignment inactive: **409**. Không ghi danh: **409**. Vượt MaxAttempts: **409 / SQL_51114**.
- Câu ngoài đề: **409**; option Z hoặc thêm QuestionId vào payload đáp án: **400**. Đã công bố không sửa cấu trúc được.
- Lưu sau DeadlineAt: **409**. Nộp sau hạn chấm dữ liệu đã lưu thành công. Mất kết nối ở request tự nộp một lần được phục hồi bằng nộp lại; không giả response. Một attempt khác tự nộp thật từ trang đang mở. [Bằng chứng](evidence/production/classroom/edge-cases.json).
- Sửa đáp án sau nộp: **409**. Nộp lặp/đồng thời trả cùng kết quả, một dòng kết quả. Logout ở tab khác làm API **401**; re-login vẫn giữ đáp án đã lưu. [Bằng chứng](evidence/production/classroom/session-recovery.json).
- **Đăng ký công khai đã kiểm thử:** tạo QA qua form Keycloak; tài khoản chưa duyệt nhận 403, chưa có dòng Users, không tạo đề được. Sau duyệt cục bộ đúng QA đó và re-login, UserId=4 có teacher-only, ClassId=2 / DEMO-T-4. Không tự duyệt các tài khoản khác. [JSON](evidence/production/registration.json), [chờ duyệt](evidence/production/registration-02-awaiting-approval.png), [đã duyệt](evidence/production/registration-03-approved-teacher.png).
- Restart riêng Keycloak và backend, không restore database: đăng nhập lại student/teacher vẫn thấy ExamId=1/AttemptId=1 và điểm 8/15; tài khoản đăng ký mới vẫn tồn tại và có quyền. [Receipt restart](evidence/production/restart-receipt.json), [kiểm chứng](evidence/production/persistence-after-restart.json).

## 6. Build, kiểm thử và sửa lỗi

| Kiểm tra | Kết quả |
|---|---|
| Backend SQL integration tests | **12/12 PASS**, 0 skip; chỉ dùng WebTest cho kiểm thử local. [Log](evidence/production/backend-tests.log). |
| Maven package | PASS qua script chuẩn; copy JAR đã build vào runtime demo riêng. [Log](evidence/production/backend-build.log). |
| TypeScript / Next production build | PASS, dùng output riêng để không đụng frontend local đang chạy. [Typecheck](evidence/production/typecheck.log), [build](evidence/production/frontend-build.log). |
| Playwright công khai | **7/7 PASS**, 0 failed/skipped/flaky: core classroom, edge cases, session recovery, SSO logout, registration/approval, public boundary và persistence. [Tổng hợp](evidence/production/public-test-summary.json). |
| Bản cuối sau sửa logo | Smoke công khai kiểm tra EnglishExam không dấu chấm, form đăng ký, OIDC login, điểm đã lưu và logout. [JSON](evidence/production/final-brand-smoke.json), [trang chủ](evidence/production/final-public-home.png), [kết quả](evidence/production/final-student-result.png). |
| Vercel errors | Không có nhóm error/fatal trong các cửa sổ log đã truy vấn; không suy rộng ra toàn bộ thời gian. [Scan cuối](evidence/production/vercel-final-error-scan.md). |

Blocker ban đầu là preview-only và thiếu backend. Đã giải quyết bằng runtime độc lập được người dùng cho phép, không trỏ Vercel vào localhost. Lỗi provisioning do SQL compile `USE` trước khi database được tạo được sửa bằng tách batch, không reset database. Smoke cuối có hai lỗi harness: selector dùng `header` thay vì `nav`, và request URL tương đối thiếu baseURL trong browser context. Đã sửa harness và chạy lại; không phải lỗi ứng dụng. Checklist React áp dụng cho hai chỉnh sửa TSX nhỏ: không thêm request/hook/state hay dependency mới; giữ cấu trúc truy cập và nhãn logo tương ứng.

## 7. Backup, rollback và tệp được bảo vệ

Trước khi bật live: giữ source backup có SHA-256; tạo `COPY_ONLY` + `CHECKSUM` cho cả hai database demo, `RESTORE VERIFYONLY` thành công. Sau E2E tạo thêm backup dữ liệu và identity. [Receipt backup](evidence/production/backups-20261108-220054.json), [kế hoạch rollback](evidence/production/rollback-plan.json).

Rollback đã xác minh đích hợp lệ `dpl_3YeaGboWWwi1UdwLztQutz9ENCbq` (bản bảo trì cũ, READY, rollback candidate). Có thể request rollback bằng connector cho đúng project rồi xác minh alias; nếu ngừng demo lâu dài, khôi phục production mode preview. **Không thực hiện rollback** vì không có lỗi nghiêm trọng. Không tuyên bố đã diễn tập chuyển traffic rollback. Không restore database cũ đè bài làm của người dùng.

SHA-256 trước/sau của **BAO_CAO_CSDL.pdf, SLIDES.pptx, EnglishExamDB.sql, EnglishExamDB.bak và FINAL.zip đều trùng từng byte**. [Kết quả](evidence/production/protected-verification.json), [hash trước](evidence/production/protected-before.json), [hash sau](evidence/production/protected-after.json). Không kết nối hoặc ghi vào database coursework gốc `EnglishExamDB` trong đợt này. Không lặp lại audit dữ liệu gốc theo yêu cầu mới.

Thay đổi chính: `compose.demo.yaml`; scripts prepare/provision/configure/start/stop/backup/gateway/demo-accounts/demo-query; test công khai tách trong `frontend/tests-production` và config riêng; thông báo chờ duyệt trong `Identity.java`; hướng dẫn đăng ký trong trang login; tên logo trong `ui.tsx`; đóng gói source bổ sung cấu hình/test demo. Không thay schema nghiệp vụ, procedures, triggers, views, quy tắc scoring, ownership hoặc deadline. QA records được giữ và nhận diện rõ.

## 8. Bàn giao và giới hạn

Đọc **[hướng dẫn vận hành và duyệt tài khoản](docs/PUBLIC_DEMO_RUNBOOK.md)**. Thầy cô đăng ký trên website; chủ dự án xác minh trực tiếp danh tính/email rồi chạy công cụ duyệt cục bộ. Chưa cấu hình SMTP; không có email tự động hoặc tự reset mật khẩu qua email.

Website là **công khai**, nhưng chỉ hoạt động đầy đủ khi PC, Docker và tunnel chạy. Quick Tunnel không có SLA; tạo lại tunnel làm đổi hostname và cần cập nhật BACKEND_URL rồi redeploy Vercel. URL frontend Vercel vẫn giữ nguyên. Chạy `scripts/start-demo.ps1` để kiểm tra/mở lại; script không reset database. Session Spring ở RAM nên restart cần re-login; kết quả/đáp án và tài khoản Keycloak đã kiểm thử lưu bền.

Không có server-side scheduler tự nộp khi browser đóng. Sau hạn lưu đáp án, người dùng vẫn nộp các đáp án đã lưu theo đúng hợp đồng SQL. Không còn blocker trong luồng demo công khai đã kiểm thử; các giới hạn vận hành trên vẫn áp dụng. Công việc kết thúc ở triển khai, nghiệm thu và bàn giao này.
