from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import DroneViewSet, TelemetryLogViewSet

router = DefaultRouter()
router.register(r'drones', DroneViewSet)
router.register(r'telemetry', TelemetryLogViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
