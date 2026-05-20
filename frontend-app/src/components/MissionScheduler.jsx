import React, { useState, useCallback } from 'react';
import {
  Clock, X, ChevronRight, ChevronLeft, CheckCircle2,
  MapPin, CalendarClock, Rocket, RotateCcw, Trash2
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// ─── Target Pin Picker ────────────────────────────────────────────────────────
const TargetPickerMap = ({ position, onPick }) => {
  useMapEvents({
    click(e) { onPick(e.latlng); }
  });
  return position ? (
    <Marker
      position={[position.lat, position.lng]}
      icon={L.divIcon({
        className: '',
        html: `<svg width="28" height="36" viewBox="0 0 24 32" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 0C7.58 0 4 3.58 4 8c0 6 8 16 8 16s8-10 8-16c0-4.42-3.58-8-8-8z" fill="#EF4444"/>
          <circle cx="12" cy="8" r="3" fill="white"/>
        </svg>`,
        iconSize: [28, 36],
        iconAnchor: [14, 36],
      })}
    />
  ) : null;
};

// ─── Tiny inline map for picking a point ──────────────────────────────────────
const PointPickerMap = ({ position, onPick }) => (
  <MapContainer
    center={position ? [position.lat, position.lng] : [20.980812, 105.795931]}
    zoom={17}
    scrollWheelZoom
    zoomControl={false}
    style={{ width: '100%', height: '200px', borderRadius: '12px' }}
  >
    <TileLayer
      url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      maxZoom={21}
    />
    <TargetPickerMap position={position} onPick={onPick} />
  </MapContainer>
);

// ─── Main Component ────────────────────────────────────────────────────────────
const MissionScheduler = ({ drones, onClose, token, mapClickEvent, onGhostPositions }) => {
  const [step, setStep] = useState(1); // 1: Chọn Drone | 2: Chọn điểm đích | 3: Cài giờ & Xác nhận

  // Step 1: danh sách drone được chọn (array of device_id)
  const [selectedDroneIds, setSelectedDroneIds] = useState([]);

  // Step 2: map drone_id → {lat, lng}
  const [targets, setTargets] = useState({}); // { drone_id: {lat, lng} | null }
  const [activeDroneForPicking, setActiveDroneForPicking] = useState(null);

  // Step 3: giờ bay
  const [executeAt, setExecuteAt] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null); // {ok, message}

  const droneList = Object.values(drones);
  const onlineDrones = droneList.filter(d => d.is_active);

  // ── Step 1 helpers ──
  const toggleDrone = (id) =>
    setSelectedDroneIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );

  // ── Step 2 helpers ──
  const handlePickPoint = useCallback((latlng) => {
    if (!activeDroneForPicking) return;
    setTargets(prev => ({ ...prev, [activeDroneForPicking]: { lat: latlng.lat, lng: latlng.lng } }));
  }, [activeDroneForPicking]);

  // Listen to clicks from the main map
  React.useEffect(() => {
    if (mapClickEvent && activeDroneForPicking) {
      handlePickPoint(mapClickEvent);
    }
  }, [mapClickEvent]);

  // Pass ghost positions up to the main map
  React.useEffect(() => {
    if (step >= 2 && onGhostPositions) {
      const ghosts = selectedDroneIds
        .filter(id => targets[id])
        .map(id => ({
          droneId: id,
          targetLat: targets[id].lat,
          targetLng: targets[id].lng
        }));
      onGhostPositions(ghosts);
    } else if (step === 1 && onGhostPositions) {
      onGhostPositions([]);
    }
  }, [targets, step, selectedDroneIds, onGhostPositions]);

  const allTargetsPicked = selectedDroneIds.every(id => targets[id]);

  // ── Step 3 helpers ──
  const handleSubmit = async () => {
    setSubmitting(true);
    const payload = {
      targets: selectedDroneIds.map(id => ({
        drone_id: id,
        lat: targets[id].lat,
        lng: targets[id].lng,
      })),
      execute_at: new Date(executeAt).toISOString(),
    };
    try {
      const hostname = window.location.hostname;
      const res = await fetch(`http://${hostname}:8000/api/drones/scheduled_missions/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        setResult({ ok: true, message: `✅ Đã lên lịch bay #${data.id} thành công! Drone sẽ bay lúc ${new Date(data.execute_at).toLocaleString('vi-VN')}.` });
      } else {
        setResult({ ok: false, message: `❌ Lỗi: ${data.error || JSON.stringify(data)}` });
      }
    } catch (e) {
      setResult({ ok: false, message: `❌ Lỗi kết nối: ${e.message}` });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Min datetime for time picker (now + 30s) ──
  const minDatetime = new Date(Date.now() + 30000).toISOString().slice(0, 16);

  // ===================== RENDER =====================
  const stepTitles = ['Chọn Drone', 'Chọn Điểm Đích', 'Cài Giờ Bay'];

  return (
    <div className="absolute top-4 left-4 z-30 w-96 max-h-[calc(100vh-120px)] flex flex-col bg-slate-900/95 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl text-white overflow-hidden">

      {/* Header */}
      <div className="p-4 border-b border-white/5 flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <CalendarClock size={16} className="text-purple-400" />
            Đặt Lịch Bay
          </h2>
          <p className="text-[10px] text-slate-500 mt-0.5">Bước {step}/3 — {stepTitles[step - 1]}</p>
        </div>
        <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors" title="Đóng">
          <X size={18} className="text-slate-400" />
        </button>
      </div>

      {/* Progress Bar */}
      <div className="h-1 bg-slate-800 shrink-0">
        <div className="h-full bg-gradient-to-r from-purple-500 to-pink-400 transition-all duration-500" style={{ width: `${(step / 3) * 100}%` }} />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">

        {/* ── Step 1: Chọn Drone ── */}
        {step === 1 && (
          <div className="space-y-2">
            <p className="text-[10px] text-slate-500 mb-3">Chọn các Drone cần lên lịch. Chỉ drone Online mới khả dụng.</p>
            {droneList.length === 0 && (
              <div className="text-center py-8 text-slate-500 text-sm">Chưa có drone nào kết nối</div>
            )}
            {droneList.map(drone => {
              const isOnline = drone.is_active;
              const isChecked = selectedDroneIds.includes(drone.device_id);
              return (
                <button
                  key={drone.device_id}
                  onClick={() => isOnline && toggleDrone(drone.device_id)}
                  disabled={!isOnline}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                    isChecked
                      ? 'bg-purple-600/10 border-purple-500/40'
                      : isOnline
                        ? 'bg-slate-800/50 border-white/5 hover:bg-slate-800 hover:border-white/10'
                        : 'bg-slate-800/20 border-white/5 opacity-40 cursor-not-allowed'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${isChecked ? 'bg-purple-500 border-purple-500' : 'border-slate-600'}`}>
                    {isChecked && <CheckCircle2 size={14} className="text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{drone.name}</span>
                      <div className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-green-500' : 'bg-slate-600'}`} />
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">{drone.device_id}</span>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`text-xs font-bold ${drone.battery < 20 ? 'text-red-400' : 'text-green-400'}`}>
                      {drone.battery ?? '—'}%
                    </div>
                    <div className="text-[9px] text-slate-500">{isOnline ? 'Online' : 'Offline'}</div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* ── Step 2: Chọn điểm đích cho từng drone ── */}
        {step === 2 && (
          <div className="space-y-3">
            <p className="text-[10px] text-slate-500">
              Chọn từng Drone rồi click vào bản đồ nhỏ bên dưới để đặt điểm đích riêng.
            </p>
            {/* Danh sách drone để chọn active */}
            <div className="flex flex-wrap gap-1.5">
              {selectedDroneIds.map(id => {
                const drone = drones[id];
                const picked = !!targets[id];
                const isActive = activeDroneForPicking === id;
                return (
                  <button
                    key={id}
                    onClick={() => setActiveDroneForPicking(isActive ? null : id)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-purple-600 border-purple-500 text-white'
                        : picked
                          ? 'bg-green-600/20 border-green-500/40 text-green-300'
                          : 'bg-slate-700/50 border-white/10 text-slate-400 hover:bg-slate-700'
                    }`}
                  >
                    {picked ? <CheckCircle2 size={12} className={isActive ? 'text-white' : 'text-green-400'} /> : <MapPin size={12} />}
                    {drone?.name || id}
                  </button>
                );
              })}
            </div>

            {/* Nhập tay tọa độ hoặc click map */}
            <div className="relative rounded-xl overflow-hidden border border-white/10 bg-slate-800/50 p-3">
              {activeDroneForPicking ? (
                <div className="space-y-3">
                  <p className="text-purple-300 text-xs text-center">
                    👉 Click vào <b>Bản đồ lớn</b> để ghim đích cho <strong>{drones[activeDroneForPicking]?.name}</strong>
                  </p>
                  <div className="pt-2 border-t border-white/10">
                    <p className="text-[10px] text-slate-400 mb-1.5">Hoặc nhập tay tọa độ (Lat, Lng):</p>
                    <div className="flex gap-2">
                      <input 
                        type="number" step="any" placeholder="Latitude (Vĩ độ)"
                        value={targets[activeDroneForPicking]?.lat !== undefined ? targets[activeDroneForPicking].lat : ''}
                        onChange={e => {
                          const val = e.target.value;
                          setTargets(prev => ({
                            ...prev,
                            [activeDroneForPicking]: { lat: val === '' ? 0 : parseFloat(val), lng: prev[activeDroneForPicking]?.lng || 0 }
                          }));
                        }}
                        className="w-1/2 bg-slate-900/80 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-purple-500 transition-colors"
                      />
                      <input 
                        type="number" step="any" placeholder="Longitude (Kinh độ)"
                        value={targets[activeDroneForPicking]?.lng !== undefined ? targets[activeDroneForPicking].lng : ''}
                        onChange={e => {
                          const val = e.target.value;
                          setTargets(prev => ({
                            ...prev,
                            [activeDroneForPicking]: { lat: prev[activeDroneForPicking]?.lat || 0, lng: val === '' ? 0 : parseFloat(val) }
                          }));
                        }}
                        className="w-1/2 bg-slate-900/80 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-purple-500 transition-colors"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-slate-500 text-xs text-center py-2">
                  👆 Chọn một drone ở trên để bắt đầu chọn điểm đích.
                </p>
              )}
            </div>

            {/* Tóm tắt các điểm đã chọn */}
            <div className="space-y-1">
              {selectedDroneIds.map(id => {
                const drone = drones[id];
                const t = targets[id];
                return (
                  <div key={id} className={`flex items-center justify-between py-1.5 px-2.5 rounded-lg text-[10px] ${t ? 'bg-green-900/20 border border-green-500/20' : 'bg-slate-800/30 border border-white/5'}`}>
                    <span className="text-slate-300 font-medium">{drone?.name || id}</span>
                    {t ? (
                      <div className="flex items-center gap-2">
                        <span className="text-green-400 font-mono">{t.lat.toFixed(5)}, {t.lng.toFixed(5)}</span>
                        <button onClick={() => setTargets(p => ({ ...p, [id]: null }))} className="text-slate-500 hover:text-red-400 transition-colors">
                          <Trash2 size={11} />
                        </button>
                      </div>
                    ) : (
                      <span className="text-slate-500 italic">Chưa chọn</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Step 3: Cài giờ bay ── */}
        {step === 3 && (
          <div className="space-y-4">
            {/* Tóm tắt */}
            <div className="p-3 bg-slate-800/50 rounded-xl border border-white/5 space-y-2">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tóm tắt nhiệm vụ</h4>
              <div className="space-y-1">
                {selectedDroneIds.map(id => {
                  const t = targets[id];
                  return (
                    <div key={id} className="flex items-center justify-between text-[10px]">
                      <span className="text-slate-300">{drones[id]?.name || id}</span>
                      <span className="text-yellow-400 font-mono">{t?.lat.toFixed(5)}, {t?.lng.toFixed(5)}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Time picker */}
            <div>
              <label className="text-xs text-slate-400 font-medium block mb-2 flex items-center gap-1.5">
                <Clock size={13} className="text-purple-400" />
                Thời gian bắt đầu bay
              </label>
              <input
                type="datetime-local"
                min={minDatetime}
                value={executeAt}
                onChange={e => setExecuteAt(e.target.value)}
                className="w-full bg-slate-700/50 border border-white/10 rounded-xl px-3 py-3 text-sm text-white focus:outline-none focus:border-purple-500 transition-colors"
              />
              {executeAt && (
                <p className="text-[10px] text-slate-500 mt-1.5">
                  Drone sẽ tự động bay vào:{' '}
                  <span className="text-purple-300 font-medium">
                    {new Date(executeAt).toLocaleString('vi-VN')}
                  </span>
                </p>
              )}
            </div>

            {/* Result message */}
            {result && (
              <div className={`p-3 rounded-xl border text-xs font-medium ${result.ok ? 'bg-green-900/20 border-green-500/30 text-green-300' : 'bg-red-900/20 border-red-500/30 text-red-300'}`}>
                {result.message}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-white/5 flex items-center justify-between shrink-0">
        {step === 1 ? (
          <button onClick={onClose} className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition-colors">
            <X size={14} /> Đóng
          </button>
        ) : (
          <button onClick={() => { setResult(null); setStep(s => s - 1); }} className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition-colors">
            <ChevronLeft size={14} /> Quay lại
          </button>
        )}

        {step === 1 && (
          <button
            onClick={() => { setTargets({}); setActiveDroneForPicking(selectedDroneIds[0] || null); setStep(2); }}
            disabled={selectedDroneIds.length === 0}
            className={`flex items-center gap-1 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              selectedDroneIds.length > 0 ? 'bg-purple-600 hover:bg-purple-500 text-white' : 'bg-slate-700 text-slate-500 cursor-not-allowed'
            }`}
          >
            Tiếp <ChevronRight size={14} />
          </button>
        )}
        {step === 2 && (
          <button
            onClick={() => setStep(3)}
            disabled={!allTargetsPicked}
            className={`flex items-center gap-1 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              allTargetsPicked ? 'bg-purple-600 hover:bg-purple-500 text-white' : 'bg-slate-700 text-slate-500 cursor-not-allowed'
            }`}
          >
            Đặt giờ <ChevronRight size={14} />
          </button>
        )}
        {step === 3 && !result?.ok && (
          <button
            onClick={handleSubmit}
            disabled={!executeAt || submitting}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
              submitting
                ? 'bg-purple-600/50 text-purple-200 cursor-wait'
                : !executeAt
                  ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-500 hover:to-pink-400 text-white shadow-lg shadow-purple-900/30'
            }`}
          >
            {submitting ? (
              <><RotateCcw size={14} className="animate-spin" /> Đang lưu...</>
            ) : (
              <><Rocket size={14} /> Lên lịch bay</>
            )}
          </button>
        )}
        {step === 3 && result?.ok && (
          <button
            onClick={() => {
              if (onGhostPositions) onGhostPositions([]);
              onClose();
            }}
            className="flex items-center gap-1 px-4 py-2 rounded-xl text-xs font-bold bg-green-600 hover:bg-green-500 text-white transition-all"
          >
            <CheckCircle2 size={14} /> Hoàn tất
          </button>
        )}
      </div>
    </div>
  );
};

export default MissionScheduler;
