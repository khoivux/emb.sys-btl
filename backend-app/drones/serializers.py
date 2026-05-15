from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import Drone, TelemetryLog, DroneCluster
from django.contrib.auth.models import User

class MyTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        # Add custom claims
        token['username'] = user.username
        token['is_staff'] = user.is_staff
        return token

class DroneSerializer(serializers.ModelSerializer):
    class Meta:
        model = Drone
        fields = '__all__'

class DroneClusterSerializer(serializers.ModelSerializer):
    drone_details = DroneSerializer(many=True, read_only=True, source='drones')
    
    class Meta:
        model = DroneCluster
        fields = ['id', 'name', 'owner', 'drones', 'drone_details', 'description', 'created_at']
        extra_kwargs = {'owner': {'read_only': True}}

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'is_staff', 'date_joined']

class TelemetryLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = TelemetryLog
        fields = '__all__'
