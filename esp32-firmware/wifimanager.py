import network
import time
import machine
import usocket as socket
import ujson as json
import _thread
from machine import Pin

CONFIG_FILE = "config.json"
BOOT_PIN = Pin(0, Pin.IN)  # Nút BOOT mặc định trên ESP32 (GPIO 0)

# --- 1. ĐỌC & GHI FILE CẤU HÌNH ---
def read_config():
    try:
        with open(CONFIG_FILE, "r") as f:
            return json.loads(f.read())
    except Exception:
        return None

def write_config(ssid, password, mqtt_server, mqtt_port):
    config = {
        "wifi_ssid": ssid,
        "wifi_pass": password,
        "mqtt_server": mqtt_server,
        "mqtt_port": int(mqtt_port)
    }
    with open(CONFIG_FILE, "w") as f:
        f.write(json.dumps(config))
    print("💾 Saved new config to Flash!")

# --- 2. GIAO DIỆN WEB CẤU HÌNH (HTML/CSS) ---
def get_html_page():
    return """HTTP/1.1 200 OK\r\nContent-Type: text/html\r\n\r\n
    <!DOCTYPE html>
    <html>
    <head>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta charset="utf-8">
        <title>Drone WiFi Portal</title>
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background-color: #0b0f19; color: #f8fafc; text-align: center; padding: 20px; margin: 0; }
            .card { background: #111827; padding: 30px; border-radius: 24px; border: 1px solid #1f2937; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.3); max-width: 360px; margin: 50px auto; }
            h2 { color: #3b82f6; margin-top: 0; font-size: 24px; font-weight: 800; }
            p { color: #9ca3af; font-size: 14px; margin-bottom: 25px; }
            input { width: 100%; padding: 12px; margin: 8px 0; box-sizing: border-box; border: 1px solid #374151; border-radius: 12px; background: #0b0f19; color: #fff; font-size: 14px; }
            input:focus { border-color: #3b82f6; outline: none; }
            button { width: 100%; padding: 12px; background: #3b82f6; border: none; border-radius: 12px; color: white; font-weight: bold; cursor: pointer; font-size: 16px; margin-top: 20px; transition: background 0.2s; }
            button:hover { background: #2563eb; }
        </style>
    </head>
    <body>
        <div class="card">
            <h2>Drone WiFi Portal</h2>
            <p>Cấu hình WiFi & Server MQTT cho ESP32</p>
            <form action="/save" method="get">
                <input type="text" name="ssid" placeholder="Tên WiFi (SSID)" required><br>
                <input type="password" name="password" placeholder="Mật khẩu WiFi"><br>
                <input type="text" name="server" placeholder="Máy chủ MQTT (Ngrok)" required><br>
                <input type="number" name="port" placeholder="Cổng MQTT (Port)" value="1883" required><br>
                <button type="submit">LƯU CẤU HÌNH</button>
            </form>
        </div>
    </body>
    </html>
    """

# --- 3. MÁY CHỦ DNS ĐỂ CHUYỂN HƯỚNG PORTAL TỰ ĐỘNG ---
def dns_server_thread():
    udps = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    udps.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    udps.bind(('0.0.0.0', 53))
    print("📡 DNS Server active on port 53...")
    while True:
        try:
            data, addr = udps.recvfrom(1024)
            # Phản hồi tất cả câu hỏi DNS trỏ về IP của ESP32 192.168.4.1 (\xc0\xa8\x04\x01)
            reply = data[:2] + b"\x81\x80\x00\x01\x00\x01\x00\x00\x00\x00"
            idx = 12
            while data[idx] != 0:
                idx += data[idx] + 1
            idx += 5
            reply += data[12:idx]
            reply += b"\xc0\x0c\x00\x01\x00\x01\x00\x00\x00\x3c\x00\x04\xc0\xa8\x04\x01"
            udps.sendto(reply, addr)
        except Exception:
            time.sleep(0.1)

