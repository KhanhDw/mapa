# Chia sẻ môi trường dev qua ngrok

Hướng dẫn này public frontend Vite qua một URL HTTPS của ngrok. API, ảnh 360,
vector tiles và satellite tiles được proxy qua frontend, nên người test chỉ cần
mở một URL và máy chủ database không bị đưa trực tiếp ra Internet.

## Cài đặt lần đầu (Windows)

1. Cài ngrok:

   ```powershell
   winget install --id Ngrok.Ngrok -e --source winget
   ```

2. Tạo tài khoản tại [ngrok.com](https://ngrok.com/), lấy authtoken trong
   dashboard rồi cấu hình trong PowerShell:

   ```powershell
   ngrok config add-authtoken <AUTHTOKEN>
   ngrok config check
   ```

   Không lưu authtoken vào repository, `.env`, hoặc chia sẻ token với người test.

## Chạy để mời người khác test

Mở các terminal riêng tại thư mục gốc của repository:

1. Khởi chạy PostGIS và các dịch vụ tile:

   ```powershell
   docker compose up -d
   ```

2. Khởi chạy API (sau khi đã cấu hình `backend/.env`):

   ```powershell
   .\backend\myenv\Scripts\Activate.ps1
   python -m backend.main
   ```

3. Khởi chạy giao diện:

   ```powershell
   Set-Location .\fontend
   npm run dev
   ```

4. Trong terminal khác, mở tunnel đến cổng Vite:

   ```powershell
   ngrok http 5173
   ```

5. Gửi URL HTTPS được ngrok hiển thị cho người test. Giữ các terminal và máy
   tính đang chạy trong suốt buổi test; dừng tunnel bằng `Ctrl+C`.

Chỉ các domain `*.ngrok-free.app` và `*.ngrok.app` được cho phép làm host của
Vite dev server. Không public các cổng database (5432) hoặc dịch vụ nội bộ khác.
Các URL ngrok miễn phí có thể thay đổi khi tạo tunnel mới.

URL tunnel là public: bất kỳ ai có URL đều có thể truy cập ứng dụng trong lúc
tunnel đang chạy. Chỉ chia sẻ dữ liệu dev phù hợp để public; không gửi URL nếu
bạn cần giới hạn người truy cập.
