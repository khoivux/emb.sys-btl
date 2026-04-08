# 🏗️ Drone Management System Architecture

Tài liệu này giải thích cấu trúc thư mục và vai trò của các thành phần trong hệ thống quản lý drone realtime.

---

## 📂 Cấu trúc thư mục (Folder Structure)

```text
├── backend-app/          # Backend (Django, Channels, MQTT Bridge)
├── frontend-app/         # Dashboard (React, Tailwind, Leaflet)
├── esp32-firmware/       # Mã nguồn cho Drone thật (MicroPython)
├── infrastructure/       # Hạ tầng (Docker, MQTT Broker)
├── tools/                # Công cụ giả lập (Mock Drone)
└── walkthrough.md        # Hướng dẫn vận hành nhanh
```

---

## 🧩 Vai trò các thành phần

### 1. 🛠️ esp32-firmware (The Drone)
Đây là "trái tim" của phần cứng. 
- **Vai trò:** Chạy máy trạng thái (FSM) để điều khiển Drone (Cất cánh, Bay, Hạ cánh).
- **Giao tiếp:** Sử dụng giao thức **MQTT** để gửi dữ liệu cảm biến (GPS, Pin) lên hệ thống mỗi 1 giây.

### 2. 📡 infrastructure (The Broker)
- **Thành phần chính:** Eclipse Mosquitto (chạy trong Docker).
- **Vai trò:** Đóng vai trò là "trạm trung chuyển" tin nhắn. Mọi thông tin từ Drone gửi lên và mọi lệnh từ Dashboard gửi xuống đều phải đi qua Broker này.

### 3. 🧠 backend-app (The Brain)
Đây là trung tâm điều phối dữ liệu, gồm 3 lớp:
- **MQTT Bridge (`realtime/mqtt_bridge.py`):** Lắng nghe dữ liệu từ Drone thông qua Broker, sau đó vừa lưu vào cơ sở dữ liệu (SQLite), vừa đẩy dữ liệu đó lên WebSockets.
- **WebSockets (Django Channels):** Tạo một đường truyền "mở" liên tục tới trình duyệt. Khi có tọa độ mới từ drone, Backend sẽ "đẩy" ngay lập tức lên giao diện mà không cần tải lại trang.
- **REST API:** Cung cấp các endpoint để Frontend gửi lệnh điều khiển (như lệnh cất cánh, hạ cánh).

### 4. 📊 frontend-app (The Dashboard)
- **Vai trò:** Hiển thị tọa độ Drone lên bản đồ vệ tinh (Leaflet Map).
- **Real-time:** Sử dụng `useDroneSocket` để nhận dữ liệu WebSockets từ Backend và cập nhật vị trí Drone mượt mà bằng CSS transitions.

---

## 🔄 Luồng dữ liệu (Data Flow)

Để hiển thị 1 điểm trên bản đồ, dữ liệu đi qua lộ trình sau:
1. **[Drone]** → Gửi tọa độ qua MQTT Topic `drone/telemetry`.
2. **[Broker]** → Nhận và chuyển tiếp tới Backend.
3. **[Backend]** → MQTT Bridge nhận được, lưu vào SQL và gửi qua WebSocket Group `drone_updates`.
4. **[Frontend]** → WebSocket Client nhận được và render lên bản đồ React-Leaflet.

---

## 🛠️ Công nghệ sử dụng (Tech Stack)

- **Language:** Python 3.10+, JavaScript (ES6+), MicroPython.
- **Backend:** Django, Django Channels (ASGI), Daphne server.
- **Frontend:** React, Vite, Tailwind CSS, Leaflet.js.
- **DevOps:** Docker, Docker-compose.
