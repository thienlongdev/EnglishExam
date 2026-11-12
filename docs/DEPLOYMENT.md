# Triển khai miễn phí — kiểm tra ngày 02/11/2026

## Hiện trạng thực tế

Vercel team **Long / long-a2b9**, gói **Hobby**, đã xác minh trong giao diện của chủ tài khoản. Project `prj_gBzNA7EV8w2vOUrQ52vo3KyZYcTX`, tên `english-exam-coursework`. Không nâng gói, không mua dịch vụ.

Frontend public: https://english-exam-coursework.vercel.app. `APP_SERVICE_MODE=preview`: landing hoạt động; login thông báo cổng thi chưa mở; API trả 503 `SERVICE_NOT_READY`, OAuth/protected routes quay về trang thông báo. Đây chưa phải bản triển khai đầy đủ hệ thống thi.

## Phương án $0 có thể kiểm chứng tiếp

| Phần | Ứng viên | Giới hạn được xác minh | Chưa xác minh trên tài khoản thật |
|---|---|---|---|
| Frontend | Vercel Hobby | Dùng cá nhân/phi thương mại, giới hạn sử dụng; không nâng gói | Không còn chặn frontend |
| Backend | Render Free Docker | Chạy JVM trong Docker; ngủ sau 15 phút không có request, khởi động lại khoảng một phút; 750 giờ/workspace/tháng; filesystem không bền; có thể restart/suspend | Cold start, OIDC cookie qua proxy, SQL outbound và tải đồng thời |
| Database | MonsterASP.NET Free MSSQL | SQL Server 2025, 1 DB/1 GB, remote SQL, restore `.bak`; không thẻ, không tự chuyển trả phí; không daily backup/SLA/IP whitelist; dịch vụ bất hoạt 6 tháng có thể bị lưu trữ | Restore backup cụ thể, quyền tối thiểu, application locks, giao dịch và toàn bộ 10 trigger |
| OIDC | Google OpenID Connect | Authorization Code, issuer discovery, `openid profile email`, email đã xác minh; tương thích Spring Security qua cấu hình | OAuth client của chủ tài khoản, email khớp `Users`, callback production |

Render khuyến cáo Free không dành cho ứng dụng production cần bảo đảm uptime. Phiên Spring nằm trong RAM nên restart sẽ yêu cầu đăng nhập lại; đáp án đã lưu vẫn ở SQL. Không thêm bảng session. Không dùng keep-alive giả để lách giới hạn.

MonsterASP công bố remote TLS bằng chứng chỉ tự ký và đề nghị `TrustServerCertificate=True`. Điều đó mã hóa nhưng không xác thực danh tính server. Với cổng thi thực tế, cần xin CA/certificate để truststore Java xác thực được hostname/certificate; chưa có chứng chỉ thì chưa đạt gate bảo mật production. Không tự hạ `encrypt` hoặc bỏ kiểm tra chứng chỉ để làm cho kết nối chạy.

Không thể kết luận rằng không tồn tại tổ hợp miễn phí. Có ứng viên thực tế, nhưng chưa có tài khoản/endpoint để kiểm chứng. Cũng không thể bảo đảm một dịch vụ thi luôn sẵn sàng ở mức $0 với các giới hạn này. Không dùng Azure. Không triển khai lên VPS hiện hữu. Không chọn trial tự tính tiền.

## Các bước chủ tài khoản cần hoàn thành

### 1. SQL Server

1. Mở https://www.monsterasp.net/ và đăng ký **Free**, xác minh email. Không chọn Premium hoặc nhập thanh toán.
2. Trong Control Panel → Databases, tạo **một CSDL MSSQL mới dành riêng dự án**. Xác nhận engine SQL Server 2025; tuyệt đối không restore vào CSDL chứa dữ liệu khác.
3. Database → Backups → Upload BAK: dùng nguyên tệp `C:\BTL-CSDL\BÀI TẬP LỚN\EnglishExamDB.bak`. Giữ safety backup khi restore. Không chạy lại script DROP/CREATE, không sửa procedures/triggers. Backup chứa metadata gốc; các chuỗi thông báo mojibake đã tồn tại từ trước và không cần sửa.
4. Database → Users → Remote access → Enabled. Dùng hostname `*.public.databaseasp.net` provider cấp; không đoán hostname/IP.
5. Tạo app user riêng bằng quyền tối thiểu tương đương `scripts/provision-local.ps1`; không dùng tài khoản admin cho Spring. Cần `SELECT`, `VIEW DEFINITION`, bốn quyền `EXECUTE` và quyền viết nội dung/lớp được liệt kê; không DDL và không ghi trực tiếp `ExamAttempts`/`StudentAnswers`.
6. Xin certificate/CA chính thức cho TLS và cấu hình Java truststore. Lưu thông tin kết nối vào secret manager, không dán mật khẩu vào chat.
7. Chạy đối chiếu metadata với `evidence/original-before.json` khi dùng BAK. Nếu provider thêm bảng ứng dụng/đổi module hoặc không cấp đủ quyền, không bật production. Không sửa schema để thích nghi host.

