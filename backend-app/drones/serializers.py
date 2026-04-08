from rest_framework import serializers
from .models import Drone, TelemetryLog

class DroneSerializer(serializers.ModelSerializer):
    class Meta:
        model = Drone
        fields = '__all__'

class TelemetryLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = TelemetryLog
        fields = '__all__'
