import { useState, useEffect, useRef } from 'react';

export const useDroneSocket = () => {
  const [drones, setDrones] = useState({});
  const socketRef = useRef(null);

  useEffect(() => {
    // Connect to Django Channels WebSocket
    const socketUrl = `ws://${window.location.hostname}:8000/ws/drones/`;
    socketRef.current = new WebSocket(socketUrl);

    socketRef.current.onopen = () => {
      console.log("Connected to Drone WebSocket Gateway");
    };

    socketRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log("📡 Nhận dữ liệu Drone:", data);
      if (data.type === 'telemetry') {
        const droneData = data.data;
        setDrones((prev) => ({
          ...prev,
          [droneData.id]: droneData,
        }));
      }
    };

    socketRef.current.onclose = () => {
      console.log("Disconnected from Drone WebSocket Gateway");
    };

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, []);

  const sendCommand = (droneId, command, params = {}) => {
    // In this architecture, commands are sent via REST API to Django,
    // which then publishes to MQTT. But for some cases, we might use WS.
    // Let's use fetch for commands as per plan.
    fetch(`http://${window.location.hostname}:8000/api/drones/command/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ drone_id: droneId, command, ...params }),
    }).catch(err => console.error("Command failed:", err));
  };

  return { drones, sendCommand };
};
