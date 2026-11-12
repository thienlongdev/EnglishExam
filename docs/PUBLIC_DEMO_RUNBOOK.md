# Vận hành website demo công khai

Website: https://english-exam-coursework.vercel.app/

Frontend ở Vercel. Spring Boot, SQL Server và Keycloak chạy riêng cho EnglishExamWeb trên PC Windows này. Cloudflare Quick Tunnel cung cấp HTTPS miễn phí. Không dùng tài nguyên English Coach. Máy phải bật, không sleep, Docker Desktop và kết nối Internet phải hoạt động trong buổi thầy cô sử dụng.

## Đăng ký và duyệt tài khoản

1. Thầy cô mở website → **Đăng nhập** → **Tiếp tục đăng nhập** → **Đăng ký / Register** trên Keycloak; nhập username, email, họ tên và mật khẩu của mình.
2. Tài khoản mới chờ duyệt. Đăng ký không tự cấp quyền giảng viên hoặc tự xác minh email. Không có SMTP/email xác minh tự động; chủ dự án xác minh danh tính và email trực tiếp trước khi duyệt.
3. Trên PC của chủ dự án, mở PowerShell tại `C:\BTL-CSDL\EnglishExamWeb`:

```powershell
python scripts\demo-accounts.py list
python scripts\demo-accounts.py approve --username TEN_DANG_NHAP --role teacher --identity-verified-by-owner
```

Chỉ chạy lệnh duyệt cho đúng người bạn đã xác minh. Công cụ tự liên kết `Users` trong `EnglishExamDB_Demo`, cấp quyền teacher và tạo một lớp riêng nếu giáo viên chưa có lớp. Không cấp quyền quản trị Keycloak. Thầy cô phải đăng xuất rồi đăng nhập lại để nhận trạng thái đã duyệt.

Học viên cũng có thể tự đăng ký. Sau khi xác minh, duyệt với `--role student`; giảng viên vào **Lớp phụ trách → Danh sách học viên**, ghi danh email học viên vào lớp mình. Student-only không được tạo, công bố hoặc giao đề. Công cụ duyệt không tự ghi danh vào lớp của giảng viên khác.

Các tài khoản QA sẵn có dành riêng demo được lưu trong `.local/demo/qa-credentials.json`; tài khoản QA đăng ký qua trình duyệt nằm ở `.local/demo/registration-qa.json`. Không đưa những tệp này lên web, Git hoặc báo cáo. Không dùng chung tài khoản QA thay cho tài khoản riêng của thầy cô.

## Mở lại demo

```powershell
Set-Location C:\BTL-CSDL\EnglishExamWeb
.\scripts\start-demo.ps1
```

Script chỉ quản lý đúng runtime EnglishExamWeb, không khởi tạo lại hay reset database. Nếu tunnel vẫn chạy, script giữ nguyên hostname và phiên backend. Nếu tunnel đã dừng hoặc PC khởi động lại, Quick Tunnel cấp hostname mới.

Nếu đầu ra có `RequiresVercelRedeploy: true`, website chưa kết nối tới hostname mới. Cần cập nhật **BACKEND_URL chỉ ở Production** của project Vercel `english-exam-coursework` / `prj_gBzNA7EV8w2vOUrQ52vo3KyZYcTX` theo giá trị `BackendUrl` vừa in, rồi deploy lại frontend đã kiểm tra. `APP_SERVICE_MODE=live` chỉ ở Production; Preview vẫn là `preview`. Có thể yêu cầu Codex thực hiện bước này qua kết nối Vercel đang có. Không tạo project khác, không cần Git push, không dùng tài khoản/domain Cloudflare của English Coach.

Script tự cập nhật issuer Keycloak và backend theo hostname mới. Callback OIDC luôn là `https://english-exam-coursework.vercel.app/login/oauth2/code/exam`; post-logout luôn là URL gốc Vercel. Khi đổi tunnel hoặc restart backend, người đang sử dụng cần đăng nhập lại. Kết quả và đáp án đã lưu vẫn ở SQL.

## Kiểm tra và sao lưu

```powershell
node scripts\production-readiness.mjs
.\scripts\backup-demo.ps1
```

Preflight chỉ kiểm tra công khai chưa đăng nhập; không thay thế E2E đầy đủ. Backup tạo bản `COPY_ONLY`, kiểm checksum và `RESTORE VERIFYONLY` cho hai database demo; lưu trong `.local/demo`. Không restore đè dữ liệu khi rollback frontend.

Tệp vận hành riêng tư: `.local/demo/runtime.json`, `secrets.json`, `keycloak.env`, `backend.log`, `gateway-error.log`, `tunnel-error.log`. Chỉ URL/issuer trong `runtime.json` là cấu hình công khai; không chia sẻ các tệp bí mật. Không sửa/import realm phát triển cũ để đưa lên Internet.

## Dừng có chủ đích

```powershell
.\scripts\stop-demo.ps1
```

Website sẽ không làm bài/đăng nhập được khi dịch vụ dừng. Database và kết quả không bị xóa. Để công bố trạng thái bảo trì lâu hơn, đặt `APP_SERVICE_MODE=preview` cho Production và redeploy, hoặc rollback về deployment bảo trì `dpl_3YeaGboWWwi1UdwLztQutz9ENCbq`. Chỉ rollback frontend; không ghi đè database bằng bản backup cũ.

## Giới hạn đã chấp nhận

- Quick Tunnel không có SLA và hostname thay đổi khi tạo lại. Đây là demo công khai chạy trong thời gian PC sẵn sàng, không phải dịch vụ 24/7.
- Cổng SQL, backend trực tiếp, Keycloak trực tiếp và gateway chỉ bind loopback. Gateway chỉ công khai API ứng dụng, callback và OIDC của realm demo; chặn admin, master realm, account console, metrics và actuator.
- Đăng ký có thật; cấp quyền cần chủ dự án duyệt. Không có email gửi tự động hay tự phục hồi mật khẩu qua email trong đợt này.
- Phiên Spring ở RAM; restart cần đăng nhập lại. Dữ liệu nghiệp vụ và Keycloak lưu bền trong hai database SQL Server riêng trên volume hiện có của EnglishExamWeb.
- Hết `DeadlineAt` thì không được lưu thêm đáp án. Đáp án đã lưu vẫn nộp được sau hạn. Tự nộp chỉ hoạt động khi trang thi còn mở; không có scheduler tự nộp khi đóng trình duyệt.
