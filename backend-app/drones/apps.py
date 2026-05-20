from django.apps import AppConfig


class DronesConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'drones'

    def ready(self):
        import os
        # Chỉ chạy scheduler trong process chính, tránh chạy 2 lần khi Django auto-reload
        if os.environ.get('RUN_MAIN', None) != 'true':
            from . import scheduler
            scheduler.start()
