import React, { useEffect, useRef, useCallback } from 'react';
import { PlaneTakeoff, PlaneLanding, Home, AlertOctagon, Navigation, ArrowUpCircle, ArrowDownCircle, RotateCcw, RotateCw, X } from 'lucide-react';

const KEY_MAP = {
  arrowup: { cmd: 'MOVE', params: { direction: 'FORWARD' } },
  arrowdown: { cmd: 'MOVE', params: { direction: 'BACKWARD' } },
  arrowleft: { cmd: 'MOVE', params: { direction: 'LEFT' } },
  arrowright: { cmd: 'MOVE', params: { direction: 'RIGHT' } },
  w: { cmd: 'MOVE', params: { direction: 'FORWARD' } },
  s: { cmd: 'MOVE', params: { direction: 'BACKWARD' } },
  a: { cmd: 'MOVE', params: { direction: 'LEFT' } },
  d: { cmd: 'MOVE', params: { direction: 'RIGHT' } },
  q: { cmd: 'YAW_LEFT', params: {} },
  e: { cmd: 'YAW_RIGHT', params: {} },
  shift: { cmd: 'CLIMB', params: {} },
  ' ': { cmd: 'DESCEND', params: {} },
};

// ControlPanel nhận 2 hàm gửi lệnh:
//   onCommandWS  — WebSocket, ~1ms  → dùng cho movement real-time
//   onCommand    — HTTP,       ~50ms → dùng cho lệnh quan trọng (TAKEOFF/LAND/...)
const ControlPanel = ({ drone, onCommand, onCommandWS, onClose }) => {
  const activeKeys = useRef(new Set());
  const intervalRef = useRef(null);
  const targetIdRef = useRef(null);

  // Cập nhật targetId khi drone thay đổi
  useEffect(() => {
    targetIdRef.current = drone?.device_id || drone?.id;
  }, [drone]);

  // Hàm gửi movement — ưu tiên WS, fallback HTTP
  const sendMove = useCallback((cmd, params = {}) => {
    const id = targetIdRef.current;
    if (!id) return;
    if (onCommandWS) onCommandWS(id, cmd, params);
    else onCommand(id, cmd, params);
  }, [onCommand, onCommandWS]);

  // --- Keyboard listener ---
  useEffect(() => {
    const handleKeyDown = (e) => {
      const key = e.key.toLowerCase();
      if (!KEY_MAP[key]) return;

      // Gửi lệnh ngay lập tức khi nhấn phím (không đợi interval)
      if (!activeKeys.current.has(key)) {
        const { cmd, params } = KEY_MAP[key];
        sendMove(cmd, params);
      }
      activeKeys.current.add(key);
    };

    const handleKeyUp = (e) => {
      activeKeys.current.delete(e.key.toLowerCase());
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [sendMove]);

  // --- Command loop 20Hz (khi phím vẫn được giữ) ---
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      if (activeKeys.current.size === 0) return;
      activeKeys.current.forEach(key => {
        const mapping = KEY_MAP[key];
        if (mapping) sendMove(mapping.cmd, mapping.params);
      });
    }, 50); // 20Hz

    return () => clearInterval(intervalRef.current);
  }, [sendMove]);

  if (!drone) return null;

  const targetId = drone.device_id || drone.id;
  const droneAlt = drone.alt ?? drone.altitude ?? 0;

  return (
    <div
      className="absolute top-4 right-4 flex flex-col gap-4 z-10 w-80"
      style={{ animation: 'slideInRight 0.22s cubic-bezier(0.4, 0, 0.2, 1)' }}
    >
      <style>{`
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(24px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>

      {/* Telemetry Card */}
      <div className="p-4 bg-slate-900/80 backdrop-blur-md rounded-2xl text-white shadow-2xl border border-slate-700/50 relative">
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            title="Đóng bảng điều khiển"
          >
            <X size={16} />
          </button>
        )}

        <div className="mb-3">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Đang điều khiển</h3>
          <p className="text-sm font-bold text-cyan-400 mt-0.5 truncate pr-8 font-mono">{drone.name || targetId}</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col">
            <span className="text-2xl font-bold">{droneAlt.toFixed(1)}m</span>
            <span className="text-xs text-slate-400">Độ cao</span>
          </div>
          <div className="flex flex-col items-center p-2 bg-slate-800/50 rounded-lg">
            <span className="text-[10px] text-slate-400">Heading</span>
            <span className="text-sm font-mono">{drone.yaw || 0}°</span>
          </div>
          <div className="flex flex-col items-center p-2 bg-slate-800/50 rounded-lg">
            <span className="text-[10px] text-slate-400">Battery</span>
            <span className={`text-sm font-mono ${drone.battery < 20 ? 'text-red-400 animate-pulse' : 'text-green-400'}`}>
              {drone.battery}%
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-mono text-blue-300 truncate">{drone.state || (drone.is_active ? 'ACTIVE' : 'OFFLINE')}</span>
            <span className="text-xs text-slate-400">Trạng thái</span>
          </div>
        </div>

        {/* WS indicator */}
        <div className="mt-3 flex items-center gap-1.5">
          <div className={`w-1.5 h-1.5 rounded-full ${onCommandWS ? 'bg-green-400 animate-pulse' : 'bg-yellow-400'}`} />
          <span className="text-[9px] text-slate-500">
            {onCommandWS ? 'WebSocket (low-latency)' : 'HTTP fallback'}
          </span>
        </div>
      </div>

      {/* Action Buttons — HTTP (đảm bảo tới nơi) */}
      <div className="p-4 bg-slate-900/80 backdrop-blur-md rounded-2xl text-white shadow-2xl border border-slate-700/50 grid grid-cols-2 gap-2">
        <button
          onClick={() => onCommand(targetId, 'TAKEOFF')}
          className="flex items-center justify-center gap-2 p-3 bg-blue-600 hover:bg-blue-500 active:scale-95 rounded-xl transition-all"
        >
          <PlaneTakeoff size={20} /> Cất cánh
        </button>
        <button
          onClick={() => onCommand(targetId, 'LAND')}
          className="flex items-center justify-center gap-2 p-3 bg-orange-600 hover:bg-orange-500 active:scale-95 rounded-xl transition-all"
        >
          <PlaneLanding size={20} /> Hạ cánh
        </button>
        <button
          onClick={() => onCommand(targetId, 'RTH')}
          className="flex items-center justify-center gap-2 p-3 bg-teal-600 hover:bg-teal-500 active:scale-95 rounded-xl transition-all"
        >
          <Home size={20} /> RTH
        </button>
        <button
          onClick={() => onCommand(targetId, 'EMERGENCY')}
          className="flex items-center justify-center gap-2 p-3 bg-red-600 hover:bg-red-500 active:scale-95 rounded-xl transition-all font-bold"
        >
          <AlertOctagon size={20} /> Dừng khẩn
        </button>
      </div>

      {/* D-Pad — WebSocket (real-time) */}
      <div className="p-4 bg-slate-900/80 backdrop-blur-md rounded-2xl text-white shadow-2xl border border-slate-700/50 flex flex-col items-center gap-2">
        <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Manual Steering</h3>
        <div className="flex items-center gap-6">
          {/* Altitude */}
          <div className="flex flex-col gap-2">
            <button
              onMouseDown={() => sendMove('CLIMB')}
              className="w-10 h-10 bg-blue-500/20 hover:bg-blue-500/40 text-blue-400 rounded-lg flex items-center justify-center border border-blue-500/20 active:scale-95 transition-all"
            >
              <ArrowUpCircle size={20} />
            </button>
            <button
              onMouseDown={() => sendMove('DESCEND')}
              className="w-10 h-10 bg-orange-500/20 hover:bg-orange-500/40 text-orange-400 rounded-lg flex items-center justify-center border border-orange-500/20 active:scale-95 transition-all"
            >
              <ArrowDownCircle size={20} />
            </button>
          </div>

          {/* Directional Pad */}
          <div className="grid grid-cols-3 gap-1">
            <button onMouseDown={() => sendMove('YAW_LEFT')}
              className="w-10 h-10 bg-slate-800 hover:bg-yellow-600 rounded-lg flex items-center justify-center border border-white/5 active:scale-95 transition-all">
              <RotateCcw size={16} />
            </button>
            <button onMouseDown={() => sendMove('MOVE', { direction: 'FORWARD' })}
              className="w-10 h-10 bg-slate-800 hover:bg-blue-600 rounded-lg flex items-center justify-center border border-white/5 active:scale-95 transition-all">
              <Navigation size={18} />
            </button>
            <button onMouseDown={() => sendMove('YAW_RIGHT')}
              className="w-10 h-10 bg-slate-800 hover:bg-yellow-600 rounded-lg flex items-center justify-center border border-white/5 active:scale-95 transition-all">
              <RotateCw size={16} />
            </button>
            <button onMouseDown={() => sendMove('MOVE', { direction: 'LEFT' })}
              className="w-10 h-10 bg-slate-800 hover:bg-blue-600 rounded-lg flex items-center justify-center border border-white/5 active:scale-95 transition-all -rotate-90">
              <Navigation size={18} />
            </button>
            <button onMouseDown={() => sendMove('MOVE', { direction: 'BACKWARD' })}
              className="w-10 h-10 bg-slate-800 hover:bg-blue-600 rounded-lg flex items-center justify-center border border-white/5 active:scale-95 transition-all rotate-180">
              <Navigation size={18} />
            </button>
            <button onMouseDown={() => sendMove('MOVE', { direction: 'RIGHT' })}
              className="w-10 h-10 bg-slate-800 hover:bg-blue-600 rounded-lg flex items-center justify-center border border-white/5 active:scale-95 transition-all rotate-90">
              <Navigation size={18} />
            </button>
          </div>
        </div>
        <p className="text-[9px] text-slate-500 mt-2">WASD/↑↓←→ Di chuyển | QE Xoay | Shift/Space Độ cao</p>
      </div>
    </div>
  );
};

export default ControlPanel;
