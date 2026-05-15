import paho.mqtt.client as mqtt
import time
import json
import math
import random
import urllib.request

# --- CONFIGURATION ---
MQTT_BROKER = "localhost"
MQTT_PORT = 1883
CLIENT_ID = "mock_drone_ptit"
TOPIC_TELEMETRY = "drone/telemetry"
TOPIC_COMMAND = "drone/command"

# --- AUTO-GEOLOCATION ---
def get_current_location():
    try:
        # Reduced timeout and added a header to avoid some 429 issues
        req = urllib.request.Request("https://ipapi.co/json/", headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=3) as response:
            data = json.loads(response.read().decode())
            print(f"[SIMULATOR] detected location: {data.get('city')}, {data.get('country')}")
            return float(data.get('latitude')), float(data.get('longitude'))
    except Exception as e:
        print(f"[SIMULATOR] Could not detect location ({e}). Defaulting to PTIT Hanoi.")
        return 20.980812, 105.795931

# --- INITIAL DRONE STATE ---
state = "IDLE"  # IDLE, TAKEOFF, FLYING, LANDING, RTH
lat, lng = get_current_location() # Start at your actual location!
alt = 0.0
battery = 100.0
heading = 0.0 # 0 degrees North, positive clockwise
target_lat = lat
target_lng = lng
home_lat = lat
home_lng = lng
target_alt = 0.0 # Start on ground

# --- SIMULATION CONSTANTS ---
FLY_SPEED = 0.000005 # Adjusted for 10Hz loop
CLIMB_RATE = 0.04    # Adjusted for 10Hz loop
YAW_RATE = 15.0 # Degrees per command (Tăng cho nhạy hơn)
MAX_ALTITUDE = 1.5 # Safety Hover Altitude

def on_connect(client, userdata, flags, rc):
    print(f"[SIMULATOR] Connected to MQTT Broker ({rc})")
    client.subscribe(TOPIC_COMMAND)

def on_message(client, userdata, msg):
    global state, target_lat, target_lng, target_alt, heading
    try:
        data = json.loads(msg.payload.decode())
        command = data.get("command")
        print(f"[SIMULATOR] Received Command: {command}")

        if command == "TAKEOFF" and state == "IDLE":
            state = "TAKEOFF"
            target_alt = 1.5 # Safety takeoff altitude (1.5m)
            print("[SIMULATOR] Performing Safety Takeoff...")
        elif command == "LAND":
            state = "LANDING"
        elif command == "RTH":
            state = "RTH"
            target_lat, target_lng = home_lat, home_lng
        elif command == "GOTO":
            target_lat = data.get("lat", lat)
            target_lng = data.get("lng", lng)
            state = "FLYING"
        elif command == "MOVE":
            direction = data.get("direction")
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
        
        if dist > 0.00001:
            lat += (dist_lat / dist) * FLY_SPEED
            lng += (dist_lng / dist) * FLY_SPEED
        else:
            if state == "RTH": state = "LANDING"

    elif state == "LANDING":
        if alt > 0: alt -= CLIMB_RATE
        else: 
            alt = 0
            state = "IDLE"

    if state != "IDLE":
        battery -= 0.02

def run_simulator():
    global target_alt # Declare global to allow access
    target_alt = MAX_ALTITUDE
    
    # Generate a unique ID to avoid "session taken over" if multiple simulators run
    unique_id = f"{CLIENT_ID}_{random.randint(1000, 9999)}"
    print(f"[SIMULATOR] Starting with unique ID: {unique_id}")

    # Support paho-mqtt version 2.0+
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION1, unique_id)
    client.on_connect = on_connect
    client.on_message = on_message

    try:
        client.connect(MQTT_BROKER, MQTT_PORT, 60)
    except Exception as e:
        print(f"Connection failed: {e}. Is Mosquitto running?")
        return

    client.loop_start()
    print(f"[SIMULATOR] Drone is {state} at PTIT Hanoi. Waiting for Takeoff...")

    while True:
        update_physics()
        
        # Publish Telemetry
        telemetry = {
            "id": unique_id, # Use the unique ID here too!
            "state": state,
            "lat": round(lat, 6),
            "lng": round(lng, 6),
            "alt": round(alt, 1),
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
    run_simulator()
