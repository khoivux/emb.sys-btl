import usocket as socket
import ustruct as struct
from ubinascii import hexlify

class MQTTException(Exception):
    pass

class MQTTClient:
    def __init__(self, client_id, server, port=0, user=None, password=None, keepalive=0, ssl=False, ssl_params={}):
        if port == 0:
            port = 8883 if ssl else 1883
        self.client_id = client_id
        self.sock = None
        self.server = server
        self.port = port
        self.ssl = ssl
        self.ssl_params = ssl_params
        self.pid = 0
        self.cb = None
        self.user = user
        self.pswd = password
        self.keepalive = keepalive
        self.lw_topic = None
        self.lw_msg = None
        self.lw_qos = 0
        self.lw_retain = False

    def _send_str(self, s):
        self.sock.write(struct.pack("!H", len(s)))
        self.sock.write(s)

    def _recv_len(self):
        n = 0
        sh = 0
        while 1:
            res = self.sock.read(1)[0]
            n |= (res & 0x7f) << sh
            if not res & 0x80:
                return n
            sh += 7

    def set_callback(self, f):
        self.cb = f

    def set_last_will(self, topic, msg, retain=False, qos=0):
        self.lw_topic = topic
        self.lw_msg = msg
        self.lw_qos = qos
        self.lw_retain = retain

    def connect(self, clean_session=True):
        self.sock = socket.socket()
        addr = socket.getaddrinfo(self.server, self.port)[0][-1]
        self.sock.connect(addr)
        if self.ssl:
            import ussl
            self.sock = ussl.wrap_socket(self.sock, **self.ssl_params)
        premsg = bytearray(b"\x10\0\0\x04MQTT\x04\x02\0\0")
        msg = bytearray(b"\x04MQTT\x04\x02\0\0")
        if self.user is not None:
            premsg[10] |= 0xC0
            msg[6] |= 0xC0
        if self.keepalive:
            premsg[11] |= self.keepalive >> 8
            premsg[12] |= self.keepalive & 0x00FF
            msg[7] |= self.keepalive >> 8
            msg[8] |= self.keepalive & 0x00FF
        if not clean_session:
            premsg[10] |= 0x02
            msg[6] |= 0x02
        if self.lw_topic:
            premsg[10] |= 0x04 | (self.lw_qos & 0x01) << 3 | (self.lw_qos & 0x02) << 3
            msg[6] |= 0x04 | (self.lw_qos & 0x01) << 3 | (self.lw_qos & 0x02) << 3
            if self.lw_retain:
                premsg[10] |= 0x20
                msg[6] |= 0x20
        self.sock.write(b"\x10")
        self._send_str(self.client_id)
        if self.lw_topic:
            self._send_str(self.lw_topic)
            self._send_str(self.lw_msg)
        if self.user is not None:
            self._send_str(self.user)
            self._send_str(self.pswd)
        res = self.sock.read(4)
        return res[2] & 1

    def disconnect(self):
        self.sock.write(b"\xe0\0")
        self.sock.close()

    def ping(self):
        self.sock.write(b"\xc0\0")

    def publish(self, topic, msg, retain=False, qos=0):
        pkt = bytearray(b"\x30\0\0\0")
        pkt[0] |= qos << 1
        if retain:
            pkt[0] |= 1
        self._send_str(topic)
        self.sock.write(msg)

    def subscribe(self, topic, qos=0):
        pkt = bytearray(b"\x82\0\0\0")
        self.pid += 1
        struct.pack_into("!H", pkt, 1, 2 + 2 + len(topic) + 1)
        struct.pack_into("!H", pkt, 3, self.pid)
        self.sock.write(pkt)
        self._send_str(topic)
        self.sock.write(struct.pack("B", qos))

    def wait_msg(self):
        res = self.sock.read(1)
        if res is None:
            return None
        if res == b"":
            raise MQTTException("Device disconnected")
        if res == b"\xd0":  # PINGRESP
            sz = self.sock.read(1)[0]
            assert sz == 0
            return None
        op = res[0]
        if op & 0xf0 != 0x30:
            return op
        sz = self._recv_len()
        topic_len = struct.unpack("!H", self.sock.read(2))[0]
        topic = self.sock.read(topic_len)
        sz -= topic_len + 2
        if op & 6:
            pid = struct.unpack("!H", self.sock.read(2))[0]
            sz -= 2
        msg = self.sock.read(sz)
        self.cb(topic, msg)
        return op
