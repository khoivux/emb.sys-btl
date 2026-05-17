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

# --- 3. KẾT NỐI WIFI ---
# WiFi đã được kết nối tự động trong file boot.py

# --- 4. XỬ LÝ LỆNH TỪ WEB ---
def on_message(topic, msg):
    global state, target_lat, target_lng
    try:
        data = json.loads(msg)
        # Sửa: Backend gửi key "type" thay vì "command"
        cmd = data.get("type") 
        params = data.get("params", {}) # Lấy các tham số đi kèm (như tọa độ GOTO)
        
        print("Lệnh mới nhận được:", cmd)
        
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
        if client.connect():
            print(f"✅ ĐÃ KẾT NỐI! Đang lắng nghe lệnh tại: {TOPIC_COMMAND.decode()}")
            client.subscribe(TOPIC_COMMAND)
    except Exception as e:
        print("❌ Lỗi MQTT:", e)
        time.sleep(5)
        machine.reset()

    last_send = 0
    while True:
        try:
            client.check_msg()
            
            # --- LOGIC GIẢ LẬP VẬT LÝ ---
            global alt, lat, lng, state
            
            # 1. Xử lý Độ cao
            if state == "TAKEOFF" and alt < 10: 
                alt += 0.2
            elif state == "LANDING" and alt > 0: 
                alt -= 0.2
                if alt <= 0: state = "IDLE"

            # 2. Xử lý Di chuyển
            if state == "MOVING" and alt > 2:
                step = 0.0001
                if abs(lat - target_lat) > step:
                    lat += step if target_lat > lat else -step
                if abs(lng - target_lng) > step:
                    lng += step if target_lng > lng else -step
                
                if abs(lat - target_lat) < step and abs(lng - target_lng) < step:
                    print("🎯 Đã tới đích!")
                    state = "HOVER"

            # 3. Gửi dữ liệu Telemetry (Sửa lại tên các field cho khớp với Backend)
            if (time.time() - last_send) > 2:
                telemetry = {
                    "device_id": CLIENT_ID,
                    "state": state,
                    "latitude": lat, 
                    "longitude": lng, 
                    "altitude": round(alt, 2),
                    "battery": battery, 
                }
                client.publish(TOPIC_TELEMETRY, json.dumps(telemetry))
                print(f"📡 [{state}] Lat: {lat:.5f}, Lng: {lng:.5f}, Alt: {alt:.1f}m")
                last_send = time.time()
                
            time.sleep(0.1)
        except Exception as e:
            print("Lỗi vòng lặp:", e)
            time.sleep(2)

if __name__ == "__main__":
    main()
