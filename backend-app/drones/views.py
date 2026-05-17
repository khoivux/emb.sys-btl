import json
import os
import paho.mqtt.publish as publish
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db.models import Q
from django.contrib.auth.models import User
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import Drone, TelemetryLog, DroneCluster
from rest_framework_simplejwt.views import TokenObtainPairView
from .serializers import DroneSerializer, TelemetryLogSerializer, UserSerializer, MyTokenObtainPairSerializer, DroneClusterSerializer

class MyTokenObtainPairView(TokenObtainPairView):
    serializer_class = MyTokenObtainPairSerializer

class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]
    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')
        email = request.data.get('email', '')
        if not username or not password:
            return Response({"error": "Username and password required"}, status=400)
        if User.objects.filter(username=username).exists():
            return Response({"error": "User already exists"}, status=400)
        user = User.objects.create_user(username=username, password=password, email=email)
        return Response({"message": "User created successfully"}, status=201)

class DroneViewSet(viewsets.ModelViewSet):
    queryset = Drone.objects.all()
    serializer_class = DroneSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_staff:
            return Drone.objects.all()
        
        # Chỉ cho phép claim thiết bị chưa có chủ (owner là null)
        if self.action == 'claim':
            return Drone.objects.filter(Q(owner=user) | Q(owner__isnull=True))
            
        # Các action khác (list, retrieve, update, destroy) chỉ truy xuất drone của chính user
        return Drone.objects.filter(owner=user)

    @action(detail=False, methods=['get'])
    def discovery(self, request):
        unclaimed = Drone.objects.filter(owner__isnull=True)
        serializer = self.get_serializer(unclaimed, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def claim(self, request, pk=None):
        drone = self.get_object()
        if drone.owner is not None:
            return Response({"error": "Drone này đã có chủ!"}, status=status.HTTP_400_BAD_REQUEST)
        
        drone.owner = request.user
        new_name = request.data.get('name')
        if new_name:
            drone.name = new_name
        drone.save()
        return Response({"status": "Ghép đôi thành công!", "drone": self.get_serializer(drone).data})

    def create(self, request, *args, **kwargs):
        device_id = request.data.get('device_id')
        name = request.data.get('name')
        
        if not device_id or not name:
            return Response({"error": "device_id và name là bắt buộc!"}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            drone = Drone.objects.get(device_id=device_id)
            if drone.owner is not None:
                if drone.owner == request.user:
                    return Response({"error": "Bạn đã sở hữu Drone này rồi!"}, status=status.HTTP_400_BAD_REQUEST)
                else:
                    return Response({"error": "Drone này đã được sở hữu bởi người dùng khác!"}, status=status.HTTP_400_BAD_REQUEST)
            
            # Tự động claim cho user luôn
            drone.owner = request.user
            drone.name = name
            drone.save()
            
            serializer = self.get_serializer(drone)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except Drone.DoesNotExist:
            return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        # Tự động gán owner là người dùng đang đăng nhập khi tạo thủ công
        serializer.save(owner=self.request.user)

    def perform_update(self, serializer):
        drone = serializer.save()
        # Thông báo cập nhật qua WebSocket
        channel_layer = get_channel_layer()
        if channel_layer:
            async_to_sync(channel_layer.group_send)(
                "drone_updates",
                {
                    "type": "drone_telemetry",
                    "message": {
                        "id": drone.device_id,
                        "name": drone.name,
                        "state": drone.state,
                        "is_active": drone.is_active
                    }
                }
            )

    def perform_destroy(self, instance):
        device_id = instance.device_id
        instance.delete()
        # Thông báo Xóa qua WebSocket
        channel_layer = get_channel_layer()
        if channel_layer:
            async_to_sync(channel_layer.group_send)(
                "drone_updates",
                {
                    "type": "drone_deleted",
                    "message": {"id": device_id}
                }
            )

    @action(detail=False, methods=['post'])
    def command(self, request):
        drone_id = request.data.get('drone_id')
        command_type = request.data.get('type')
        
        try:
            drone = Drone.objects.get(device_id=drone_id)
            if not request.user.is_staff and drone.owner != request.user:
                return Response({"error": "You do not own this drone"}, status=403)
        except Drone.DoesNotExist:
            return Response({"error": "Drone not found"}, status=404)

        topic = f"drone/{drone_id}/command"
        try:
            import paho.mqtt.publish as publish
            import json
            import os
            
            payload = json.dumps({
                "type": command_type,
                "params": request.data.get('params', {})
            })
            
            publish.single(
                topic,
                payload=payload,
                hostname=os.getenv("MQTT_HOST", "localhost"),
                port=1883
            )
            return Response({"status": "Command sent", "topic": topic})
        except Exception as e:
            return Response({"error": str(e)}, status=500)

    @action(detail=False, methods=['get'])
    def stats(self, request):
        if not request.user.is_staff:
            return Response({"error": "Admin only"}, status=403)
        
        total_drones = Drone.objects.count()
        active_drones = Drone.objects.filter(is_active=True).count()
        users_count = User.objects.count()
        
        # Simple stats: drones per user
        user_stats = []
        for user in User.objects.all():
            user_stats.append({
                "username": user.username,
                "drone_count": user.drones.count()
            })

        return Response({
            "total_drones": total_drones,
            "active_drones": active_drones,
            "total_users": users_count,
            "user_breakdown": user_stats
        })

from .serializers import UserSerializer
class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAdminUser]

class TelemetryLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = TelemetryLog.objects.all()
    serializer_class = TelemetryLogSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        drone_id = self.request.query_params.get('drone_id')
        qs = self.queryset
        if not user.is_staff:
            qs = qs.filter(drone__owner=user)
        if drone_id:
            qs = qs.filter(drone__device_id=drone_id)
        return qs

class DroneClusterViewSet(viewsets.ModelViewSet):
    serializer_class = DroneClusterSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return DroneCluster.objects.filter(owner=self.request.user)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    @action(detail=True, methods=['post'])
    def command(self, request, pk=None):
        cluster = self.get_object()
        cmd_type = request.data.get('type')
        params = request.data.get('params', {})
        
        for drone in cluster.drones.all():
            topic = f"drone/{drone.device_id}/command"
            payload = json.dumps({"type": cmd_type, "params": params})
            publish.single(topic, payload, hostname=os.getenv('MQTT_HOST', 'localhost'))
            
        return Response({"status": f"Command {cmd_type} sent to cluster {cluster.name}"})
