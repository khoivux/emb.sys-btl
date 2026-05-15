import { useState, useEffect, useRef } from 'react';

export const useDroneSocket = () => {
  const [drones, setDrones] = useState({});
  const [discoveredDrones, setDiscoveredDrones] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    let reconnectTimeout;
    const hostname = window.location.hostname;
    
    const connect = () => {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const socketUrl = `${protocol}//${hostname}:8000/ws/drones/`;
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
            console.log("📥 [WS MESSAGE]", data.type, data.data);
            
            if (data.type === 'telemetry') {
              const droneData = data.data;
              console.log("🛰️ Telemetry for:", droneData.device_id, "Active:", droneData.is_active);
              
              setDrones((prev) => ({
                ...prev,
                [droneData.device_id || droneData.id]: {
                    ...prev[droneData.device_id || droneData.id],
                    ...droneData
                },
              }));
            } else if (data.type === 'discovery') {
              setDiscoveredDrones(prev => {
                  if (prev.find(d => d.device_id === data.data.device_id)) return prev;
                  return [...prev, data.data];
              });
            } else if (data.type === 'drone_deleted') {
              setDrones(prev => {
                  const newDrones = { ...prev };
                  delete newDrones[data.message.id];
                  return newDrones;
              });
            }
          } catch (err) {
            console.error("❌ [WS] Message parsing error:", err);
          }
        };

        socket.onclose = (e) => {
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

  const sendCommand = (droneId, command, params = {}) => {
    const token = localStorage.getItem('token');
    const hostname = window.location.hostname;
    
    fetch(`http://${hostname}:8000/api/drones/command/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": token ? `Bearer ${token}` : '',
      },
      body: JSON.stringify({
        drone_id: droneId,
        type: command, // Backend uses 'type' for command name
        params: params,
      }),
    })
    .then(res => res.json())
    .catch(err => console.error("❌ Command Failed:", err));
  };

  return { drones, discoveredDrones, setDiscoveredDrones, sendCommand, isConnected };
};
