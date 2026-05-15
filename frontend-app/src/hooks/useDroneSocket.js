import { useState, useEffect, useRef } from 'react';

export const useDroneSocket = () => {
  const [drones, setDrones] = useState({});
  const [discoveredDrones, setDiscoveredDrones] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    let reconnectTimeout;
    
    const connect = () => {
        // Connect to Django Channels WebSocket
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        // Force 127.0.0.1 instead of localhost for Windows compatibility
        const socketUrl = `${protocol}//127.0.0.1:8000/ws/drones/`;
        console.log("🔗 Connecting to WebSocket:", socketUrl);
        
        const socket = new WebSocket(socketUrl);
        socketRef.current = socket;

        socket.onopen = () => {
          console.log("✅ [WS] Connected to Drone Gateway");
          setIsConnected(true);
          clearTimeout(reconnectTimeout);
        };

        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'telemetry') {
              const droneData = data.data;
              setDrones((prev) => ({
                ...prev,
                [droneData.id]: droneData,
              }));
            } else if (data.type === 'discovery') {
              setDiscoveredDrones(prev => {
                  if (prev.find(d => d.device_id === data.data.device_id)) return prev;
                  return [...prev, data.data];
              });
            }
          } catch (err) {
            console.error("❌ [WS] Message parsing error:", err);
          }
        };

        socket.onerror = (err) => {
          console.error("❌ [WS] WebSocket Error - Backend might be down.");
        };

        socket.onclose = (e) => {
          console.log(`ℹ️ [WS] Connection closed (code: ${e.code}). Retrying in 3s...`);
          setIsConnected(false);
          reconnectTimeout = setTimeout(connect, 3000);
        };
    };

    connect();

    return () => {
      clearTimeout(reconnectTimeout);
      if (socketRef.current) {
        socketRef.current.onclose = null; // Prevent reconnect on unmount
        socketRef.current.close();
      }
    };
  }, []);

  const sendCommand = (droneId, command, params = {}) => {
    const token = localStorage.getItem('token');
    console.log(`📡 Sending Command: ${command} to ${droneId}`, params);
    
    fetch("http://127.0.0.1:8000/api/drones/command/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": token ? `Bearer ${token}` : '',
      },
      body: JSON.stringify({
        drone_id: droneId,
        command: command,
        ...params,
      }),
    })
    .then(res => {
        if (res.status === 401) {
            localStorage.removeItem('token');
            window.location.reload();
        }
        return res.json();
    })
    .then(data => console.log("✅ Command Response:", data))
    .catch(err => {
        console.error("❌ Command Failed:", err);
    });
  };

  return { drones, discoveredDrones, setDiscoveredDrones, sendCommand, isConnected };
};
