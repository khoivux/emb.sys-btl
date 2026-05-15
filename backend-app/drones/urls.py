from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import DroneViewSet, TelemetryLogViewSet, RegisterView, UserViewSet, MyTokenObtainPairView, DroneClusterViewSet
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)

router = DefaultRouter()
router.register(r'drones', DroneViewSet)
router.register(r'telemetry', TelemetryLogViewSet)
router.register(r'users', UserViewSet)
router.register(r'clusters', DroneClusterViewSet, basename='clusters')

urlpatterns = [
    path('', include(router.urls)),
    path('auth/register/', RegisterView.as_view(), name='register'),
    path('auth/login/', MyTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
]
