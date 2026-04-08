from django.db import models

class Drone(models.Model):
    device_id = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=100)
    is_active = models.BooleanField(default=False)
    last_seen = models.DateTimeField(auto_now=True)
    
    # Thresholds
    min_battery_threshold = models.FloatField(default=20.0)
    max_altitude_limit = models.FloatField(default=100.0)

    def __str__(self):
        return f"{self.name} ({self.device_id})"

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
