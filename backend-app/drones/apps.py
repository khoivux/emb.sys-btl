from django.apps import AppConfig


class DronesConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'drones'

    def ready(self):
        import os
        # Khởi tạo MQTT connection ngay khi Django khởi động để tránh delay/drop tin nhắn đầu tiên
        from .mqtt_service import get_mqtt_service
        get_mqtt_service()
        
        # Chỉ chạy scheduler trong process chính, tránh chạy 2 lần khi Django auto-reload
        if os.environ.get('RUN_MAIN', None) != 'true':
            from . import scheduler
            scheduler.start()
