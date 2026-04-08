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
MQTT_BROKER = "localhost" # Current infrastructure docker broker mapping
MQTT_PORT = 1883
MQTT_TOPIC = "drone/telemetry"

def on_connect(client, userdata, flags, rc):
    print(f"Connected to MQTT Broker with result code {rc}")
    client.subscribe(MQTT_TOPIC)

def on_message(client, userdata, msg):
    try:
        data = json.loads(msg.payload.decode())
        device_id = data.get("id")
        print(f"Received telemetry from {device_id}")

        # 1. Update or Create Drone Status
        drone, created = Drone.objects.get_or_create(
            device_id=device_id,
            defaults={'name': f"Drone {device_id}"}
        )
        drone.is_active = True
        drone.save()

        # 2. Save Telemetry Log to Database
        log = TelemetryLog.objects.create(
            drone=drone,
            latitude=data.get("lat"),
            longitude=data.get("lng"),
            altitude=data.get("alt"),
            battery=data.get("battery"),
            state=data.get("state")
        )

        # 3. Broadcast to WebSockets (Django Channels)
        channel_layer = get_channel_layer()
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
    except Exception as e:
        print(f"Error processing MQTT message: {e}")

def run():
    # Support paho-mqtt version 2.0+
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION1)
    client.on_connect = on_connect
    client.on_message = on_message

    try:
        client.connect(MQTT_BROKER, MQTT_PORT, 60)
        client.loop_forever()
    except Exception as e:
        print(f"MQTT Listener failed: {e}")

if __name__ == "__main__":
    run()