### 2. OIDC miễn phí

1. Vào https://console.cloud.google.com/auth/overview tạo/chọn project chỉ cho OIDC. Không bật dịch vụ có phí hoặc billing.
2. Branding/Audience: tên English Exam, email hỗ trợ của chủ tài khoản, các mục consent thật. Nếu dùng chế độ Testing, thêm đúng người dùng được phép.
3. Clients → Create client → **Web application**. Callback chính xác: `https://english-exam-coursework.vercel.app/login/oauth2/code/exam`.
4. Lưu client ID/secret vào Render secret manager. `OIDC_ISSUER=https://accounts.google.com`. Scope giữ `openid,profile,email`.
5. Chỉ email có trong bảng `Users`, đang hoạt động và claim `email_verified=true` mới được vào hệ thống. Không thay đổi schema để tạo tài khoản/role/session.

Có thể dùng OIDC provider miễn phí khác đáp ứng cùng contract; không đưa realm Keycloak development hoặc mật khẩu demo lên Internet. Kiểm chứng local bằng Keycloak không thay thế kiểm thử Google production.

### 3. Backend Render Free

1. Đăng nhập https://dashboard.render.com. Giữ tài khoản không phương thức thanh toán nếu mục tiêu tuyệt đối không phát sinh phí; vượt quota sẽ dừng dịch vụ/build theo chính sách Render.
2. Đưa source đã kiểm tra lên repository của chủ tài khoản hoặc registry riêng; không push `.env`, `.local`, SQL/BAK hay test credentials. Chưa có remote Git cho workspace này.
3. New → Blueprint chọn `render.yaml`, hoặc Web Service → Docker với `backend/Dockerfile`, Docker context `backend`. Chọn **Free**, một instance, vùng Frankfurt gần database EU.
4. Set `APP_ORIGIN` bằng URL frontend đã xác minh, `COOKIE_SECURE=true`, `SERVER_ADDRESS=0.0.0.0`, `DB_URL/DB_USERNAME/DB_PASSWORD`, `OIDC_ISSUER/OIDC_CLIENT_ID/OIDC_CLIENT_SECRET`. Render tự cấp `PORT`.
5. Giữ `healthCheckPath=/actuator/health`. Không chạy `seed-demo.sql`, không thêm PostgreSQL/Redis hoặc paid disk. Không chạy test fixture vào DB thật.
6. Deploy, xác minh health `UP`, JDBC và OIDC discovery trước khi sửa frontend.

### 4. Bật cổng thi trên Vercel sau kiểm chứng

1. Project Settings → Environment Variables: `BACKEND_URL=https://<backend-host-đã-xác-minh>`, `APP_SERVICE_MODE=live` cho một preview riêng dùng OIDC callback tương ứng; kiểm tra trước khi áp dụng production.
2. Gate bắt buộc: fingerprint metadata; TLS; OIDC thật + cookie Secure/HttpOnly/SameSite; CSRF; học viên đúng lớp; không lộ đáp án đúng; start/save/submit/result qua procedures; refresh; role giảng viên; mất mạng; lịch/giới hạn; đồng thời và hết giờ. Các bài QA chỉ chạy trong DB staging cô lập.
3. Sau khi pass trên host thật, redeploy production bằng đúng artifact. Các rewrite được cấu hình lúc build; đổi env cần redeploy.
4. Rollback frontend về deployment trước hoặc đặt lại `APP_SERVICE_MODE=preview`. Không rollback dữ liệu bằng ghi đè database đang sử dụng.

## Nguồn chính thức

- https://vercel.com/docs/plans/hobby
- https://vercel.com/docs/limits — external rewrite timeout 120 giây.
- https://render.com/docs/docker
- https://render.com/docs/free
- https://help.monsterasp.net/getting-started/first-steps/free-vs-premium
- https://help.monsterasp.net/databases/mssql/remote-access
- https://help.monsterasp.net/databases/mssql/restore
- https://help.monsterasp.net/databases/mssql/secure-connection
- https://developers.google.com/identity/openid-connect/openid-connect
