import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons in React Leaflet
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

// Helper component to update map view when props change
const ChangeMapView = ({ center }) => {
  const map = useMap();
  map.setView(center, map.getZoom());
  return null;
};

const MapView = ({ drones }) => {
  // Use first drone's position as center, or fallback to PTIT
  const droneList = Object.values(drones);
  const mapCenter = droneList.length > 0 
    ? [droneList[0].lat, droneList[0].lng] 
    : [20.980812, 105.795931];

  return (
    <div className="absolute inset-0 z-0 w-full h-full overflow-hidden">
      <style>{`
        .leaflet-container { height: 100% !important; width: 100% !important; background-color: #0c0e14 !important; }
        /* Hiệu ứng lướt mượt cho Marker */
        .leaflet-marker-icon {
            transition: all 0.2s linear !important;
        }
      `}</style>
      <MapContainer 
        center={mapCenter} 
        zoom={17} 
        scrollWheelZoom={true} 
        zoomControl={false}
        style={{ width: '100%', height: '100%' }}
      >
        <ChangeMapView center={mapCenter} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        
        {Object.values(drones).map((drone) => (
          <Marker 
            key={`${drone.id}-${drone.yaw || 0}`}
            position={[drone.lat, drone.lng]}
            icon={L.divIcon({
                className: 'drone-marker-custom',
                html: `
                    <svg width="50" height="50" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <g style="transform-origin: center; transform: rotate(${drone.yaw || 0}deg); transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);">
                            <!-- Thân Drone -->
                            <circle cx="12" cy="12" r="3" fill="white" stroke="#3B82F6" stroke-width="2"/>
                            <!-- Mũi Drone (Tam giác đỏ chỉ hướng) -->
                            <path d="M12 2L16 9H8L12 2Z" fill="#EF4444" stroke="#EF4444" stroke-width="1"/> 
                            <!-- Cánh Drone -->
                            <path d="M4 12H9M15 12H20M12 15V20" stroke="#60A5FA" stroke-width="2" stroke-linecap="round"/>
                            <circle cx="4" cy="12" r="1.5" fill="#1E293B" stroke="#60A5FA"/>
                            <circle cx="20" cy="12" r="1.5" fill="#1E293B" stroke="#60A5FA"/>
                            <circle cx="12" cy="20" r="1.5" fill="#1E293B" stroke="#60A5FA"/>
                        </g>
                    </svg>
                `,
                iconSize: [50, 50],
                iconAnchor: [25, 25]
            })}
          >
            <Popup>
              <div className="text-slate-900">
                <strong>{drone.id}</strong><br />
                Alt: {drone.alt}m<br />
                Bat: {drone.battery}%
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};

export default MapView;
