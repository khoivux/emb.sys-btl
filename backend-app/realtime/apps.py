from django.apps import AppConfig
import os

class RealtimeConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'realtime'

    def ready(self):
        # RUN_MAIN=true is for the main runserver process.
        # If RUN_MAIN is not set, it might be a single-process server like Daphne or a management command.
        # However, we only want to start the MQTT bridge when running the ACTUAL SERVER.
        import sys
        if 'runserver' in sys.argv:
            if os.environ.get('RUN_MAIN') == 'true':
                from .mqtt_bridge import start_mqtt_bridge
                start_mqtt_bridge()
        else:
            # If not runserver, but we want it to run (e.g. Daphne/Gunicorn started manually)
            # This is safer for student projects
            if os.environ.get('RUN_MAIN') != 'false': # Basic guard
                from .mqtt_bridge import start_mqtt_bridge
                start_mqtt_bridge()
