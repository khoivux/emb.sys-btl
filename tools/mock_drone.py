import paho.mqtt.client as mqtt
import time
import json
import math
import random
import urllib.request
import argparse
import os

# --- CONFIGURATION ---
MQTT_BROKER = os.getenv("MQTT_HOST", "localhost")
MQTT_PORT = 1883
CLIENT_ID_PREFIX = "mock_drone_ptit"
TOPIC_TELEMETRY = "drone/telemetry"

# --- AUTO-GEOLOCATION ---
def get_current_location():
    # Return PTIT Hanoi immediately to avoid HTTP/DNS timeouts and 429 errors
    return 20.980812, 105.795931

# --- INITIAL DRONE STATE ---
state = "IDLE"  # IDLE, TAKEOFF, FLYING, LANDING, RTH
lat, lng = get_current_location() # Start at your actual location!
# Add a small random offset (~10-20 meters) so they don't overlap completely on the map
lat += random.uniform(-0.00015, 0.00015)
lng += random.uniform(-0.00015, 0.00015)
alt = 0.0
battery = 100.0
heading = 0.0 # 0 degrees North, positive clockwise
target_lat = lat
target_lng = lng
home_lat = lat
home_lng = lng
target_alt = 0.0 # Start on ground

# --- SIMULATION CONSTANTS ---
FLY_SPEED = 0.000015  # ~15m/s at 10Hz — balanced between responsiveness and smoothness
CLIMB_RATE = 0.1    # Faster climb
YAW_RATE = 15.0 # Degrees per command
MAX_ALTITUDE = 1.5 # Safety Hover Altitude

# We'll set this dynamically in run_simulator
unique_id = ""

def on_connect(client, userdata, flags, rc):
    print(f"[SIMULATOR] Connected to MQTT Broker ({rc})")
    topic_command = f"drone/{unique_id}/command"
    print(f"[SIMULATOR] Subscribing to: {topic_command}")
    client.subscribe(topic_command)

def on_message(client, userdata, msg):
    global state, target_lat, target_lng, target_alt, heading
    try:
        data = json.loads(msg.payload.decode())
        # Parse standard backend payload scheme: {"type": "COMMAND_NAME", "params": {...}}
        command = data.get("type") or data.get("command")
        params = data.get("params", {})
        print(f"\n[SIMULATOR] ⏱️ Nhận lệnh {command} lúc {time.strftime('%H:%M:%S')} (epoch: {time.time():.3f}) params: {params}")

        if command == "TAKEOFF":
            state = "TAKEOFF"
            target_alt = 1.5 # Safety takeoff altitude (1.5m)
            print("[SIMULATOR] Performing Safety Takeoff...")
        elif command == "LAND":
            state = "LANDING"
        elif command == "RTH":
            state = "RTH"
            target_lat, target_lng = home_lat, home_lng
        elif command == "GOTO":
            target_lat = params.get("lat", params.get("latitude", lat))
            target_lng = params.get("lng", params.get("longitude", lng))
            dist_to_target = math.sqrt((target_lat - lat)**2 + (target_lng - lng)**2)
            dist_meters = dist_to_target / 0.000009  # ước tính mét
            state = "FLYING"
            print(f"[SIMULATOR] ✈️  GOTO target: ({target_lat:.6f}, {target_lng:.6f}) | Khoảng cách: {dist_meters:.1f}m | ETA: ~{dist_meters/15:.1f}s")
        elif command == "MOVE":
            direction = params.get("direction")
            STEP = 0.0001
            # Real-world physics: Move relative to current heading
            angle_rad = math.radians(heading)
            
            if direction == "FORWARD":
                target_lat += STEP * math.cos(angle_rad)
                target_lng += STEP * math.sin(angle_rad)
            elif direction == "BACKWARD":
                target_lat -= STEP * math.cos(angle_rad)
                target_lng -= STEP * math.sin(angle_rad)
            elif direction == "LEFT":
                target_lat += STEP * math.sin(angle_rad)
                target_lng -= STEP * math.cos(angle_rad)
            elif direction == "RIGHT":
                target_lat -= STEP * math.sin(angle_rad)
                target_lng += STEP * math.cos(angle_rad)
            state = "FLYING"
        elif command == "YAW_LEFT":
            heading = (heading - YAW_RATE) % 360
        elif command == "YAW_RIGHT":
            heading = (heading + YAW_RATE) % 360
        elif command == "CLIMB":
            target_alt = min(100.0, target_alt + 5.0)
            state = "FLYING"
        elif command == "DESCEND":
            target_alt = max(5.0, target_alt - 5.0)
            state = "FLYING"
    except Exception as e:
        print(f"Error parsing command: {e}")

