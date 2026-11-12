# Bàn giao khôi phục English Exam — 02/11/2026

## Kết quả chính

Ứng dụng hiện hành tại **C:\BTL-CSDL\EnglishExamWeb** đã được tiếp tục từ nguồn lưu cuối, không dựng lại. Thư mục không có Git repository/remote, nên không có commit/push hoặc Git diff. Checkpoint trước sửa: `C:\BTL-CSDL\.recovery-checkpoints\EnglishExamWeb-20261102-211438.zip` và manifest SHA-256 đi kèm (94 tệp, không gồm node_modules/build cache). Bản này có cấu hình local nên chỉ lưu cục bộ, không dùng làm gói publish.

**Public frontend:** https://english-exam-coursework.vercel.app. Vercel Hobby, team Long (`long-a2b9`), project `english-exam-coursework`, deployment `dpl_3YeaGboWWwi1UdwLztQutz9ENCbq`, READY. Build từ 36 tệp frontend được chọn rõ; không upload `.env`, `.local`, SQL/BAK, dữ liệu tài khoản hoặc test evidence.

**Chưa hoàn tất full-stack public:** backend, SQL Server bền vững và OIDC production chưa có tài khoản/endpoint được cấp quyền. Frontend công khai hiển thị rõ “Bản xem trước · Cổng thi chưa mở”; không giả mạo đăng nhập, danh sách đề hoặc kết quả. API trả 503 có cấu trúc và OAuth/protected pages chuyển về trang thông báo. Không dùng Azure, không đụng VPS hoặc ứng dụng khác.

Yêu cầu đổi sang `englishexam.vercel.app` đã được thử; Vercel trả **409 `owned-on-other-team`**: tên đã thuộc project của team khác. Không chiếm hoặc thay đổi domain đó. Địa chỉ hiện hành vẫn như trên cho đến khi chọn tên thay thế.

## Đã hoàn thiện

- Giữ bố cục editorial hiện có, đổi sang hệ màu xanh/navy, Quicksand Variable tự host trên mọi trang và giao diện Keycloak local, hỗ trợ tiếng Việt.
- Chuyển trang 280ms, dialog 200ms, phản hồi điều khiển 160ms; hỗ trợ reduced motion; không thêm thư viện animation.
- Nhãn/hướng dẫn mã đề, kiểm tra định dạng HTML tương thích biểu thức `v` của trình duyệt; lỗi OIDC rõ ràng, đăng nhập sai mật khẩu hiển thị lỗi thật.
- Mobile menu có focus trap, Escape và trả focus; bảng cuộn ngang bằng bàn phím; sửa tràn ngang từ phần tử screen-reader nằm ngoài bảng.
- Phòng thi: native radio, trạng thái chỉ báo lưu sau xác nhận API, retry khi mất mạng, chặn nộp khi đáp án chưa lưu, điều hướng câu hỏi/focus trên mobile, cảnh báo rời bài có thay đổi chưa lưu. Đồng hồ vẫn dùng deadline và serverNow từ SQL; không đổi phép chấm.
- Học viên: lớp/đề đúng quyền, start/save/submit/result, lịch sử và persistence sau refresh. Giảng viên: ngân hàng câu hỏi, tạo/cấu trúc/công bố/giao đề, lớp, kết quả; đề công bố khóa theo DB.
- Quy trình khởi động frontend dùng bản runtime build riêng trong `.local` để tránh khóa tệp khi build lại trên Windows. Chỉ dừng đúng tiến trình của ứng dụng.

## Kiểm thử đã thực thi

| Kiểm tra | Kết quả | Bằng chứng |
|---|---|---|
| TypeScript | PASS | `npm run typecheck` |
| Next.js production build | PASS | `evidence/frontend-build-recovery.log` |
| Public preview build | PASS | `evidence/frontend-preview-build.log` |
| Spring integration tests trên SQL Server thật | **10/10**, không skip | `evidence/backend-tests-recovery.log` |
| Playwright E2E local | **7/7**, không skip/flaky | `evidence/frontend-tests.json` |
| Accessibility WCAG A/AA bằng axe | **30 báo cáo, 0 vi phạm** | `evidence/axe-*.json` |
| Docker backend Java 21 | build PASS, health UP, SQL thật; ~204–212 MiB trong giới hạn 512 MiB | `evidence/docker-runtime-verification.json`, `evidence/docker-runtime.log` |
| Frontend public qua HTTPS | PASS, 4 kích thước, font thật, 0 JS errors, axe 0 | `evidence/public-verification.json` |
| Runtime Vercel error/fatal scan | Không có bản ghi khớp trong cửa sổ kiểm tra 30 phút | API get_runtime_logs theo deployment |

