from umqttsimple import MQTTClient
import time
import ujson as json
import machine
import math

# --- CONFIGURATION ---
MQTT_SERVER = "192.168.1.100" # Change to your Broker IP
CLIENT_ID = "esp32_drone_01"
TOPIC_TELEMETRY = b"drone/telemetry"
TOPIC_COMMAND = b"drone/command"

# --- DRONE STATE ---
state = "IDLE" # IDLE, TAKEOFF, FLYING, LANDING, RTH, EMERGENCY
lat = 20.980812  # PTIT Hanoi
lng = 105.795931
alt = 0.0
speed = 0.0
battery = 100.0
target_lat = lat
target_lng = lng
home_lat = lat
home_lng = lng

# --- CONSTANTS ---
DEG_TO_METERS = 111139.0 # Roughly 1 degree lat = 111km
MAX_ALTITUDE = 50.0
CLIMB_RATE = 0.5  # m/loop
FLY_SPEED = 0.00005 # ~5-10m per tick in degrees approx

def map_angle(x1, y1, x2, y2):
    return math.atan2(y2 - y1, x2 - x1)

def on_message(topic, msg):
    global state, target_lat, target_lng
    try:
        data = json.loads(msg)
        command = data.get("command")
        print("Received command:", command)
        
        if command == "TAKEOFF" and state == "IDLE":
            state = "TAKEOFF"
        elif command == "LAND":
            state = "LANDING"
        elif command == "RTH":
            state = "RTH"
            target_lat, target_lng = home_lat, home_lng
        elif command == "GOTO":
            target_lat = data.get("lat", lat)
            target_lng = data.get("lng", lng)
            state = "FLYING"
        elif command == "EMERGENCY":
            state = "EMERGENCY"
    except Exception as e:
        print("Error parsing command:", e)

def connect_mqtt():
    client = MQTTClient(CLIENT_ID, MQTT_SERVER)
    client.set_callback(on_message)
    client.connect()
    client.subscribe(TOPIC_COMMAND)
    print("Connected to MQTT Broker:", MQTT_SERVER)
    return client

def update_physics():
    global lat, lng, alt, state, battery, target_lat, target_lng
    
    if state == "IDLE":
        speed = 0
    elif state == "TAKEOFF":
        if alt < MAX_ALTITUDE:
            alt += CLIMB_RATE
        else:
            state = "FLYING"
    elif state == "FLYING" or state == "RTH":
        dist_lat = target_lat - lat
        dist_lng = target_lng - lng
        dist = math.sqrt(dist_lat**2 + dist_lng**2)
        
        if dist > 0.00001:
            lat += (dist_lat / dist) * FLY_SPEED
            lng += (dist_lng / dist) * FLY_SPEED
        else:
            if state == "RTH":
                state = "LANDING"
            else:
                state = "FLYING" # Stay at target
    elif state == "LANDING":
        if alt > 0:
            alt -= CLIMB_RATE
        else:
            alt = 0
            state = "IDLE"
    elif state == "EMERGENCY":
        alt = 0 # Simulate crash/stop
        
    # Drain battery
    if state != "IDLE":
        battery -= 0.05
    if battery < 10 and state != "RTH" and state != "LANDING":
        print("Low Battery! Emergency RTH")
        state = "RTH"
        target_lat, target_lng = home_lat, home_lng

def main():
    try:
        client = connect_mqtt()
    except Exception as e:
        print("MQTT Connection Failed. Retrying in 5s...")
        time.sleep(5)
        machine.reset()

    last_telemetry = 0
    
    while True:
        try:
            client.check_msg() # Non-blocking check
            
            update_physics()
            
            # Publish telemetry every 1 second
            if time.time() - last_telemetry >= 1:
                telemetry = {
                    "id": CLIENT_ID,
                    "state": state,
                    "lat": lat,
                    "lng": lng,
                    "alt": alt,
                    "battery": max(0, round(battery, 1)),
                    "timestamp": time.time()
                }
                client.publish(TOPIC_TELEMETRY, json.dumps(telemetry))
                last_telemetry = time.time()
                print("Status:", state, "| Pos:", lat, lng, "| Alt:", alt)
                
            time.sleep(0.1)
        except Exception as e:
            print("Error in loop:", e)
            time.sleep(2)
            machine.reset()

if __name__ == "__main__":
    main()
