import json
import os
from .mqtt_service import get_mqtt_service
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
        print(f"\n📥 [DJANGO API] NHẬN LỆNH: ID={drone_id} | Type={command_type} | Params={request.data.get('params', {})}")
        
        try:
            drone = Drone.objects.get(device_id=drone_id)
            if not request.user.is_staff and drone.owner != request.user:
                print(f"❌ [DJANGO API] TỪ CHỐI: User {request.user.username} không sở hữu drone này (Owner ID={drone.owner_id})!")
                return Response({"error": "You do not own this drone"}, status=403)
        except Drone.DoesNotExist:
            print(f"❌ [DJANGO API] KHÔNG TÌM THẤY: Drone với device_id={drone_id} không có trong DB!")
            return Response({"error": "Drone not found"}, status=404)

        topic = f"drone/{drone_id}/command"
        try:
            payload = json.dumps({
                "type": command_type,
                "params": request.data.get('params', {})
            })
            print(f"📡 [DJANGO API] Đang publish qua MQTT: Topic={topic} | Payload={payload}")
            get_mqtt_service().publish(topic, payload)
            print("✅ [DJANGO API] Đã publish lên MQTT Broker thành công!\n")
            return Response({"status": "Command sent", "topic": topic})
        except Exception as e:
            print(f"💥 [DJANGO API] LỖI khi publish MQTT: {e}\n")
            return Response({"error": str(e)}, status=500)

    @action(detail=False, methods=['post'])
    def formation(self, request):
        """
        Nhận danh sách drone + tọa độ đích đã tính sẵn từ Frontend.
        Body: { "targets": [{ "drone_id": "abc", "lat": 20.98, "lng": 105.79 }, ...] }
        Gửi lệnh GOTO hàng loạt xuống MQTT (batch trong 1 connection duy nhất).
        """
        import time as _time
        t0 = _time.time()
        print(f"\n⏱️ [FORMATION API] === Nhận request formation lúc {_time.strftime('%H:%M:%S')} ===")

        targets = request.data.get('targets', [])
        if not targets:
            return Response({"error": "No targets provided"}, status=400)

        errors = []
        mqtt_messages = []  # Thu thập tất cả messages trước, gửi 1 lần

        # Bước 1: Validate tất cả drone & chuẩn bị messages
        t_db = _time.time()
        drone_ids = [t.get('drone_id') for t in targets]
        drones_map = {d.device_id: d for d in Drone.objects.filter(device_id__in=drone_ids)}
        t_db_done = _time.time()
        print(f"⏱️ [FORMATION API] DB query {len(drone_ids)} drones: {(t_db_done - t_db)*1000:.1f}ms")

        for t in targets:
            drone_id = t.get('drone_id')
            drone = drones_map.get(drone_id)

            if not drone:
                errors.append(f"{drone_id}: not found")
                continue
            if not request.user.is_staff and drone.owner != request.user:
                errors.append(f"{drone_id}: not owned by you")
                continue

            mqtt_messages.append({
                'topic': f"drone/{drone_id}/command",
                'payload': json.dumps({
                    "type": "GOTO",
                    "params": {"lat": t["lat"], "lng": t["lng"]}
                }),
            })

        # Bước 2: Gửi tất cả lệnh trong 1 kết nối MQTT duy nhất
        sent = 0
        if mqtt_messages:
            try:
                t_mqtt = _time.time()
                get_mqtt_service().publish_batch(mqtt_messages)
                t_mqtt_done = _time.time()
                sent = len(mqtt_messages)
                print(f"⏱️ [FORMATION API] MQTT publish_batch {sent} messages: {(t_mqtt_done - t_mqtt)*1000:.1f}ms")
            except Exception as e:
                errors.append(f"MQTT batch error: {str(e)}")

        t_total = _time.time()
        print(f"⏱️ [FORMATION API] === Tổng xử lý: {(t_total - t0)*1000:.1f}ms (DB: {(t_db_done - t_db)*1000:.1f}ms) ===\n")

        result = {"status": f"Formation sent to {sent} drones"}
        if errors:
            result["errors"] = errors
        return Response(result)

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
        
        messages = []
        for drone in cluster.drones.all():
            messages.append({
                'topic': f"drone/{drone.device_id}/command",
                'payload': json.dumps({"type": cmd_type, "params": params}),
            })
        if messages:
            get_mqtt_service().publish_batch(messages)
            
        return Response({"status": f"Command {cmd_type} sent to cluster {cluster.name}"})
