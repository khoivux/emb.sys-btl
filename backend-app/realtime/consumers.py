import json
from channels.generic.websocket import AsyncWebsocketConsumer

class DroneConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.room_group_name = "drone_updates"

        # Join the group to receive updates broadcast by the MQTT listener
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )

        await self.accept()
        print("WebSocket client connected to Drone realm.")

    async def disconnect(self, close_code):
        # Leave the group
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )
        print("WebSocket client disconnected.")

    # Receive message from the drone_updates group
    async def drone_telemetry(self, event):
        message = event["message"]
        await self.send(text_data=json.dumps({
            "type": "telemetry",
            "data": message
        }))

    async def drone_discovered(self, event):
        message = event["message"]
        await self.send(text_data=json.dumps({
            "type": "discovery",
            "data": message
        }))

    async def drone_lost(self, event):
        message = event["message"]
        await self.send(text_data=json.dumps({
            "type": "drone_lost",
            "data": message
        }))
