from django.apps import AppConfig

class RealtimeConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'realtime'

    def ready(self):
        # We no longer start the MQTT bridge here because we use a dedicated 
        # mqtt_listener container for handling MQTT-to-DB-to-WS communications.
        # This prevents duplicate processing and state conflicts.
        pass
