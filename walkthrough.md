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

## 4. Kiểm tra lỗi (Nếu có)
*   **Không thấy Drone trên Web:** Kiểm tra xem ESP32 có kết nối được Wifi không (xem qua Serial Monitor của Arduino/Thonny).
*   **Web không cập nhật:** Đảm bảo container `redis` và `mqtt_listener` đang chạy trong Docker Desktop.