def update_physics():
    global lat, lng, alt, state, battery, target_alt

    # --- Altitude Control (Auto-hovering) ---
    if state != "IDLE" and state != "LANDING":
        if alt < target_alt - 0.2: 
            alt += CLIMB_RATE
        elif alt > target_alt + 0.2:
            alt -= CLIMB_RATE
        
    # --- Movement Control ---
    if state == "FLYING" or state == "RTH":
        dist_lat = target_lat - lat
        dist_lng = target_lng - lng
        dist = math.sqrt(dist_lat**2 + dist_lng**2)
        
        if dist > 0.000005:  # ~0.55m arrival threshold
            # Proportional velocity easing: fly faster when far, slow down when close
            raw_speed = min(0.00005, max(FLY_SPEED, dist * 0.2))
            # Anti-overshoot: không bao giờ bay xa hơn khoảng cách còn lại
            current_speed = min(dist, raw_speed)
            lat += (dist_lat / dist) * current_speed
            lng += (dist_lng / dist) * current_speed
        else:
            if state == "RTH": state = "LANDING"
            else: state = "FLYING" # Keep in flying mode but hover

    elif state == "LANDING":
        if alt > 0: alt -= CLIMB_RATE
        else: 
            alt = 0
            state = "IDLE"

    if state != "IDLE":
        battery -= 0.002 # Slightly slower battery discharge for testing

def run_simulator(drone_id=None):
    global unique_id, target_alt
    target_alt = MAX_ALTITUDE
    
    if drone_id:
        unique_id = drone_id
    else:
        unique_id = f"{CLIENT_ID_PREFIX}_{random.randint(1000, 9999)}"
        
    print(f"[SIMULATOR] Starting with unique ID: {unique_id}")

    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION1, unique_id)
    client.on_connect = on_connect
    client.on_message = on_message

    try:
        client.connect(MQTT_BROKER, MQTT_PORT, 60)
    except Exception as e:
        print(f"Connection failed: {e}. Is Mosquitto running?")
        return

    client.loop_start()
    print(f"[SIMULATOR] Drone is {state} at location {lat:.6f}, {lng:.6f}. Waiting for Takeoff/GOTO...")

    while True:
        update_physics()
        
        # Publish Telemetry using format matching backend requirements:
        # either device_id or id, latitude/lat, longitude/lng, altitude/alt, state, battery
        telemetry = {
            "device_id": unique_id,
            "state": state,
            "latitude": round(lat, 6),
            "longitude": round(lng, 6),
            "altitude": round(alt, 1),
            "battery": max(0, round(battery, 1)),
            "yaw": round(heading, 1),
            "timestamp": time.time()
        }
        
        client.publish(TOPIC_TELEMETRY, json.dumps(telemetry))
        
        # Visual feedback (only print log once per second)
        if int(time.time() * 10) % 10 == 0:
            print(f"STATUS: {state} | POS: {lat:.6f}, {lng:.6f} | ALT: {alt:.1f}m | BAT: {battery:.1f}%", end="\r")
        
        time.sleep(0.1) # 10Hz for super smooth tracking

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Mock Drone Simulator")
    parser.add_argument("--id", type=str, help="Specify unique ID for the drone")
    args = parser.parse_args()
    
    run_simulator(args.id)
