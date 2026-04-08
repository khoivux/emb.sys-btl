from rest_framework import viewsets
from .models import Drone, TelemetryLog
from .serializers import DroneSerializer, TelemetryLogSerializer

from rest_framework.decorators import action
from rest_framework.response import Response
import json
import paho.mqtt.publish as publish

class DroneViewSet(viewsets.ModelViewSet):
    queryset = Drone.objects.all()
    serializer_class = DroneSerializer

    @action(detail=False, methods=['post'])
    def command(self, request):
        drone_id = request.data.get('drone_id')
        command = request.data.get('command')
        
        # Capture all extra fields like 'direction', 'lat', 'lng'
        data = request.data.copy()
        data.pop('drone_id', None)
        
        # Publish to MQTT Broker
        try:
            publish.single(
                "drone/command",
                payload=json.dumps(data),
                hostname="localhost",
                port=1883
            )
            return Response({"status": "Command sent", "drone": drone_id, "command": command})
        except Exception as e:
            return Response({"error": str(e)}, status=500)

class TelemetryLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = TelemetryLog.objects.all()
    serializer_class = TelemetryLogSerializer
    
    def get_queryset(self):
        drone_id = self.request.query_params.get('drone_id')
        if drone_id:
            return self.queryset.filter(drone__device_id=drone_id)
        return self.queryset
