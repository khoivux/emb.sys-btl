# Hướng dẫn sử dụng: Hệ thống Quản lý Drone

Hệ thống cho phép theo dõi và điều khiển Drone thời gian thực bằng Web Dashboard. Dưới đây là các bước chi tiết để cấu hình và vận hành hệ thống.

---

## 1. Chuẩn bị Phần cứng (ESP32)

### A. Nạp Firmware vào ESP32
Mở Thonny hoặc phần mềm nạp tương đương, nạp 4 tệp trong thư mục `esp32-firmware/` vào thư mục gốc của ESP32:
*   `boot.py`: Kích hoạt quản lý kết nối khi khởi động.
*   `wifimanager.py`: Quản lý AP WiFi, Web Server, DNS Server và kiểm tra trạng thái nút BOOT.
*   `main.py`: Chương trình gửi telemetry và nhận lệnh điều khiển.
*   `mqtt.py`: Thư viện kết nối MQTT.

### B. Cấu hình WiFi & Server lần đầu
1.  **Cấp nguồn:** Bật nguồn hoặc cắm cáp USB cho ESP32.
2.  Do chưa có cấu hình mạng, ESP32 tự động phát WiFi tên là **`Drone_Setup_AP`** (không mật khẩu).
3.  **Mở giao diện cấu hình:**
    *   **Điện thoại:** Kết nối vào WiFi `Drone_Setup_AP`, cửa sổ Web Portal cấu hình sẽ tự động hiển thị trên màn hình.
    *   **Máy tính:** Kết nối vào WiFi `Drone_Setup_AP` và truy cập địa chỉ `http://192.168.4.1` trên trình duyệt.
4.  **Nhập thông tin mạng:**
    *   `WiFi SSID`: Tên WiFi cần kết nối.
    *   `WiFi Password`: Mật khẩu WiFi tương ứng.
    *   `Máy chủ MQTT`: Địa chỉ IP máy tính chạy Docker (hoặc tên miền Ngrok).
    *   `Cổng MQTT`: Cổng dịch vụ MQTT (mặc định `1883`, hoặc cổng do Ngrok cấp).
5.  Nhấn **LƯU CẤU HÌNH**. ESP32 sẽ lưu cấu hình vào bộ nhớ, ngắt phát AP, tự khởi động lại và kết nối vào hệ thống.

### C. Đổi mạng WiFi hoặc Reset cấu hình
Khi cần thay đổi mạng WiFi hoặc máy chủ MQTT:
1.  Nhấn nút **Reset (EN)** trên mạch ESP32 để khởi động lại chip.
2.  Ngay khi bắt đầu khởi động, màn hình Shell của Thonny sẽ hiển thị thông báo:
    `⏳ Nhấn giữ nút BOOT ngay bây giờ (trong 2s tiếp theo) để reset cấu hình...`
3.  **Nhấn giữ nút BOOT** trên mạch trong 3 giây. Trạng thái đếm ngược sẽ hiển thị trên Shell:
    `⏱️ Đã giữ 1 giây...` -> `⏱️ Đã giữ 2 giây...` -> `⏱️ Đã giữ 3 giây...`
4.  Sau khi giữ đủ 3 giây, tệp cấu hình `config.json` sẽ bị xóa và ESP32 tự động phát lại WiFi **`Drone_Setup_AP`** để cấu hình mới. *(Nếu thả tay trước 3 giây, chip sẽ bỏ qua lệnh và tiếp tục chạy với cấu hình cũ).*

---

## 2. Khởi động Hệ thống (Máy tính)
Yêu cầu: Đã cài đặt Docker và Docker Desktop.

1.  Mở Terminal tại thư mục gốc của dự án.
2.  Khởi động các dịch vụ bằng lệnh:
    ```powershell
    docker-compose up --build
    ```
3.  Truy cập giao diện Web Dashboard tại: `http://localhost:5173`.

---

## 3. Các thao tác trên Giao diện Web
### A. Quét và Nhận Drone (Tab Radar - Quét thiết bị)
1.  Vào tab **Quét thiết bị** (biểu tượng Radar).
2.  Khi ESP32 được bật nguồn và kết nối thành công, thiết bị sẽ tự động xuất hiện thời gian thực trên bản đồ Radar.
3.  Nhấn **Ghép đôi ngay** và đặt tên cho Drone để gán thiết bị vào tài khoản.
4.  Khi ngắt nguồn ESP32, sau 10-15 giây (khi hết thời gian keepalive), biểu tượng của thiết bị sẽ tự động biến mất khỏi màn hình Radar.

### B. Theo dõi trạng thái (Tab My Drones)
1.  Vào tab **My Drones** để xem danh sách thiết bị sở hữu.
2.  Trạng thái Online/Offline cùng các thông số Pin, kinh độ, vĩ độ được cập nhật liên tục thông qua kết nối WebSocket.

---

## 4. Cấu hình Điều khiển qua Internet (Sử dụng Ngrok)

Để vận hành hệ thống từ xa ngoài mạng nội bộ:

### Bước 1: Lấy mã Authtoken của Ngrok
1.  Đăng nhập tài khoản tại [ngrok.com](https://ngrok.com/).
2.  Lấy mã tại mục [Your Authtoken](https://dashboard.ngrok.com/get-started/your-authtoken).
3.  Liên kết thẻ tại mục [settings#id-verification](https://dashboard.ngrok.com/settings#id-verification) để xác minh tài khoản sử dụng TCP Tunnel (miễn phí).

### Bước 2: Cấu hình tệp `.env`
1.  Mở tệp `.env` ở thư mục gốc dự án.
2.  Điền token vào cấu hình:
    ```env
    NGROK_AUTHTOKEN=3DqOccccccccccccccccRePoS1L9AwKnAr
    ```

### Bước 3: Khởi động container Ngrok
Chạy lệnh khởi động dịch vụ Ngrok:
```powershell
docker-compose up -d --build ngrok
```

### Bước 4: Lấy địa chỉ Public và cấu hình cho ESP32
1.  Truy cập **[http://localhost:4040/status](http://localhost:4040/status)** trên trình duyệt.
2.  Sao chép địa chỉ TCP công khai tại mục **Tunnels** (ví dụ: `tcp://0.tcp.ap.ngrok.io:17900`).
3.  Kết nối vào WiFi `Drone_Setup_AP` của ESP32 và nhập thông tin tương ứng vào giao diện Web Portal:
    *   **Máy chủ MQTT:** `0.tcp.ap.ngrok.io`
    *   **Cổng MQTT:** `17900`
4.  Lưu cấu hình để hoàn tất kết nối.

---

## 5. Xử lý sự cố
*   **Không thấy Drone xuất hiện:** Kiểm tra trạng thái kết nối mạng của ESP32 qua Serial Monitor trên Thonny.
*   **Container Ngrok lỗi:** Kiểm tra log container bằng lệnh `docker-compose logs ngrok` để xác minh mã Authtoken hoặc trạng thái tài khoản.
