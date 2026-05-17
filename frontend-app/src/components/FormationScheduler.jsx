import React, { useState, useMemo } from 'react';
import { ChevronRight, ChevronLeft, X, CheckCircle2, Rocket, Users, LayoutGrid, Type, Circle, Minus, RotateCcw } from 'lucide-react';
import {
  FORMATION_PATTERNS,
  lineFormation,
  circleFormation,
  gridFormation,
  textFormation,
  getTextMinDrones,
} from '../utils/FormationPatterns.js';

const FormationScheduler = ({ drones, selectedDrones, onDroneSelect, onCancel, onGhostPositions, onExecute }) => {
  const [step, setStep] = useState(1);
  const [selectedPattern, setSelectedPattern] = useState(null);
  const [patternConfig, setPatternConfig] = useState({});
  const [executing, setExecuting] = useState(false);

  const droneList = Object.values(drones);
  const onlineDrones = droneList.filter(d => d.is_active);
  const selectedDroneObjects = droneList.filter(d => selectedDrones.includes(d.device_id));

  // ---------- Step 1 helpers ----------
  const selectAll = () => {
    onlineDrones.forEach(d => {
      if (!selectedDrones.includes(d.device_id)) onDroneSelect(d.device_id);
    });
  };
  const deselectAll = () => {
    selectedDrones.forEach(id => onDroneSelect(id));
  };

  // ---------- Step 2 helpers ----------
  const patternIcons = {
    line: <Minus size={28} />,
    circle: <Circle size={28} />,
    grid: <LayoutGrid size={28} />,
    text: <Type size={28} />,
  };

  const getMinDronesForPattern = (pattern) => {
    if (pattern.id === 'text') {
      const txt = patternConfig.text || '';
      return txt.length > 0 ? getTextMinDrones(txt) : 1;
    }
    return pattern.minDrones;
  };

  const isPatternDisabled = (pattern) => {
    if (pattern.id === 'text') return false; // chờ user nhập text rồi mới check
    return selectedDrones.length < pattern.minDrones;
  };

  // Cấu hình mặc định cho mỗi pattern
  const getDefaultConfig = (patternId) => {
    switch (patternId) {
      case 'line': return { direction: 'horizontal', spacing: 10 };
      case 'circle': return { radius: 20 };
      case 'grid': return { columns: 3, spacing: 10 };
      case 'text': return { text: 'A', scale: 5 };
      default: return {};
    }
  };

  // ---------- Step 3: tính tọa độ ----------
  const computedPositions = useMemo(() => {
    if (step !== 3 || !selectedPattern) return [];

    // Safely filter drones with valid coordinates first
    const validDrones = selectedDroneObjects.filter(d =>
      typeof d.latitude === 'number' && !isNaN(d.latitude) &&
      typeof d.longitude === 'number' && !isNaN(d.longitude)
    );

    const avgLat = validDrones.length > 0
      ? validDrones.reduce((s, d) => s + d.latitude, 0) / validDrones.length
      : 20.980812;
    const avgLng = validDrones.length > 0
      ? validDrones.reduce((s, d) => s + d.longitude, 0) / validDrones.length
      : 105.795931;

    switch (selectedPattern) {
      case 'line':
        return lineFormation(selectedDroneObjects, avgLat, avgLng, patternConfig.direction || 'horizontal', patternConfig.spacing || 10);
      case 'circle':
        return circleFormation(selectedDroneObjects, avgLat, avgLng, patternConfig.radius || 20);
      case 'grid':
        return gridFormation(selectedDroneObjects, avgLat, avgLng, patternConfig.columns || 3, patternConfig.spacing || 10);
      case 'text': {
        const result = textFormation(selectedDroneObjects, patternConfig.text || 'A', avgLat, avgLng, patternConfig.scale || 5);
        return result.positions;
      }
      default:
        return [];
    }
  }, [step, selectedPattern, patternConfig, selectedDroneObjects]);

  // Sơ đồ mô phỏng trực quan các vị trí tương lai
  const visualPreviewSvg = useMemo(() => {
    if (step !== 3 || computedPositions.length === 0) return null;

    const lats = computedPositions.map(p => p.targetLat);
    const lngs = computedPositions.map(p => p.targetLng);

    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    const latSpan = maxLat - minLat;
    const lngSpan = maxLng - minLng;

    const width = 320;
    const height = 180;
    const padding = 25;

    const points = computedPositions.map(p => {
      const drone = drones[p.droneId];
      // Bản đồ hệ tọa độ SVG (vĩ độ Lat tăng về phía Bắc -> Y giảm trong SVG)
      const y = latSpan === 0
        ? height / 2
        : padding + (1 - (p.targetLat - minLat) / latSpan) * (height - 2 * padding);

      // Bản đồ kinh độ Lng tăng về phía Đông -> X tăng trong SVG
      const x = lngSpan === 0
        ? width / 2
        : padding + ((p.targetLng - minLng) / lngSpan) * (width - 2 * padding);

      return {
        id: p.droneId,
        name: drone?.name || p.droneId,
        x,
        y
      };
    });

    return (
      <div className="bg-slate-950/80 border border-white/5 rounded-xl p-3 flex flex-col items-center justify-center relative overflow-hidden my-3">
        <div className="absolute top-2 left-3 text-[9px] uppercase tracking-wider text-slate-500 font-bold">
          Sơ đồ mô phỏng đội hình xếp chữ
        </div>
        <svg width="100%" height="180" viewBox={`0 0 ${width} ${height}`} className="mt-2">
          {/* Grid lines */}
          <line x1="0" y1={height / 2} x2={width} y2={height / 2} stroke="rgba(255,255,255,0.03)" strokeDasharray="4" />
          <line x1={width / 2} y1="0" x2={width / 2} y2={height} stroke="rgba(255,255,255,0.03)" strokeDasharray="4" />

          {/* Draw connections based on pattern */}
          {selectedPattern === 'line' && points.length > 1 && (
            <line
              x1={points[0].x} y1={points[0].y}
              x2={points[points.length - 1].x} y2={points[points.length - 1].y}
              stroke="rgba(59, 130, 246, 0.4)" strokeWidth="1.5" strokeDasharray="3"
            />
          )}

          {selectedPattern === 'circle' && points.length > 2 && (() => {
            const cx = points.reduce((sum, p) => sum + p.x, 0) / points.length;
            const cy = points.reduce((sum, p) => sum + p.y, 0) / points.length;
            const rx = Math.max(...points.map(p => Math.sqrt((p.x - cx) ** 2 + (p.y - cy) ** 2)));
            return (
              <circle cx={cx} cy={cy} r={rx} fill="none" stroke="rgba(59, 130, 246, 0.3)" strokeWidth="1.5" strokeDasharray="3" />
            );
          })()}

          {/* Draw drone positions */}
          {points.map(p => (
            <g key={p.id}>
              {/* Pulse effect */}
              <circle cx={p.x} cy={p.y} r="8" fill="rgba(59, 130, 246, 0.2)" className="animate-pulse" />
              <circle cx={p.x} cy={p.y} r="4.5" fill="#3B82F6" stroke="#fff" strokeWidth="1.5" />

              {/* Drone Labels */}
              <text
                x={p.x}
                y={p.y - 8}
                fill="#38BDF8"
                fontSize="8"
                fontWeight="bold"
                textAnchor="middle"
                className="select-none pointer-events-none"
              >
                {p.name.replace("mock_", "")}
              </text>
            </g>
          ))}
        </svg>
      </div>
    );
  }, [step, computedPositions, selectedPattern, drones]);

  // Gửi ghost positions lên MapView khi vào step 3
  React.useEffect(() => {
    if (step === 3 && computedPositions.length > 0) {
      onGhostPositions(computedPositions);
    } else {
      onGhostPositions([]);
    }
  }, [computedPositions, step]);

  // ---------- Validation ----------
  const canGoStep2 = selectedDrones.length >= 2;
  const canGoStep3 = selectedPattern != null && (() => {
    if (selectedPattern === 'text') {
      const txt = patternConfig.text || '';
      const minNeeded = getTextMinDrones(txt);
      return txt.length > 0 && selectedDrones.length >= minNeeded;
    }
    return true;
  })();

  const handleExecute = async () => {
    setExecuting(true);
    try {
      await onExecute(computedPositions);
    } finally {
      setExecuting(false);
    }
  };

  // ===================== RENDER =====================

  const stepTitles = ['Chọn Drone', 'Chọn Đội hình', 'Preview & Xác nhận'];

  return (
    <div className="absolute top-4 left-4 z-30 w-96 max-h-[calc(100vh-120px)] flex flex-col bg-slate-900/90 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl text-white overflow-hidden">

      {/* Header */}
      <div className="p-4 border-b border-white/5 flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Users size={16} className="text-blue-400" />
            Lên lịch đội hình
          </h2>
          <p className="text-[10px] text-slate-500 mt-0.5">Bước {step}/3 — {stepTitles[step - 1]}</p>
        </div>
        <button onClick={onCancel} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors" title="Hủy">
          <X size={18} className="text-slate-400" />
        </button>
      </div>

      {/* Progress Bar */}
      <div className="h-1 bg-slate-800 shrink-0">
        <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-500" style={{ width: `${(step / 3) * 100}%` }} />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">

        {/* ========== STEP 1 — Chọn Drone ========== */}
        {step === 1 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">
                Đã chọn: <span className="text-blue-400 font-bold">{selectedDrones.length}</span> / {onlineDrones.length} online
              </span>
              <div className="flex gap-1">
                <button onClick={selectAll} className="text-[10px] px-2 py-1 bg-blue-600/20 text-blue-400 rounded-md hover:bg-blue-600/30 transition-colors">
                  Chọn tất cả
                </button>
                <button onClick={deselectAll} className="text-[10px] px-2 py-1 bg-slate-700/50 text-slate-400 rounded-md hover:bg-slate-700 transition-colors">
                  Bỏ chọn
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              {droneList.map(drone => {
                const isOnline = drone.is_active;
                const isChecked = selectedDrones.includes(drone.device_id);
                return (
                  <button
                    key={drone.device_id}
                    onClick={() => isOnline && onDroneSelect(drone.device_id)}
                    disabled={!isOnline}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${isChecked
                        ? 'bg-blue-600/10 border-blue-500/30'
                        : isOnline
                          ? 'bg-slate-800/50 border-white/5 hover:bg-slate-800 hover:border-white/10'
                          : 'bg-slate-800/20 border-white/5 opacity-40 cursor-not-allowed'
                      }`}
                  >
                    {/* Checkbox */}
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${isChecked ? 'bg-blue-500 border-blue-500' : 'border-slate-600'
                      }`}>
                      {isChecked && <CheckCircle2 size={14} className="text-white" />}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{drone.name}</span>
                        <div className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-green-500' : 'bg-slate-600'}`} />
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono">{drone.device_id}</span>
                    </div>

                    {/* Battery */}
                    <div className="text-right shrink-0">
                      <div className={`text-xs font-bold ${drone.battery < 20 ? 'text-red-400' : 'text-green-400'}`}>
                        {drone.battery ?? '—'}%
                      </div>
                      <div className="text-[9px] text-slate-500">{isOnline ? 'Online' : 'Offline'}</div>
                    </div>
                  </button>
                );
              })}
              {droneList.length === 0 && (
                <div className="text-center py-8 text-slate-500 text-sm">
                  Chưa có drone nào kết nối
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========== STEP 2 — Chọn đội hình ========== */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {FORMATION_PATTERNS.map(pattern => {
                const disabled = isPatternDisabled(pattern);
                const selected = selectedPattern === pattern.id;
                return (
                  <button
                    key={pattern.id}
                    onClick={() => {
                      if (disabled) return;
                      setSelectedPattern(pattern.id);
                      setPatternConfig(getDefaultConfig(pattern.id));
                    }}
                    disabled={disabled}
                    className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 text-center ${selected
                        ? 'bg-blue-600/20 border-blue-500 ring-1 ring-blue-500/30'
                        : disabled
                          ? 'bg-slate-800/20 border-white/5 opacity-30 cursor-not-allowed'
                          : 'bg-slate-800/50 border-white/5 hover:bg-slate-800 hover:border-white/10 cursor-pointer'
                      }`}
                  >
                    <div className={`text-2xl ${selected ? 'text-blue-400' : 'text-slate-400'}`}>
                      {patternIcons[pattern.id]}
                    </div>
                    <span className="text-xs font-semibold">{pattern.name}</span>
                    <span className="text-[9px] text-slate-500">
                      {pattern.minDrones ? `Tối thiểu ${pattern.minDrones} drone` : 'Tùy ký tự'}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Form cấu hình tham số */}
            {selectedPattern && (
              <div className="mt-3 p-3 bg-slate-800/50 rounded-xl border border-white/5 space-y-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Cấu hình</h4>

                {selectedPattern === 'line' && (
                  <>
                    <div>
                      <label className="text-[10px] text-slate-500 block mb-1">Hướng</label>
                      <div className="flex gap-2">
                        {['horizontal', 'vertical'].map(dir => (
                          <button
                            key={dir}
                            onClick={() => setPatternConfig(c => ({ ...c, direction: dir }))}
                            className={`flex-1 py-2 text-xs rounded-lg border transition-colors ${patternConfig.direction === dir
                                ? 'bg-blue-600/20 border-blue-500 text-blue-400'
                                : 'bg-slate-700/30 border-white/5 text-slate-400 hover:bg-slate-700/50'
                              }`}
                          >
                            {dir === 'horizontal' ? 'Ngang' : 'Dọc'}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 block mb-1">Khoảng cách (m)</label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={patternConfig.spacing || 10}
                        onChange={e => setPatternConfig(c => ({ ...c, spacing: Number(e.target.value) }))}
                        className="w-full bg-slate-700/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </>
                )}

                {selectedPattern === 'circle' && (
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-1">Bán kính (m)</label>
                    <input
                      type="number"
                      min="5"
                      max="200"
                      value={patternConfig.radius || 20}
                      onChange={e => setPatternConfig(c => ({ ...c, radius: Number(e.target.value) }))}
                      className="w-full bg-slate-700/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                )}

                {selectedPattern === 'grid' && (
                  <>
                    <div>
                      <label className="text-[10px] text-slate-500 block mb-1">Số cột</label>
                      <input
                        type="number"
                        min="2"
                        max="10"
                        value={patternConfig.columns || 3}
                        onChange={e => setPatternConfig(c => ({ ...c, columns: Number(e.target.value) }))}
                        className="w-full bg-slate-700/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 block mb-1">Khoảng cách (m)</label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={patternConfig.spacing || 10}
                        onChange={e => setPatternConfig(c => ({ ...c, spacing: Number(e.target.value) }))}
                        className="w-full bg-slate-700/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </>
                )}

                {selectedPattern === 'text' && (
                  <>
                    <div>
                      <label className="text-[10px] text-slate-500 block mb-1">Ký tự cần xếp (A-Z, 0-9)</label>
                      <input
                        type="text"
                        maxLength="3"
                        value={patternConfig.text || ''}
                        onChange={e => setPatternConfig(c => ({ ...c, text: e.target.value.toUpperCase() }))}
                        placeholder="VD: A"
                        className="w-full bg-slate-700/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 uppercase"
                      />
                      {patternConfig.text && (
                        <p className="text-[10px] text-slate-500 mt-1">
                          Cần tối thiểu <span className="text-yellow-400 font-bold">{getTextMinDrones(patternConfig.text)}</span> drone
                          {selectedDrones.length < getTextMinDrones(patternConfig.text) && (
                            <span className="text-red-400 ml-1">
                              (thiếu {getTextMinDrones(patternConfig.text) - selectedDrones.length})
                            </span>
                          )}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 block mb-1">Kích thước pixel (m)</label>
                      <input
                        type="number"
                        min="1"
                        max="50"
                        value={patternConfig.scale || 5}
                        onChange={e => setPatternConfig(c => ({ ...c, scale: Number(e.target.value) }))}
                        className="w-full bg-slate-700/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* ========== STEP 3 — Preview & Xác nhận ========== */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="p-3 bg-slate-800/50 rounded-xl border border-white/5 space-y-2">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tóm tắt</h4>
              <div className="grid grid-cols-2 gap-y-2 text-xs">
                <span className="text-slate-500">Số drone:</span>
                <span className="text-white font-bold">{selectedDrones.length}</span>
                <span className="text-slate-500">Đội hình:</span>
                <span className="text-blue-400 font-bold">
                  {FORMATION_PATTERNS.find(p => p.id === selectedPattern)?.name}
                </span>
                {selectedPattern === 'line' && (
                  <>
                    <span className="text-slate-500">Hướng:</span>
                    <span className="text-white">{patternConfig.direction === 'horizontal' ? 'Ngang' : 'Dọc'}</span>
                    <span className="text-slate-500">Khoảng cách:</span>
                    <span className="text-white">{patternConfig.spacing}m</span>
                  </>
                )}
                {selectedPattern === 'circle' && (
                  <>
                    <span className="text-slate-500">Bán kính:</span>
                    <span className="text-white">{patternConfig.radius}m</span>
                  </>
                )}
                {selectedPattern === 'grid' && (
                  <>
                    <span className="text-slate-500">Số cột:</span>
                    <span className="text-white">{patternConfig.columns}</span>
                    <span className="text-slate-500">Khoảng cách:</span>
                    <span className="text-white">{patternConfig.spacing}m</span>
                  </>
                )}
                {selectedPattern === 'text' && (
                  <>
                    <span className="text-slate-500">Ký tự:</span>
                    <span className="text-white font-mono">{patternConfig.text}</span>
                    <span className="text-slate-500">Kích thước:</span>
                    <span className="text-white">{patternConfig.scale}m/px</span>
                  </>
                )}
              </div>
            </div>

            {/* Sơ đồ mô phỏng trực quan */}
            {visualPreviewSvg}

            {/* Danh sách vị trí đích */}
            <div className="space-y-1">
              <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Vị trí đích</h4>
              <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                {computedPositions.map(pos => {
                  const drone = drones[pos.droneId];
                  return (
                    <div key={pos.droneId} className="flex items-center justify-between py-1.5 px-2 bg-slate-800/30 rounded-lg text-[10px]">
                      <span className="text-slate-300 truncate w-24">{drone?.name || pos.droneId}</span>
                      <span className="text-yellow-400 font-mono">
                        {pos.targetLat.toFixed(6)}, {pos.targetLng.toFixed(6)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <p className="text-[10px] text-slate-500 italic text-center">
              Xem trên bản đồ: marker mờ + đường nét đứt = vị trí đích
            </p>
          </div>
        )}
      </div>

      {/* Footer buttons */}
      <div className="p-4 border-t border-white/5 flex items-center justify-between shrink-0">
        {step === 1 ? (
          <button onClick={onCancel} className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition-colors">
            <X size={14} /> Hủy
          </button>
        ) : (
          <button onClick={() => setStep(s => s - 1)} className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition-colors">
            <ChevronLeft size={14} /> Quay lại
          </button>
        )}

        {step === 1 && (
          <button
            onClick={() => setStep(2)}
            disabled={!canGoStep2}
            className={`flex items-center gap-1 px-4 py-2 rounded-xl text-xs font-bold transition-all ${canGoStep2
                ? 'bg-blue-600 hover:bg-blue-500 text-white'
                : 'bg-slate-700 text-slate-500 cursor-not-allowed'
              }`}
          >
            Tiếp <ChevronRight size={14} />
          </button>
        )}
        {step === 2 && (
          <button
            onClick={() => setStep(3)}
            disabled={!canGoStep3}
            className={`flex items-center gap-1 px-4 py-2 rounded-xl text-xs font-bold transition-all ${canGoStep3
                ? 'bg-blue-600 hover:bg-blue-500 text-white'
                : 'bg-slate-700 text-slate-500 cursor-not-allowed'
              }`}
          >
            Xem trước <ChevronRight size={14} />
          </button>
        )}
        {step === 3 && (
          <button
            onClick={handleExecute}
            disabled={executing || computedPositions.length === 0}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${executing
                ? 'bg-yellow-600/50 text-yellow-200 cursor-wait'
                : 'bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-500 hover:to-emerald-400 text-white shadow-lg shadow-green-900/30'
              }`}
          >
            {executing ? (
              <>
                <RotateCcw size={14} className="animate-spin" /> Đang gửi...
              </>
            ) : (
              <>
                <Rocket size={14} /> Thực thi
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};

export default FormationScheduler;
