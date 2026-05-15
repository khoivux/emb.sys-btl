import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, Tooltip, useMap } from 'react-leaflet';
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
  const droneList = Object.values(drones);
  // Default to PTIT if no drones
  const mapCenter = droneList.length > 0 
    ? [droneList[0].latitude, droneList[0].longitude] 
    : [20.980812, 105.795931];

  return (
    <div className="absolute inset-0 z-0 w-full h-full overflow-hidden">
      <style>{`
        .leaflet-container { height: 100% !important; width: 100% !important; background-color: #0c0e14 !important; }
        .leaflet-marker-icon { transition: all 0.2s linear !important; }
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
        
        {droneList.map(drone => {
            const isOnline = drone.is_active;
            
            return (
                <Marker 
                    key={drone.device_id} 
                    position={[drone.latitude, drone.longitude]}
                    icon={L.divIcon({
                        className: 'drone-marker-custom',
                        html: `
                            <svg width="50" height="50" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <g style="transform-origin: center; transform: rotate(${drone.yaw || 0}deg); transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);">
                                    <circle cx="12" cy="12" r="3" fill="white" stroke="${isOnline ? '#3B82F6' : '#64748b'}" stroke-width="2"/>
                                    <path d="M12 2L16 9H8L12 2Z" fill="#EF4444" stroke="#EF4444" stroke-width="1"/> 
                                    <path d="M4 12H9M15 12H20M12 15V20" stroke="${isOnline ? '#60A5FA' : '#475569'}" stroke-width="2" stroke-linecap="round"/>
                                    <circle cx="4" cy="12" r="1.5" fill="#1E293B" stroke="${isOnline ? '#60A5FA' : '#475569'}"/>
                                    <circle cx="20" cy="12" r="1.5" fill="#1E293B" stroke="${isOnline ? '#60A5FA' : '#475569'}"/>
                                    <circle cx="12" cy="20" r="1.5" fill="#1E293B" stroke="${isOnline ? '#60A5FA' : '#475569'}"/>
                                </g>
                            </svg>
                        `,
                        iconSize: [50, 50],
                        iconAnchor: [25, 25]
                    })}
                >
                    <Popup>
                        <div className="p-1 min-w-[150px]">
                            <div className="flex items-center gap-2 mb-1">
                                <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-slate-500'}`}></div>
                                <h3 className="font-bold text-slate-800 m-0 text-sm">{drone.name}</h3>
                            </div>
                            <p className="text-[10px] text-slate-500 m-0 font-mono mb-2">{drone.device_id}</p>
                            <div className="border-t border-slate-100 pt-2 space-y-1">
                                <div className="flex justify-between">
                                    <span className="text-[10px] text-slate-400">⚡ Pin</span>
                                    <span className="text-[10px] font-bold text-slate-700">{drone.battery}%</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-[10px] text-slate-400">📏 Độ cao</span>
                                    <span className="text-[10px] font-bold text-slate-700">{drone.altitude}m</span>
                                </div>
                                <div className="text-right mt-1">
                                    <p className="text-[9px] m-0 text-slate-400 italic">Cập nhật: {new Date(drone.timestamp * 1000).toLocaleTimeString()}</p>
                                </div>
                            </div>
                        </div>
                    </Popup>
                    <Tooltip permanent direction="top" offset={[0, -10]} opacity={0.9}>
                        <span className={`text-[10px] font-bold px-1 rounded shadow-sm ${isOnline ? 'text-blue-500 bg-white' : 'text-slate-400 bg-slate-100'}`}>
                            {drone.name}
                        </span>
                    </Tooltip>
                </Marker>
            );
        })}
      </MapContainer>
    </div>
  );
};

export default MapView;
