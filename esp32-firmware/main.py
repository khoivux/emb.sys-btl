import network
import time
import ubinascii
import machine
import ujson as json
import math
from mqtt import MQTTClient

# --- 1. CẤU HÌNH HỆ THỐNG ---
from boot import MQTT_SERVER, MQTT_PORT

# Tự động lấy ID duy nhất của chip ESP32 (MAC Address)
raw_id = machine.unique_id()
CLIENT_ID = ubinascii.hexlify(raw_id).decode() 

TOPIC_TELEMETRY = b"drone/telemetry"
TOPIC_COMMAND = b"drone/" + CLIENT_ID.encode() + b"/command"

# --- 2. TRẠNG THÁI DRONE ---
state = "IDLE"
lat, lng, alt = 20.980812, 105.795931, 0.0
target_lat, target_lng = lat, lng
battery = 95.0
yaw = 0  # Góc hướng đầu (heading) của drone

# Biến vận tốc & thời gian để điều khiển giữ phím mượt mà
vx, vy, vz, v_yaw = 0.0, 0.0, 0.0, 0.0
last_vx_update = 0
last_vy_update = 0
last_vz_update = 0
last_vyaw_update = 0

# --- 3. KẾT NỐI WIFI ---
# WiFi đã được kết nối tự động trong file boot.py

# --- 4. XỬ LÝ LỆNH TỪ WEB ---
def on_message(topic, msg):
    global state, target_lat, target_lng, lat, lng, alt, yaw
    global vx, vy, vz, v_yaw, last_vx_update, last_vy_update, last_vz_update, last_vyaw_update
    try:
        data = json.loads(msg)
        # Sửa: Backend gửi key "type" thay vì "command"
        cmd = data.get("type") 
        params = data.get("params", {}) # Lấy các tham số đi kèm (như tọa độ GOTO)
        
        # Chỉ print những lệnh cấu hình/quan trọng để tránh tràn console
        if cmd in ("TAKEOFF", "LAND", "GOTO", "EMERGENCY"):
            print("Lệnh hệ thống nhận được:", cmd)
        
        if cmd == "TAKEOFF": 
            state = "TAKEOFF"
        elif cmd == "LAND": 
            state = "LANDING"
        elif cmd == "GOTO":
            state = "MOVING"
            # Sửa: Lấy tọa độ từ trong object params
            target_lat = params.get("lat", lat)
            target_lng = params.get("lng", lng)
            print(f"🚩 Đang bay tới: {target_lat}, {target_lng}")
        elif cmd == "EMERGENCY": 
            state = "IDLE"
            machine.reset()
        elif cmd == "MOVE":
            # Chỉ cho phép di chuyển thủ công khi drone đang bay (alt > 2m)
            if alt > 2.0:
                state = "HOVER"  # Hủy di chuyển tự động GOTO
                direction = params.get("direction")
                now = time.ticks_ms()
                
                # Cập nhật vận tốc mục tiêu (bước nhỏ hơn để cực kỳ mượt mà ở 20Hz)
                step = 0.000003  # Tương đương ~0.3 mét mỗi 100ms (~3 m/s)
                if direction == "FORWARD":
                    vx = step
                    last_vx_update = now
                elif direction == "BACKWARD":
                    vx = -step
                    last_vx_update = now
                elif direction == "LEFT":
                    vy = -step
                    last_vy_update = now
                elif direction == "RIGHT":
                    vy = step
                    last_vy_update = now
        elif cmd == "CLIMB":
            if alt > 2.0:
                vz = 0.1  # Tốc độ bay lên: 1.0 m/s
                last_vz_update = time.ticks_ms()
        elif cmd == "DESCEND":
            if alt > 2.0:
                vz = -0.1  # Tốc độ hạ xuống: 1.0 m/s
                last_vz_update = time.ticks_ms()
        elif cmd == "YAW_LEFT":
            if alt > 2.0:
                v_yaw = -4.0  # Tốc độ xoay trái: 40°/giây
                last_vyaw_update = time.ticks_ms()
        elif cmd == "YAW_RIGHT":
            if alt > 2.0:
                v_yaw = 4.0   # Tốc độ xoay phải: 40°/giây
                last_vyaw_update = time.ticks_ms()
    except Exception as e: 
        print("Lỗi giải mã lệnh:", e)

