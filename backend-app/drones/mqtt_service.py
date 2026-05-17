"""
Singleton MQTT Client — giữ 1 persistent connection duy nhất cho toàn bộ Django process.

Tại sao?
- publish.single() tạo TCP connection + MQTT handshake MỖI LẦN gọi (~200-500ms overhead)
- Singleton client giữ connection sống, publish chỉ tốn ~1-2ms
- Thread-safe nhờ lock, tự động reconnect khi mất kết nối
"""

import os
import json
import logging
import threading
import paho.mqtt.client as mqtt

logger = logging.getLogger(__name__)

MQTT_HOST = os.getenv("MQTT_HOST", "localhost")
MQTT_PORT = int(os.getenv("MQTT_PORT", "1883"))


class MQTTService:
    """
    Persistent MQTT client singleton.
    - Giữ 1 TCP connection sống suốt vòng đời Django process
    - Thread-safe (dùng lock cho publish)
    - Tự reconnect khi mất kết nối
    """

    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                # Double-checked locking
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
        self._initialized = True
        self._publish_lock = threading.Lock()

        self._client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION1, client_id="django-backend")
        self._client.on_connect = self._on_connect
        self._client.on_disconnect = self._on_disconnect
        self._connected = False

        # Kết nối và chạy network loop trên background thread
        try:
            self._client.connect(MQTT_HOST, MQTT_PORT, keepalive=60)
            self._client.loop_start()  # Background thread xử lý ping/reconnect
            logger.info(f"[MQTT Service] Connecting to {MQTT_HOST}:{MQTT_PORT}...")
        except Exception as e:
            logger.error(f"[MQTT Service] Initial connect failed: {e}")

    def _on_connect(self, client, userdata, flags, rc):
        self._connected = True
        logger.info(f"[MQTT Service] Connected (rc={rc})")

    def _on_disconnect(self, client, userdata, rc):
        self._connected = False
        if rc != 0:
            logger.warning(f"[MQTT Service] Unexpected disconnect (rc={rc}), auto-reconnecting...")
            # loop_start() sẽ tự reconnect

    def publish(self, topic: str, payload: str, qos: int = 1):
        """Publish 1 message. Thread-safe."""
        with self._publish_lock:
            result = self._client.publish(topic, payload, qos=qos)
            result.wait_for_publish(timeout=5)

    def publish_batch(self, messages: list[dict], qos: int = 1):
        """
        Publish nhiều messages cùng lúc qua cùng 1 connection.
        messages: [{"topic": "...", "payload": "..."}, ...]
        """
        import time as _time
        t0 = _time.time()
        with self._publish_lock:
            results = []
            for msg in messages:
                result = self._client.publish(msg["topic"], msg["payload"], qos=qos)
                results.append(result)
            t_pub = _time.time()
            logger.info(f"[MQTT] publish {len(messages)} msgs: {(t_pub - t0)*1000:.1f}ms")
            # Đợi tất cả gửi xong
            for result in results:
                result.wait_for_publish(timeout=5)
            t_wait = _time.time()
            logger.info(f"[MQTT] wait_for_publish: {(t_wait - t_pub)*1000:.1f}ms | Tổng batch: {(t_wait - t0)*1000:.1f}ms")

    @property
    def is_connected(self):
        return self._connected


def get_mqtt_service() -> MQTTService:
    """Factory function — trả về singleton instance."""
    return MQTTService()
