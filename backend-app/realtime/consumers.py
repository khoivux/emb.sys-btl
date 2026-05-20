import json
import os
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async

class DroneConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.room_group_name = "drone_updates"
        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()
        
        # Khởi tạo cache xác thực để tránh truy vấn DB ở tần suất cao (20Hz)
        self.cached_token = None
        self.authenticated_user = None
        self.authorized_drones = set()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    # ------------------------------------------------------------------ #
    # Nhận lệnh từ Frontend qua WebSocket → publish MQTT QoS 0           #
    # ------------------------------------------------------------------ #
    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
            if data.get("type") != "command":
                return

            token = data.get("token")
            if not token:
                await self.send(text_data=json.dumps({"error": "unauthorized"}))
                return

            # 1. Xác thực Token nhanh từ Cache (tránh query database User)
            if token != self.cached_token:
                user = await self._get_user_from_token(token)
                if user is None:
                    await self.send(text_data=json.dumps({"error": "unauthorized"}))
                    return
                self.cached_token = token
                self.authenticated_user = user
                self.authorized_drones = set() # Reset cache drone khi đổi user
            else:
                user = self.authenticated_user

            drone_id  = data.get("drone_id")
            cmd_type  = data.get("cmd")
            params    = data.get("params", {})

            # 2. Xác thực quyền sở hữu Drone từ Cache (tránh query database Drone)
            if drone_id not in self.authorized_drones:
                allowed = await self._check_ownership(user, drone_id)
                if not allowed:
                    await self.send(text_data=json.dumps({"error": "forbidden"}))
                    return
                self.authorized_drones.add(drone_id)

            # Publish MQTT QoS 0 (fire-and-forget) — cực nhanh
            topic   = f"drone/{drone_id}/command"
            payload = json.dumps({"type": cmd_type, "params": params})
            await self._mqtt_publish(topic, payload)

        except Exception as e:
            print(f"[WS Command Error] {e}")

    # ------------------------------------------------------------------ #
    # Helpers (chạy trong thread pool để không block event loop)          #
    # ------------------------------------------------------------------ #
    @database_sync_to_async
    def _get_user_from_token(self, token):
        if not token:
            return None
        try:
            from rest_framework_simplejwt.tokens import AccessToken
            from django.contrib.auth.models import User
            access = AccessToken(token)
            return User.objects.get(id=access["user_id"])
        except Exception:
            return None

    @database_sync_to_async
    def _check_ownership(self, user, drone_id):
        if user.is_staff:
            return True
        from drones.models import Drone
        try:
            drone = Drone.objects.get(device_id=drone_id)
            return drone.owner == user
        except Drone.DoesNotExist:
            return False

    @database_sync_to_async
    def _mqtt_publish(self, topic, payload):
        from drones.mqtt_service import get_mqtt_service
        # QoS 0: fire-and-forget, không wait_for_publish → latency ~1ms
        get_mqtt_service()._client.publish(topic, payload, qos=0)

    # ------------------------------------------------------------------ #
    # Broadcast handlers (nhận từ Redis Channel Layer)                    #
    # ------------------------------------------------------------------ #
    async def drone_telemetry(self, event):
        await self.send(text_data=json.dumps({"type": "telemetry", "data": event["message"]}))

    async def drone_discovered(self, event):
        await self.send(text_data=json.dumps({"type": "discovery", "data": event["message"]}))

    async def drone_lost(self, event):
        await self.send(text_data=json.dumps({"type": "drone_lost", "data": event["message"]}))

    async def drone_deleted(self, event):
        await self.send(text_data=json.dumps({"type": "drone_deleted", "data": event["message"]}))
