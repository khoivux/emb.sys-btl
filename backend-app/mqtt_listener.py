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
        drone, created = Drone.objects.get_or_create(
            device_id=device_id,
            defaults={'name': f"Drone {device_id[:6]}"}
        )
        drone.is_active = True
        drone.save()

        # 2. Save Telemetry Log to Database
        log = TelemetryLog.objects.create(
            drone=drone,
            latitude=data.get("latitude") or data.get("lat") or 0,
            longitude=data.get("longitude") or data.get("lng") or 0,
            altitude=data.get("altitude") or data.get("alt") or 0,
            battery=data.get("battery") or 0,
            state=data.get("state") or "UNKNOWN"
        )

        # 3. Broadcast to WebSockets (Django Channels)
        channel_layer = get_channel_layer()
        if channel_layer:
            # Gửi Telemetry
            async_to_sync(channel_layer.group_send)(
                "drone_updates",
                {
                    "type": "drone_telemetry",
                    "message": {
                        "id": device_id,
                        "lat": log.latitude,
                        "lng": log.longitude,
                        "alt": log.altitude,
                        "battery": log.battery,
                        "state": log.state,
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