Backend tests phủ chấm theo trọng số, thay đáp án, output/persistence, bắt đầu đồng thời và giới hạn lượt, nộp đồng thời/trùng, ghi danh/lịch/assignment ngừng, hết giờ, lựa chọn/câu hỏi/ownership sai, khóa nội dung đã công bố, cấm app DDL/ghi điểm trực tiếp, OIDC role/email verified/mapping, CSRF, input/mass assignment, tối thiểu 5 câu và round-trip UTC.

E2E dùng **ba danh tính OIDC thật** trên Keycloak local. Luồng thi kiểm tra không xuất `isCorrect`, lưu A → reload → thay B, request bị cắt → báo chưa lưu → retry, confirm/submit, reload kết quả, logout và 401. Luồng teacher biên soạn, công bố và giao đề thật qua API; dữ liệu QA chỉ ở WebDev/WebTest.

Các ảnh đã kiểm tra gồm landing, login/error và OIDC, dashboard/lớp/đề/lịch sử/kết quả học viên, phòng thi desktop/mobile, toàn bộ teacher routes và form. Viewports 375/768/1024/1440; Chrome desktop emulation. Chưa kiểm tra thiết bị vật lý, Safari/Firefox, tải lớn hoặc cold start của host công khai.

## Bảo toàn cơ sở dữ liệu

`evidence/database-contract-after.json` có `pass=true`:

- **907/907** tệp coursework nguyên SHA-256, gồm SQL/BAK/PDF/PPTX; không sửa bản gốc.
- CSDL gốc `EnglishExamDB` giữ nguyên metadata, module và row counts so với checkpoint trước phiên cũ.
- WebDev/WebTest: **10 bảng, 4 procedures, 2 views, 10 triggers**; columns/default definitions, keys/indexes, FK, CHECK khớp nguồn gốc. Module/settings/schema fingerprints không đổi từ lúc tiếp quản đến sau toàn bộ test.
- 16/16 module trên từng DB khớp SQL hiện hành trong `BÀI TẬP LỚN` sau chuẩn hóa comment xuất file, line endings và cách SQL Server lưu `CREATE OR ALTER`.
- Không có `ExamAttempts.MaxPoints`, không auth/session/domain table mới, không migration hoặc thay đổi tính điểm.

**Lưu ý nguồn có sẵn:** live/BAK gốc có hai chuỗi thông báo tiếng Việt mojibake và `QUOTED_IDENTIFIER` khác SQL export. Điều này đã được ghi trong receipt coursework ngày 19/10, trước dự án web. Ứng dụng hiện có được phiên trước tạo từ SQL export mới, giữ logic gốc. Không sửa BAK/SQL/live để che khác biệt; không tuyên bố byte-identical giữa hai nguồn vốn khác nhau. `check-host-contract.ps1` hỗ trợ baseline backup hoặc SQL một cách rõ ràng.

## Triển khai và bàn giao tiếp

Đã chuẩn bị `backend/Dockerfile`, `render.yaml` (chỉ plan Free), `.env.production.example`, Vercel link/config, theme OIDC, script fingerprint, gate remote và đóng gói source có whitelist. Không provision tài nguyên có phí, không mở SQL local ra Internet.

Ứng viên $0: Render Free Docker + MonsterASP.NET Free SQL Server + Google OIDC. Đây là phương án cần kiểm chứng trên tài khoản thật, không phải deployment đã hoàn thành. Giới hạn thực tế và từng bước chủ tài khoản cần làm ở `docs/DEPLOYMENT.md`. Điểm chặn hiện tại là quyền/tài khoản provider và kiểm chứng TLS/restore/locking/triggers trên host đó; không phải lỗi build local.

Source đóng gói ở `release/english-exam-source.zip`; request Vercel tái lập ở `release/vercel-request.json`. Không chứa secret, SQL/BAK, local runtime hoặc dữ liệu đăng nhập. Không commit/push vì workspace chưa có Git remote. Bản public còn preview; giữ `APP_SERVICE_MODE=preview` đến khi full-stack gate trên host thật đạt.
