# This file is executed on every boot (including wake-boot from deepsleep)
import gc
import esp
esp.osdebug(None)
gc.collect()

import wifimanager
config = wifimanager.setup_connection()

MQTT_SERVER = config["mqtt_server"]
MQTT_PORT = config["mqtt_port"]
