import usocket as socket
import ustruct as struct
from ubinascii import hexlify

class MQTTException(Exception):
    pass

class MQTTClient:
    def __init__(self, client_id, server, port=1883, user=None, password=None, keepalive=0, ssl=False, ssl_params={}):
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

    def _send_str(self, s):
        if isinstance(s, str): s = s.encode("utf-8")
        self.sock.write(struct.pack("!H", len(s)))
        self.sock.write(s)

    def _recv_len(self):
        n = 0
        sh = 0
        while 1:
            res = self.sock.read(1)[0]
            n |= (res & 0x7f) << sh
            if not res & 0x80: return n
            sh += 7

    def set_callback(self, f):
        self.cb = f

    def connect(self, clean_session=True):
        self.sock = socket.socket()
        addr = socket.getaddrinfo(self.server, self.port)[0][-1]
        self.sock.connect(addr)
        if self.ssl:
            import ussl
            self.sock = ussl.wrap_socket(self.sock, **self.ssl_params)
        
        msg = bytearray(b"\x00\x04MQTT\x04\x02\x00\x00")
        sz = 12 + len(self.client_id)
        msg[7] = 0x02 if clean_session else 0
        if self.keepalive:
            msg[8] |= self.keepalive >> 8
            msg[9] |= self.keepalive & 0x00FF
        
        self.sock.write(b"\x10")
        # Handle length for CONNECT (usually < 127)
        self.sock.write(struct.pack("B", sz))
        self.sock.write(msg)
        self._send_str(self.client_id)
        
        res = self.sock.read(4)
        return res[2] & 1

    def disconnect(self):
        try:
            self.sock.write(b"\xe0\0")
            self.sock.close()
        except: pass

    def ping(self):
        self.sock.write(b"\xc0\0")

    def publish(self, topic, msg, retain=False, qos=0):
        pkt = bytearray(b"\x30\x00\x00\x00")
        if isinstance(msg, str): msg = msg.encode("utf-8")
        sz = 2 + len(topic) + len(msg)
        i = 1
        t_sz = sz
        while t_sz > 0x7f:
            pkt[i] = (t_sz & 0x7f) | 0x80
            t_sz >>= 7
            i += 1
        pkt[i] = t_sz
        self.sock.write(pkt[:i+1])
        self._send_str(topic)
        self.sock.write(msg)

    def subscribe(self, topic, qos=0):
        self.pid += 1
        # 2 bytes for PID + 2 bytes for Topic Len + Topic + 1 byte for QoS
        sz = 2 + 2 + len(topic) + 1
        # Fixed Header (0x82) + Remaining Length
        self.sock.write(b"\x82")
        self.sock.write(struct.pack("B", sz))
        # Packet ID
        self.sock.write(struct.pack("!H", self.pid))
        # Topic + QoS
        self._send_str(topic)
        self.sock.write(struct.pack("B", qos))

    def check_msg(self):
        self.sock.setblocking(False)
        try:
            res = self.sock.read(1)
        except:
            self.sock.setblocking(True)
            return None
        self.sock.setblocking(True)
        if res is None or res == b"": return None
        if res == b"\xd0": return None
        op = res[0]
        if op & 0xf0 != 0x30: return op
        sz = self._recv_len()
        topic_len = struct.unpack("!H", self.sock.read(2))[0]
        topic = self.sock.read(topic_len)
        sz -= topic_len + 2
        msg = self.sock.read(sz)
        if self.cb: self.cb(topic, msg)
        return op