# --- 5. CHƯƠNG TRÌNH CHÍNH ---
def main():
    # WiFi đã được tự động kết nối trên boot.py
    client = MQTTClient(CLIENT_ID, MQTT_SERVER, port=MQTT_PORT, keepalive=10)
    client.set_callback(on_message)
    
    # Thiết lập "Di chúc": Nếu mất kết nối đột ngột, Server sẽ nhận được tin nhắn OFFLINE
    lwt_data = json.dumps({"device_id": CLIENT_ID, "state": "OFFLINE"})
    client.set_last_will(TOPIC_TELEMETRY, lwt_data, retain=True)
    
    try:
        client.connect()
        print(f"✅ ĐÃ KẾT NỐI! Đang lắng nghe lệnh tại: {TOPIC_COMMAND.decode()}")
        client.subscribe(TOPIC_COMMAND)
        
        # Đăng ký poller để đọc cạn kiệt socket buffer (tránh trễ tích lũy)
        import uselect
        poller = uselect.poll()
        poller.register(client.sock, uselect.POLLIN)
    except Exception as e:
        print("❌ Lỗi MQTT:", e)
        time.sleep(5)
        machine.reset()

    # Khởi tạo mốc thời gian ban đầu cho các watchdog
    t_now = time.ticks_ms()
    global last_vx_update, last_vy_update, last_vz_update, last_vyaw_update
    last_vx_update = t_now
    last_vy_update = t_now
    last_vz_update = t_now
    last_vyaw_update = t_now

    last_send = time.ticks_ms()
    while True:
        try:
            # Đọc sạch toàn bộ các gói tin MQTT đang chờ trong socket buffer
            while poller.poll(0):
                client.check_msg()
            
            # --- LOGIC GIẢ LẬP VẬT LÝ ---
            global alt, lat, lng, state, yaw, vx, vy, vz, v_yaw
            
            # Watchdog kiểm tra nút bấm: Nếu trong vòng 150ms không có lệnh mới gửi tới, hãm phanh về 0
            now = time.ticks_ms()
            if time.ticks_diff(now, last_vx_update) > 150:
                vx = 0.0
            if time.ticks_diff(now, last_vy_update) > 150:
                vy = 0.0
            if time.ticks_diff(now, last_vz_update) > 150:
                vz = 0.0
            if time.ticks_diff(now, last_vyaw_update) > 150:
                v_yaw = 0.0

            # 1. Xử lý Độ cao (Giả lập thực tế - Giới hạn tuyệt đối để tránh sai lệch số thực)
            if state == "TAKEOFF":
                alt += 0.2  # Tốc độ cất cánh: 2.0 m/s
                if alt >= 10.0:
                    alt = 10.0
                    state = "HOVER"  # Tự động sang HOVER khi đạt độ cao 10m
            elif state == "LANDING":
                if alt > 0:
                    if alt < 1.5:
                        alt -= 0.05  # Tốc độ tiếp đất (sát mặt đất < 1.5m): 0.5 m/s
                    else:
                        alt -= 0.15  # Tốc độ hạ cánh bình thường: 1.5 m/s
                    
                    if alt <= 0: 
                        alt = 0.0
                        state = "IDLE"
            
            # Cộng dồn thay đổi độ cao thủ công (CLIMB/DESCEND)
            if state in ("HOVER", "MOVING") and vz != 0.0:
                alt = max(1.0, min(alt + vz, 100.0))

            # 2. Xử lý Di chuyển tự động (GOTO)
            if state == "MOVING" and alt > 2:
                step = 0.0001
                if abs(lat - target_lat) > step:
                    lat += step if target_lat > lat else -step
                if abs(lng - target_lng) > step:
                    lng += step if target_lng > lng else -step
                
                if abs(lat - target_lat) < step and abs(lng - target_lng) < step:
                    print("🎯 Đã tới đích!")
                    state = "HOVER"

            # Cộng dồn di chuyển thủ công dựa trên vận tốc vx, vy
            if alt > 2.0:
                if vx != 0.0 or vy != 0.0:
                    lat += vx
                    lng += vy
                # Cộng dồn góc quay đầu (Yaw)
                if v_yaw != 0.0:
                    yaw = (yaw + v_yaw) % 360

            # 3. Gửi dữ liệu Telemetry (Gửi sau mỗi 200ms để hiển thị mượt mà trên web)
            now = time.ticks_ms()
            if time.ticks_diff(now, last_send) >= 200:
                telemetry = {
                    "device_id": CLIENT_ID,
                    "state": state,
                    "latitude": lat, 
                    "longitude": lng, 
                    "altitude": round(alt, 2),
                    "yaw": yaw,
                    "battery": battery, 
                }
                client.publish(TOPIC_TELEMETRY, json.dumps(telemetry))
                print(f"📡 [{state}] Lat: {lat:.5f}, Lng: {lng:.5f}, Alt: {alt:.1f}m | Yaw={yaw}°")
                last_send = now
                
            time.sleep(0.1)
        except Exception as e:
            print("Lỗi vòng lặp:", e)
            time.sleep(2)

if __name__ == "__main__":
    main()
