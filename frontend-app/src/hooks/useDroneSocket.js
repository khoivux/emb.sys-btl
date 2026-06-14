import { useState, useEffect, useRef } from 'react';

export const useDroneSocket = ({ onUnauthorized } = {}) => {
  const [drones, setDrones] = useState({});
  const [discoveredDrones, setDiscoveredDrones] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef(null);

  // Helper: fetch với auto-logout khi 401
  const authFetch = async (url, options = {}) => {
    const token = localStorage.getItem('token');
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : '',
        ...options.headers,
      },
    });
    if (res.status === 401) {
      console.warn('🔐 Token hết hạn, đang đăng xuất...');
      onUnauthorized?.();
      return null;
    }
    return res;
  };

  // Load danh sách discovery lúc khởi động
  useEffect(() => {
    const hostname = window.location.hostname;
    if (!localStorage.getItem('token')) return;

    authFetch(`http://${hostname}:8000/api/drones/discovery/`)
      .then(res => res?.json())
      .then(data => {
        if (Array.isArray(data)) setDiscoveredDrones(data);
      })
      .catch(err => console.error('Lỗi lấy discovery ban đầu:', err));
  }, []);

  useEffect(() => {
    let reconnectTimeout;
    const hostname = window.location.hostname;

    const connect = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const socketUrl = `${protocol}//${hostname}:8000/ws/drones/`;
      console.log('🔗 Connecting to WebSocket:', socketUrl);

      const socket = new WebSocket(socketUrl);
      socketRef.current = socket;

      socket.onopen = () => {
        console.log('✅ [WS] Connected to Drone Gateway');
        setIsConnected(true);
        clearTimeout(reconnectTimeout);
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'telemetry') {
            const d = data.data;
            const normalized = {
              ...d,
              latitude:  d.latitude  !== undefined ? d.latitude  : d.lat,
              longitude: d.longitude !== undefined ? d.longitude : d.lng,
            };
            setDrones(prev => ({
              ...prev,
              [normalized.device_id || normalized.id]: {
                ...prev[normalized.device_id || normalized.id],
                ...normalized,
              },
            }));
          } else if (data.type === 'discovery') {
            setDiscoveredDrones(prev =>
              prev.find(d => d.device_id === data.data.device_id) ? prev : [...prev, data.data]
            );
          } else if (data.type === 'drone_lost') {
            setDiscoveredDrones(prev => prev.filter(d => d.device_id !== data.data.device_id));
          } else if (data.type === 'drone_deleted') {
            setDrones(prev => {
              const next = { ...prev };
              delete next[data.message.id];
              return next;
            });
          }
        } catch (err) {
          console.error('❌ [WS] Message parsing error:', err);
        }
      };

      socket.onclose = () => {
        setIsConnected(false);
        reconnectTimeout = setTimeout(connect, 3000);
      };
    };

    connect();

    return () => {
      clearTimeout(reconnectTimeout);
      if (socketRef.current) {
        socketRef.current.onclose = null;
        socketRef.current.close();
      }
    };
  }, []);

  // ------------------------------------------------------------------ //
  // sendCommandWS — WebSocket (~1-5ms), dùng cho movement real-time
  // ------------------------------------------------------------------ //
  const sendCommandWS = (droneId, command, params = {}) => {
    const ws = socketRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.warn(`⚠️ [WS Command] Socket chưa sẵn sàng, chuyển hướng sang HTTP Fallback cho lệnh: ${command}`);
      sendCommand(droneId, command, params);
      return;
    }
    console.log(`📡 [WS Command] Gửi qua WebSocket: Drone=${droneId} | Cmd=${command} | Params=`, params);
    ws.send(JSON.stringify({
      type: 'command',
      token: localStorage.getItem('token'),
      drone_id: droneId,
      cmd: command,
      params,
    }));
  };

  // ------------------------------------------------------------------ //
  // sendCommand — HTTP fallback (TAKEOFF/LAND/EMERGENCY/GOTO)
  // ------------------------------------------------------------------ //
  const sendCommand = (droneId, command, params = {}) => {
    const hostname = window.location.hostname;
    console.log(`📥 [HTTP Command] Đang gửi qua API POST: Drone=${droneId} | Cmd=${command} | Params=`, params);
    
    authFetch(`http://${hostname}:8000/api/drones/command/`, {
      method: 'POST',
      body: JSON.stringify({ drone_id: droneId, type: command, params }),
    })
    .then(async (res) => {
      if (res.ok) {
        const data = await res.json();
        console.log(`✅ [HTTP Command] Thành công! Kết quả từ Server:`, data);
      } else {
        const errText = await res.text();
        console.error(`❌ [HTTP Command] Thất bại! Status=${res.status} | Chi tiết:`, errText);
      }
    })
    .catch(err => console.error('❌ [HTTP Command] Lỗi kết nối API:', err));
  };

  return { drones, discoveredDrones, setDiscoveredDrones, sendCommand, sendCommandWS, isConnected };
};
