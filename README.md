# Narra Affiliate

Cổng đối tác Narra và Merchant Center.

## Build

Chạy `npm ci` và `npm run build:vercel` để chuẩn bị bản Vercel. `npm run build` tạo bundle Worker cho Sites.

## Triển khai

Vercel phục vụ giao diện từ mã nguồn này và gọi Worker của Sites để dùng chung quyền truy cập, tài khoản và hồ sơ đối tác trong D1.

- Sites cần `NARRA_VERCEL_ORIGIN` trỏ tới tên miền Vercel chính thức. Cấu hình `PORTAL_KEY` và `PORTAL_OWNER_EMAIL` đặt trong runtime của Sites.
- Project Vercel cần `NARRA_VERCEL_ORIGIN`, `NARRA_SITES_SERVICE_TOKEN` và `NARRA_VERCEL_SESSION_KEY` trong môi trường Production. Khóa phiên là chuỗi hex ngẫu nhiên 64 ký tự. Đặt token dịch vụ và khóa phiên ở dạng Sensitive.
- Sau khi triển khai Worker, môi trường Vercel có thể build bằng cấu hình trong `vercel.json`.

Tùy chọn giao diện lưu trong trình duyệt thuộc từng tên miền.
