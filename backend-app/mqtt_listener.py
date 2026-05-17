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

def on_message(client, userdata, msg):
    try:
        data = json.loads(msg.payload.decode())
        device_id = data.get("device_id") or data.get("id")
        if not device_id:
            return

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

        # Chỉ ghi DB nếu trạng thái có sự thay đổi thực sự
        if drone.is_active != is_active or drone.state != state:
            drone.is_active = is_active
            drone.state = state
            drone.save()
            print(f"📡 [STATE CHANGE] {device_id} is now {'ONLINE' if is_active else 'OFFLINE'} (State: {state})")

        # Throttle DB Writes (Chỉ ghi DB 1 giây/lần mỗi drone để tránh SQLite lock)
        import time
        current_time = time.time()
        last_log_time = getattr(drone, '_last_db_write', 0)
        
        if current_time - last_log_time >= 1.0:
            # Lấy pin cũ từ TelemetryLog nếu bản tin không có pin
            current_battery = data.get("battery")
            if current_battery is None:
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
            drone._last_db_write = current_time
        else:
            # Fake log object for WebSocket broadcast
            class FakeLog:
                pass
            log = FakeLog()
            log.latitude = data.get("latitude") or data.get("lat") or 0
            log.longitude = data.get("longitude") or data.get("lng") or 0
            log.altitude = data.get("altitude") or data.get("alt") or 0
            log.battery = data.get("battery") or 0
            log.state = state
            from django.utils import timezone
            log.timestamp = timezone.now()

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