# --- 4. DỰNG TRẠM PHÁT WIFI AP & WEB SERVER ---
def start_config_portal():
    print("📡 Activating AP Mode ('Drone_Setup_AP')...")
    ap = network.WLAN(network.AP_IF)
    ap.active(True)
    
    # Thiết lập IP tĩnh cho AP của ESP32 để đảm bảo luôn là 192.168.4.1
    ap.ifconfig(('192.168.4.1', '255.255.255.0', '192.168.4.1', '8.8.8.8'))
    ap.config(essid="Drone_Setup_AP", authmode=network.AUTH_OPEN)
    
    print("🌐 WiFi AP is live at: 'Drone_Setup_AP'")
    print("🌐 AP IP configurations:", ap.ifconfig())
    print("🌐 Open browser and go to: http://192.168.4.1")
    
    # Khởi động máy chủ DNS ngầm để kích hoạt cơ chế Captive Portal tự động mở trình duyệt
    try:
        _thread.start_new_thread(dns_server_thread, ())
    except Exception as e:
        print("⚠️ Failed to start DNS thread:", e)
        
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    s.bind(('', 80))
    s.listen(1)
    
    while True:
        try:
            conn, addr = s.accept()
            # Đặt timeout tránh treo socket
            conn.settimeout(2.0)
            raw_request = conn.recv(1024)
            
            if not raw_request:
                conn.close()
                continue
                
            request = raw_request.decode()
            
            # GIAO DIỆN CAPTIVE PORTAL REDIRECT:
            # Nếu request không phải gửi trực tiếp tới 192.168.4.1 và không chứa lệnh lưu (/save)
            # thì chuyển hướng (302 Redirect) về http://192.168.4.1/ để điện thoại tự động mở cổng chào!
            if "192.168.4.1" not in request and "GET /save" not in request:
                print("🔀 Captive Portal: Redirecting query to http://192.168.4.1/")
                response = "HTTP/1.1 302 Found\r\nLocation: http://192.168.4.1/\r\nConnection: close\r\n\r\n"
                conn.send(response.encode())
                conn.close()
                continue
            
            if "GET /save" in request:
                try:
                    params = request.split(" ")[1].split("?")[1]
                    param_dict = {}
                    for param in params.split("&"):
                        k, v = param.split("=")
                        # Decode URL encoding basics
                        v = v.replace("%20", " ").replace("%2F", "/").replace("%3A", ":").replace("+", " ")
                        param_dict[k] = v
                    
                    write_config(
                        param_dict.get("ssid"), 
                        param_dict.get("password", ""), 
                        param_dict.get("server"), 
                        param_dict.get("port")
                    )
                    
                    response = """HTTP/1.1 200 OK\r\nContent-Type: text/html\r\n\r\n
                    <html><head><meta charset="utf-8"></head><body style="background:#0b0f19;color:#fff;font-family:sans-serif;text-align:center;padding:50px;">
                    <h2>Lưu cấu hình thành công!</h2><p>ESP32 đang khởi động lại để kết nối WiFi...</p></body></html>"""
                    conn.send(response)
                    conn.close()
                    
                    time.sleep(2)
                    machine.reset()
                except Exception as e:
                    print("Error parsing GET parameters:", e)
            else:
                conn.send(get_html_page())
                conn.close()
        except Exception as e:
            print("Web Server loop error:", e)

# --- 5. BẮT ĐẦU LIÊN KẾT KẾT NỐI ---
def setup_connection():
    import os
    
    # Cho phép người dùng có 2 giây để nhấn giữ nút BOOT sau khi chip đã khởi động xong
    print("\n🚀 ESP32 đã khởi động!")
    print("⏳ Nhấn giữ nút BOOT ngay bây giờ (trong 2s tiếp theo) để reset cấu hình...")
    
    # Quét liên tục trong 2 giây xem nút BOOT có được nhấn hay không
    boot_detected = False
    start_time = time.time()
    while (time.time() - start_time) < 2.0:
        if BOOT_PIN.value() == 0:
            boot_detected = True
            break
        time.sleep(0.05)
    
    boot_pressed = False
    if boot_detected:
        print("⏳ Đã nhận tín hiệu BOOT! Hãy tiếp tục giữ nút BOOT trong 3 giây để xóa cấu hình...")
        count = 0
        while BOOT_PIN.value() == 0 and count < 30: # 30 * 100ms = 3 giây
            time.sleep(0.1)
            count += 1
            if count % 10 == 0:
                print("⏱️ Đã giữ {} giây...".format(count // 10))
        
        if count >= 30:
            boot_pressed = True
            print("🚨 Đã giữ đủ 3 giây! Tiến hành xóa file cấu hình...")
            try:
                os.remove(CONFIG_FILE)
                print("🗑️ Đã xóa thành công file config.json khỏi bộ nhớ Flash!")
            except Exception as e:
                print("⚠️ Lỗi khi xóa cấu hình hoặc file không tồn tại:", e)
        else:
            print("❌ Chưa giữ đủ 3 giây. Bỏ qua reset cấu hình.")
            
    config = read_config()
    
    if boot_pressed or config is None:
        if config is None:
            print("🚨 Không tìm thấy cấu hình WiFi trong Flash!")
        start_config_portal()
        
    print("📶 Attempting to connect to WiFi:", config["wifi_ssid"])
    wlan = network.WLAN(network.STA_IF)
    wlan.active(True)
    wlan.connect(config["wifi_ssid"], config["wifi_pass"])
    
    timeout = 15
    start = time.time()
    while not wlan.isconnected() and (time.time() - start) < timeout:
        time.sleep(1)
        print(".", end="")
        
    if wlan.isconnected():
        print("\n✅ WiFi connected! IP:", wlan.ifconfig()[0])
        return config
    else:
        print("\n❌ Failed to connect to saved WiFi!")
        # Fallback to AP config mode
        start_config_portal()
