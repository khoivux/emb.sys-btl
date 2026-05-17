# Hướng dẫn sử dụng: Hệ thống Quản lý Drone

Hệ thống cho phép theo dõi và điều khiển Drone thời gian thực. Dưới đây là các bước để vận hành hệ thống.

## 1. Chuẩn bị Phần cứng (ESP32)
1.  **Cài đặt Firmware:** Nạp code trong thư mục `esp32-firmware/` vào ESP32.
    *   Đảm bảo file `mqtt.py` và `main.py` là bản mới nhất.
2.  **Cấu hình Wifi & Server:** Mở `main.py` trên ESP32, sửa `WIFI_SSID`, `WIFI_PASS` và `MQTT_SERVER` (IP máy tính của bạn).
3.  **Cấp nguồn:** Bật nguồn ESP32, nó sẽ tự động kết nối và gửi dữ liệu về hệ thống.

## 2. Khởi động Hệ thống (Máy tính)
Yêu cầu: Đã cài đặt Docker và Docker Desktop.

1.  Mở Terminal tại thư mục gốc của dự án.
2.  Chạy lệnh:
    ```powershell
    docker-compose up --build
    ```
3.  Truy cập giao diện Web tại địa chỉ: `http://localhost:5173` (hoặc IP máy tính của bạn port 5173).

## 3. Các thao tác trên Giao diện Web
### A. Quét và Nhận Drone (Tab Discovery)
1.  Vào tab **Discovery** (biểu tượng Radar).
2.  Khi ESP32 hoạt động, nó sẽ hiện lên trong danh sách "Drone mới phát hiện".
3.  Nhấn nút **Nhận Drone** và đặt tên cho thiết bị (ví dụ: Drone-01).

### B. Quản lý và Theo dõi (Tab My Drones)
1.  Vào tab **My Drones** để xem danh sách các thiết bị bạn đang sở hữu.
2.  **Trạng thái Real-time:** Thẻ Drone sẽ sáng xanh khi Online và chuyển sang xám khi Offline (rút nguồn) ngay lập tức mà không cần F5.
3.  **Sửa/Xóa:** Nhấn biểu tượng Bút chì để đổi tên hoặc Thùng rác để xóa drone khỏi tài khoản.

### C. Điều khiển và Radar (Tab Dashboard)
1.  Xem vị trí các Drone trên bản đồ thời gian thực.
2.  Sử dụng bảng điều khiển bên phải để gửi lệnh cho Drone (Cất cánh, Hạ cánh, Bay tới tọa độ...).

## 4. Cấu hình Điều khiển Drone qua Internet (Sử dụng Ngrok)

Để điều khiển ESP32 từ bất kỳ nơi đâu (mạng WiFi khác, mạng 3G/4G của điện thoại...) mà không cần cắm chung WiFi với máy tính chạy server, chúng ta sử dụng **Ngrok TCP Tunnel** chạy tự động trong Docker.

### Bước 1: Lấy mã Authtoken của Ngrok
1. Đăng ký một tài khoản miễn phí tại [ngrok.com](https://ngrok.com/).
2. Truy cập [Your Authtoken](https://dashboard.ngrok.com/get-started/your-authtoken) để copy mã Token bảo mật của bạn.
3. *Lưu ý quan trọng:* Do giao thức TCP (dùng cho MQTT) yêu cầu xác minh để chống lạm dụng, bạn cần vào [settings#id-verification](https://dashboard.ngrok.com/settings#id-verification) để liên kết một thẻ ngân hàng thanh toán (Credit/Debit Card) để xác minh tài khoản. **Ngrok cam kết miễn phí 100%, không trừ tiền thẻ của bạn.**

### Bước 2: Cấu hình mã Authtoken vào file `.env`
1. Mở file `.env` ở thư mục gốc của dự án.
2. Sửa lại dòng cấu hình token theo định dạng viết liền nhau (không dùng khoảng trắng và không dùng dấu ngoặc kép):
   ```env
   NGROK_AUTHTOKEN=3DqOccccccccccccccccRePoS1L9AwKnAr
   ```
*(File `.env` đã được cấu hình trong `.gitignore` nên sẽ được bảo mật tuyệt đối, không bao giờ bị đẩy lên GitHub).*

### Bước 3: Khởi động container Ngrok
Mở Terminal tại thư mục gốc dự án và chạy lệnh sau để khởi chạy dịch vụ Ngrok ngầm:
```powershell
docker-compose up -d --build ngrok
```

### Bước 4: Lấy địa chỉ Public và nạp code cho ESP32
1. Mở trình duyệt web của bạn và truy cập địa chỉ:
   👉 **[http://localhost:4040/status](http://localhost:4040/status)**
2. Tìm đến phần **Tunnels** và copy địa chỉ TCP công khai được cung cấp, ví dụ:
   `tcp://0.tcp.ap.ngrok.io:17900`
3. Mở file `esp32-firmware/main.py` của ESP32, cấu hình lại các giá trị tương ứng:
   *   `MQTT_SERVER = "0.tcp.ap.ngrok.io"` (Tên miền máy chủ)
   *   `MQTT_PORT = 17900` (Cổng kết nối sau dấu hai chấm)
4. Nạp code mới này vào chip ESP32 và cấp nguồn cho thiết bị. ESP32 sẽ tự động kết nối qua Internet và đồng bộ trực tiếp tới giao diện Web của bạn.

---

## 5. Kiểm tra lỗi (Nếu có)
*   **Không thấy Drone trên Web:** Kiểm tra xem ESP32 có kết nối được Wifi không (xem qua Serial Monitor của Arduino/Thonny).
*   **Không khởi động được Ngrok:** Kiểm tra lại logs của container ngrok (`docker-compose logs ngrok`) để xem mã Authtoken đã đúng chuẩn và tài khoản đã được xác minh liên kết thẻ chưa.
*   **Web không cập nhật:** Đảm bảo container `redis` và `mqtt_listener` đang chạy trong Docker Desktop.
