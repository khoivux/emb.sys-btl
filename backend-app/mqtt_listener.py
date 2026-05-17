import os
import django
import json
import paho.mqtt.client as mqtt
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

# --- DJANGO SETUP ---
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from drones.models import Drone, TelemetryLog

# --- MQTT SETUP ---
MQTT_BROKER = os.getenv("MQTT_HOST", "localhost")
MQTT_PORT = 1883
MQTT_TOPIC = "drone/telemetry"

def on_connect(client, userdata, flags, rc):
    print(f"Connected to MQTT Broker with result code {rc}")
    client.subscribe(MQTT_TOPIC)

# Global cache để tránh query DB 120 lần/giây
drone_cache = {}

import queue
import threading

db_queue = queue.Queue()

def db_worker():
    """Background worker thread to perform all database write operations."""
    from django import db
    from drones.models import Drone, TelemetryLog
    print("[DB WORKER] Background database worker thread started.")
    while True:
        try:
            task = db_queue.get()
            if task is None:
                break
            
            db.close_old_connections()
            task_type = task.get("type")
            
            if task_type == "save_drone":
                device_id = task["device_id"]
                state = task["state"]
                is_active = task["is_active"]
                try:
                    drone = Drone.objects.get(device_id=device_id)
                    drone.is_active = is_active
                    drone.state = state
                    drone.save()
                except Exception as ex:
                    print(f"❌ [DB WORKER] Error saving drone {device_id}: {ex}")
                    
            elif task_type == "create_telemetry_log":
                device_id = task["device_id"]
                lat = task["lat"]
                lng = task["lng"]
                alt = task["alt"]
                battery = task["battery"]
                state = task["state"]
                try:
                    drone = Drone.objects.get(device_id=device_id)
                    TelemetryLog.objects.create(
                        drone=drone,
                        latitude=lat,
                        longitude=lng,
                        altitude=alt,
                        battery=battery,
                        state=state
                    )
                except Exception as ex:
                    print(f"❌ [DB WORKER] Error creating telemetry log for {device_id}: {ex}")
            
            db_queue.task_done()
        except Exception as e:
            print(f"❌ [DB WORKER] Critical error in database worker thread: {e}")

# Khởi chạy background worker thread
worker_thread = threading.Thread(target=db_worker, daemon=True)
worker_thread.start()

def on_message(client, userdata, msg):
    try:
        data = json.loads(msg.payload.decode())
        device_id = data.get("device_id") or data.get("id")
        if not device_id:
            return

        # Check telemetry lag/delay
        import time as _time
        drone_ts = data.get("timestamp")
        if drone_ts:
            delay = _time.time() - drone_ts
            if delay > 0.5:
                print(f"⚠️  [MQTT LAG] Telemetry delay for {device_id} is {delay:.2f}s! (Queue backing up)")

        # 1. Update or Create Drone Status (Sử dụng Cache RAM)
        state = data.get("state") or "UNKNOWN"
        is_active = (state != "OFFLINE")
        
        drone = drone_cache.get(device_id)
        if not drone:
            drone, created = Drone.objects.get_or_create(
                device_id=device_id,
                defaults={'name': f"Drone {device_id[:6]}"}
            )
            drone_cache[device_id] = drone

        state_changed = (drone.is_active != is_active or drone.state != state)

        # Cập nhật thông tin trong memory cache trước
        if state_changed:
            drone.is_active = is_active
            drone.state = state
            
            # Gửi task cập nhật Drone DB không đồng bộ
            db_queue.put({
                "type": "save_drone",
                "device_id": device_id,
                "state": state,
                "is_active": is_active
            })
            print(f"📡 [STATE CHANGE QUEUED] {device_id} -> {state}")

        # Throttle DB Writes (Chỉ ghi DB 1 giây/lần mỗi drone để tránh SQLite lock)
        current_time = _time.time()
        last_log_time = getattr(drone, '_last_db_write', 0)
        
        # Luôn lấy pin hiện tại hoặc pin từ cache
        current_battery = data.get("battery")
        if current_battery is None:
            current_battery = getattr(drone, '_last_battery', 100.0)
        else:
            drone._last_battery = current_battery

        lat = data.get("latitude") or data.get("lat") or 0
        lng = data.get("longitude") or data.get("lng") or 0
        alt = data.get("altitude") or data.get("alt") or 0

        should_log = (current_time - last_log_time >= 1.0 or state_changed)
        if should_log:
            # Gửi task tạo TelemetryLog không đồng bộ
            db_queue.put({
                "type": "create_telemetry_log",
                "device_id": device_id,
                "lat": lat,
                "lng": lng,
                "alt": alt,
                "battery": current_battery,
                "state": state
            })
            drone._last_db_write = current_time

            # 3. Broadcast to WebSockets (Django Channels) - Thực hiện tức thì, không bị block bởi DB!
            channel_layer = get_channel_layer()
            if channel_layer:
                import datetime
                timestamp_str = datetime.datetime.now().isoformat()
                
                # Gửi Telemetry & Trạng thái Online/Offline
                async_to_sync(channel_layer.group_send)(
                    "drone_updates",
                    {
                        "type": "drone_telemetry",
                        "message": {
                            "id": drone.id,
                            "device_id": drone.device_id,
                            "name": drone.name,
                            "lat": lat,
                            "lng": lng,
                            "alt": alt,
                            "battery": current_battery,
                            "state": state,
                            "is_active": drone.is_active,
                            "timestamp": timestamp_str
                        }
                    }
                )
                
                # Gửi Discovery nếu chưa có chủ
                if drone.owner is None:
                    async_to_sync(channel_layer.group_send)(
                        "drone_updates",
                        {
                            "type": "drone_discovered",
                            "message": {
                                "id": drone.id,
                                "device_id": drone.device_id,
                                "name": drone.name
                            }
                        }
                    )
    except Exception as e:
        print(f"Error processing MQTT message: {e}")

def run():
    # Support paho-mqtt version 2.0+
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION1)
    client.on_connect = on_connect
    client.on_message = on_message

    import time
    connected = False
    while not connected:
        try:
            print(f"[MQTT LISTENER] Connecting to {MQTT_BROKER}:{MQTT_PORT}...")
            client.connect(MQTT_BROKER, MQTT_PORT, 60)
            connected = True
        except Exception as e:
            print(f"MQTT Listener connection failed: {e}. Retrying in 2s...")
            time.sleep(2)

    try:
        client.loop_forever()
    except Exception as e:
        print(f"MQTT Listener loop failed: {e}")

if __name__ == "__main__":
    run()
