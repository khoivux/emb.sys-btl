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

def on_message(client, userdata, msg):
    print(f"🔔 [MQTT DEBUG] Nhận gói tin trên Topic: {msg.topic}")
    try:
        data = json.loads(msg.payload.decode())
        # Hỗ trợ cả tên trường cũ và mới
        device_id = data.get("device_id") or data.get("id")
        if not device_id:
            print("[MQTT] Nhận dữ liệu không có ID")
            return

        print(f"Received telemetry from {device_id}")

        # 1. Update or Create Drone Status
        state = data.get("state") or "UNKNOWN"
        is_active = (state != "OFFLINE")
        
        channel_layer = get_channel_layer()
        try:
            drone = Drone.objects.get(device_id=device_id)
            if drone.owner is None and not is_active:
                # Nếu thiết bị chưa ghép đôi mà ngắt kết nối (offline) -> Xóa hẳn khỏi DB
                drone_id = drone.id
                drone.delete()
                print(f"🗑️ [DISCOVERY] Removed inactive unclaimed drone: {device_id}")
                
                # Phát thông báo qua WebSockets để Frontend biết mà xóa khỏi giao diện quét
                if channel_layer:
                    async_to_sync(channel_layer.group_send)(
                        "drone_updates",
                        {
                            "type": "drone_lost",
                            "message": {
                                "id": drone_id,
                                "device_id": device_id
                            }
                        }
                    )
                return
            
            drone.is_active = is_active
            drone.state = state
            drone.save()
        except Drone.DoesNotExist:
            if not is_active:
                print(f"⚠️ [DISCOVERY] Ignoring OFFLINE message for non-existent drone: {device_id}")
                return
            
            drone = Drone.objects.create(
                device_id=device_id,
                name=f"Drone {device_id[:6]}",
                is_active=is_active,
                state=state
            )

        print(f"📡 [STATE CHANGE] {device_id} is now {'ONLINE' if is_active else 'OFFLINE'} (State: {state})")

        # 2. Save Telemetry Log to Database
        # Lấy pin cũ từ TelemetryLog nếu bản tin không có pin (để tránh về 0% khi Offline)
        current_battery = data.get("battery")
        if current_battery is None:
            # Tìm bản ghi gần nhất có pin > 0 để tránh lấy lại số 0 của các lần offline trước
            last_log = TelemetryLog.objects.filter(drone=drone, battery__gt=0).order_by('-timestamp').first()
            current_battery = last_log.battery if last_log else 0
            
        log = TelemetryLog.objects.create(
            drone=drone,
            latitude=data.get("latitude") or data.get("lat") or 0,
            longitude=data.get("longitude") or data.get("lng") or 0,
            altitude=data.get("altitude") or data.get("alt") or 0,
            battery=current_battery,
            state=state
        )

        # 3. Broadcast to WebSockets (Django Channels)
        channel_layer = get_channel_layer()
        if channel_layer:
            # Gửi Telemetry & Trạng thái Online/Offline
            async_to_sync(channel_layer.group_send)(
                "drone_updates",
                {
                    "type": "drone_telemetry",
                    "message": {
                        "id": drone.id,
                        "device_id": drone.device_id,
                        "name": drone.name,
                        "lat": log.latitude,
                        "lng": log.longitude,
                        "alt": log.altitude,
                        "battery": log.battery,
                        "state": log.state,
                        "is_active": drone.is_active,
                        "timestamp": log.timestamp.isoformat()
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
