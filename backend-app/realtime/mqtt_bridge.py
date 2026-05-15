import json
import paho.mqtt.client as mqtt
import threading
import os
from django import db
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from drones.models import Drone, TelemetryLog

# Configuration (Use internal hostname or localhost)
MQTT_BROKER = os.getenv("MQTT_HOST", "localhost")
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
        
        # Hỗ trợ cả tên trường cũ và mới để đảm bảo tính tương thích
        device_id = data.get("device_id") or data.get("id")
        if not device_id: return

        lat = data.get("latitude") or data.get("lat")
        lng = data.get("longitude") or data.get("lng")
        alt = data.get("altitude") or data.get("alt")
        battery = data.get("battery")
        state = data.get("state")

        print(f"📡 [DISCOVERY] Nhận dữ liệu từ {device_id}: Lat={lat}, Lng={lng}")
        
        # 1. Update/Create Drone in DB
        drone, created = Drone.objects.get_or_create(
            device_id=device_id,
            defaults={'name': f"New Drone ({device_id[:6]})"}
        )
        
        drone.is_active = True
        drone.save()

        # 2. Log Telemetry
        log = TelemetryLog.objects.create(
            drone=drone,
            latitude=lat or 0,
            longitude=lng or 0,
            altitude=alt or 0,
            battery=battery or 0,
            state=state or "UNKNOWN"
        )

        # 3. WS Broadcast (This now shared the SAME CHANNEL LAYER)
        channel_layer = get_channel_layer()
        if channel_layer:
            # Gửi dữ liệu Telemetry bình thường
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
                        "yaw": data.get("yaw", 0),
                        "state": log.state,
                        "timestamp": log.timestamp.isoformat()
                    }
                }
            )
            
            # Gửi thông báo Discovery nếu drone chưa có chủ
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
        print(f"[MQTT BRIDGE ERROR] {e}")

def start_mqtt_bridge():
    # paho-mqtt version 1.6 compatible client
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION1)
    client.on_connect = on_connect
    client.on_message = on_message

    def run():
        import time
        connected = False
        while not connected:
            try:
                print(f"[MQTT BRIDGE] Connecting to {MQTT_BROKER}:{MQTT_PORT}...")
                client.connect(MQTT_BROKER, MQTT_PORT, 60)
                connected = True
            except Exception as e:
                print(f"[MQTT BRIDGE] Connection failed: {e}. Retrying in 2s...")
                time.sleep(2)
        
        try:
            client.loop_forever()
        except Exception as e:
            print(f"[MQTT BRIDGE CRITICAL] {e}")

    # Run in background daemon thread
    thread = threading.Thread(target=run, daemon=True)
    thread.start()
    return thread
