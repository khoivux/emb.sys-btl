from django.urls import re_path
from .consumers import DroneConsumer

websocket_urlpatterns = [
    re_path(r'ws/drones/$', DroneConsumer.as_asgi()),
]
