import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, Tooltip, Polyline, useMap, useMapEvents } from 'react-leaflet';
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
  if (center && typeof center[0] === 'number' && !isNaN(center[0]) && typeof center[1] === 'number' && !isNaN(center[1])) {
    map.setView(center, map.getZoom());
  }
  return null;
};

const MapClickHandler = ({ onMapClick }) => {
  useMapEvents({
    click(e) {
      if (onMapClick) onMapClick(e.latlng);
    }
  });
  return null;
};

const MapView = ({ drones, selectionMode = false, selectedDrones = [], onDroneSelect, ghostPositions = [], showLabels = true, targetCenter = null, onMapClick = null }) => {
  const droneList = Object.values(drones);
  
  // Filter drones that actually have valid coordinates
  const dronesWithCoords = droneList.filter(d => 
    typeof d.latitude === 'number' && !isNaN(d.latitude) &&
    typeof d.longitude === 'number' && !isNaN(d.longitude)
  );

  // Default to PTIT if no drones with valid coordinates
  const mapCenter = dronesWithCoords.length > 0 
    ? [dronesWithCoords[0].latitude, dronesWithCoords[0].longitude] 
    : [20.980812, 105.795931];

  return (
    <div className="absolute inset-0 z-0 w-full h-full overflow-hidden">
      <style>{`
        .leaflet-container { height: 100% !important; width: 100% !important; background-color: #0c0e14 !important; }
        .leaflet-marker-icon { transition: all 0.2s linear !important; }
        @keyframes pulse-ring {
          0% { box-shadow: 0 0 0 0 rgba(234, 179, 8, 0.6); }
          70% { box-shadow: 0 0 0 8px rgba(234, 179, 8, 0); }
          100% { box-shadow: 0 0 0 0 rgba(234, 179, 8, 0); }
        }
        .drone-selected { animation: pulse-ring 1.5s infinite; border-radius: 50%; }
      `}</style>
      <MapContainer 
        center={mapCenter} 
        zoom={18} 
        maxZoom={21}
        scrollWheelZoom={true} 
        zoomControl={false}
        style={{ width: '100%', height: '100%' }}
      >
        <ChangeMapView center={mapCenter} />
        <MapClickHandler onMapClick={onMapClick} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          maxZoom={21}
        />
        
        {droneList.map(drone => {
            const isOnline = drone.is_active;
            const isSelected = selectedDrones.includes(drone.device_id);
            const strokeColor = selectionMode && isSelected 
              ? '#EAB308'  // vàng khi đã chọn
              : (isOnline ? '#3B82F6' : '#64748b');
            const armColor = selectionMode && isSelected
              ? '#EAB308'
              : (isOnline ? '#60A5FA' : '#475569');
            
            // Skip rendering this marker if coordinates are invalid
            if (typeof drone.latitude !== 'number' || isNaN(drone.latitude) || 
                typeof drone.longitude !== 'number' || isNaN(drone.longitude)) {
              return null;
            }

            return (
                <Marker 
                    key={drone.device_id} 
                    position={[drone.latitude, drone.longitude]}
                    icon={L.divIcon({
                        className: `drone-marker-custom ${selectionMode && isSelected ? 'drone-selected' : ''}`,
                        html: `
                            <svg width="50" height="50" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <g style="transform-origin: center; transform: rotate(${drone.yaw || 0}deg); transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);">
                                    <circle cx="12" cy="12" r="3" fill="white" stroke="${strokeColor}" stroke-width="2"/>
                                    <path d="M12 2L16 9H8L12 2Z" fill="#EF4444" stroke="#EF4444" stroke-width="1"/> 
                                    <path d="M4 12H9M15 12H20M12 15V20" stroke="${armColor}" stroke-width="2" stroke-linecap="round"/>
                                    <circle cx="4" cy="12" r="1.5" fill="#1E293B" stroke="${armColor}"/>
                                    <circle cx="20" cy="12" r="1.5" fill="#1E293B" stroke="${armColor}"/>
                                    <circle cx="12" cy="20" r="1.5" fill="#1E293B" stroke="${armColor}"/>
                                </g>
                            </svg>
                        `,
                        iconSize: [50, 50],
                        iconAnchor: [25, 25]
                    })}
                    eventHandlers={selectionMode ? {
                      click: (e) => {
                        // Trong chế độ chọn drone, click → toggle chọn/bỏ chọn
                        if (isOnline && onDroneSelect) {
                          onDroneSelect(drone.device_id);
                        }
                        // Ngăn mở popup
                        e.target.closePopup();
                      }
                    } : {}}
                >
                    {/* Chỉ hiển thị popup khi KHÔNG ở chế độ chọn */}
                    {!selectionMode && (
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
                    )}
                    {showLabels && (
                      <Tooltip permanent direction="top" offset={[0, -10]} opacity={0.9}>
                          <span className={`text-[10px] font-bold px-1 rounded shadow-sm ${
                            selectionMode && isSelected
                              ? 'text-yellow-600 bg-yellow-50 ring-1 ring-yellow-400'
                              : (isOnline ? 'text-blue-500 bg-white' : 'text-slate-400 bg-slate-100')
                          }`}>
                              {selectionMode && isSelected ? '✓ ' : ''}{drone.name}
                          </span>
                      </Tooltip>
                    )}
                </Marker>
            );
        })}

        {/* Ghost markers — vị trí đích dự kiến */}
        {ghostPositions.map(ghost => {
          const drone = drones[ghost.droneId];
          if (!drone) return null;
          
          return (
            <React.Fragment key={`ghost-${ghost.droneId}`}>
              {/* Đường nét đứt nối vị trí hiện tại → vị trí đích */}
              <Polyline
                positions={[
                  [drone.latitude, drone.longitude],
                  [ghost.targetLat, ghost.targetLng],
                ]}
                pathOptions={{
                  color: '#EAB308',
                  weight: 2,
                  opacity: 0.6,
                  dashArray: '8 6',
                }}
              />
              {/* Ghost marker (marker mờ tại vị trí đích) */}
              <Marker
                position={[ghost.targetLat, ghost.targetLng]}
                icon={L.divIcon({
                  className: 'ghost-marker',
                  html: `
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="opacity: 0.4;">
                      <circle cx="12" cy="12" r="6" fill="none" stroke="#EAB308" stroke-width="2" stroke-dasharray="3 2"/>
                      <circle cx="12" cy="12" r="2" fill="#EAB308"/>
                    </svg>
                  `,
                  iconSize: [40, 40],
                  iconAnchor: [20, 20],
                })}
              >
                {showLabels && (
                  <Tooltip direction="bottom" offset={[0, 10]} opacity={0.8}>
                    <span className="text-[9px] text-yellow-600 bg-yellow-50 px-1 rounded">
                      🎯 Đích: {drone.name}
                    </span>
                  </Tooltip>
                )}
              </Marker>
            </React.Fragment>
          );
        })}

        {/* Target Center Marker */}
        {targetCenter && selectionMode && (
          <Marker
            position={[targetCenter.lat, targetCenter.lng]}
            icon={L.divIcon({
              className: 'target-center-marker animate-bounce',
              html: `
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="#EF4444"/>
                </svg>
              `,
              iconSize: [32, 32],
              iconAnchor: [16, 32],
            })}
          >
            <Tooltip direction="top" offset={[0, -32]} permanent>
              <span className="text-xs font-bold text-red-500">Tâm đội hình</span>
            </Tooltip>
          </Marker>
        )}
      </MapContainer>

    </div>
  );
};

export default MapView;
