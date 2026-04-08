import network
import time
import machine

# WiFi Configuration
WIFI_SSID = "Your_WiFi_SSID"
WIFI_PASS = "Your_WiFi_Password"

def do_connect():
    wlan = network.WLAN(network.STA_IF)
    wlan.active(True)
    if not wlan.isconnected():
        print('Connecting to network...')
        wlan.connect(WIFI_SSID, WIFI_PASS)
        
        # Wait for connection with timeout
        timeout = 10
        start_time = time.time()
        while not wlan.isconnected() and (time.time() - start_time) < timeout:
            machine.idle()
            
    if wlan.isconnected():
        print('Network config:', wlan.ifconfig())
    else:
        print('Connection failed!')

do_connect()
