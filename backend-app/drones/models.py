from django.db import models
from django.contrib.auth.models import User

class Drone(models.Model):
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='drones', null=True, blank=True)
    device_id = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=100)
    is_active = models.BooleanField(default=False)
    last_seen = models.DateTimeField(auto_now=True)
    battery = models.FloatField(default=100.0)
    state = models.CharField(max_length=20, default='IDLE')
    
    # Thresholds
    min_battery_threshold = models.FloatField(default=20.0)
    max_altitude_limit = models.FloatField(default=100.0)

    def __str__(self):
        return f"{self.name} ({self.device_id})"

class DroneCluster(models.Model):
    name = models.CharField(max_length=100)
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='clusters')
    drones = models.ManyToManyField(Drone, related_name='clusters', blank=True)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

class TelemetryLog(models.Model):
    drone = models.ForeignKey(Drone, on_delete=models.CASCADE, related_name='telemetry_logs')
    timestamp = models.DateTimeField(auto_now_add=True)
    latitude = models.FloatField()
    longitude = models.FloatField()
    altitude = models.FloatField()
    battery = models.FloatField()
    state = models.CharField(max_length=20)

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f"{self.drone.device_id} at {self.timestamp}"


class ScheduledMission(models.Model):
    """Lưu trữ một lịch bay độc lập cho một hoặc nhiều drone."""
    STATUS_CHOICES = [
        ('PENDING', 'Đang chờ'),
        ('EXECUTED', 'Đã thực thi'),
        ('FAILED', 'Thất bại'),
        ('CANCELLED', 'Đã huỷ'),
    ]
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='scheduled_missions', null=True, blank=True)
    # targets_json: [{"drone_id": "drone1", "lat": 20.98, "lng": 105.79}, ...]
    targets_json = models.JSONField()
    execute_at = models.DateTimeField()
    status = models.CharField(max_length=20, default='PENDING', choices=STATUS_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Mission #{self.id} lúc {self.execute_at:%H:%M %d/%m/%Y} ({self.status})"
