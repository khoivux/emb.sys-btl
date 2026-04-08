import json
import paho.mqtt.client as mqtt
import threading
from django import db
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from drones.models import Drone, TelemetryLog

# Configuration (Use internal hostname or localhost)
MQTT_BROKER = "localhost" 
MQTT_PORT = 1883
MQTT_TOPIC = "drone/telemetry"

def on_connect(client, userdata, flags, rc):
    print(f"[MQTT BRIDGE] Connected to MQTT Broker ({rc})")
    client.subscribe(MQTT_TOPIC)

def on_message(client, userdata, msg):
    try:
        from django import db
        db.close_old_connections()
        data = json.loads(msg.payload.decode())
        device_id = data.get("id")
        print(f"📡 [BACKEND] Nhận tọa độ từ {device_id}: Lat={data.get('lat')}, Lng={data.get('lng')}")
        
        # 1. Update/Create Drone in DB
        # Since this runs inside Django thread, we can use ORM directly.
        drone, _ = Drone.objects.get_or_create(
            device_id=device_id,
            defaults={'name': f"Drone {device_id}"}
        )
        drone.is_active = True
        drone.save()

        # 2. Log Telemetry
        log = TelemetryLog.objects.create(
            drone=drone,
            latitude=data.get("lat"),
            longitude=data.get("lng"),
            altitude=data.get("alt"),
            battery=data.get("battery"),
            state=data.get("state")
        )

        # 3. WS Broadcast (This now shared the SAME CHANNEL LAYER)
        channel_layer = get_channel_layer()
        if channel_layer:
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
                        "yaw": data.get("yaw", 0), # Bổ sung góc quay ở đây
                        "state": log.state,
                        "timestamp": log.timestamp.isoformat()
                    }
                }
            )
    except Exception as e:
        print(f"[MQTT BRIDGE ERROR] {e}")

def start_mqtt_bridge():
    # paho-mqtt version 1.6 compatible client
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION1)
    client.on_connect = on_connect
    client.on_message = on_message

    def run():
        try:
            print(f"[MQTT BRIDGE] Connecting to {MQTT_BROKER}:{MQTT_PORT}...")
            client.connect(MQTT_BROKER, MQTT_PORT, 60)
            client.loop_forever()
        except Exception as e:
            print(f"[MQTT BRIDGE CRITICAL] {e}")

    # Run in background daemon thread
    thread = threading.Thread(target=run, daemon=True)
    thread.start()
    return thread
