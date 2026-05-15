import React, { useEffect } from 'react';
import { PlaneTakeoff, PlaneLanding, Home, AlertOctagon, Navigation, ArrowUpCircle, ArrowDownCircle, RotateCcw, RotateCw } from 'lucide-react';

const ControlPanel = ({ drones, onCommand }) => {
  const droneIds = Object.keys(drones);
  const activeKeys = React.useRef(new Set());
  const intervalRef = React.useRef(null);

  // Controller Loop: Sends commands while keys are held down
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      if (droneIds.length === 0 || activeKeys.current.size === 0) return;
      const drone = drones[droneIds[0]];
      
      const keyMap = {
          'arrowup': 'FORWARD', 'arrowdown': 'BACKWARD', 'arrowleft': 'LEFT', 'arrowright': 'RIGHT',
          'w': 'FORWARD', 's': 'BACKWARD', 'a': 'LEFT', 'd': 'RIGHT',
          'q': 'YAW_LEFT', 'e': 'YAW_RIGHT',
          'shift': 'CLIMB', ' ': 'DESCEND'
      };

      activeKeys.current.forEach(key => {
        const cmd = keyMap[key];
        if (cmd) {
            const isMove = ['FORWARD', 'BACKWARD', 'LEFT', 'RIGHT'].includes(cmd);
            if (isMove) onCommand(drone.id, 'MOVE', { direction: cmd });
            else onCommand(drone.id, cmd, {});
        }
      });
    }, 100); // 10Hz command stream

    return () => clearInterval(intervalRef.current);
  }, [drones, droneIds, onCommand]);

  useEffect(() => {
    const handleKeyDown = (e) => {
        activeKeys.current.add(e.key.toLowerCase());
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
  }, []);
  if (droneIds.length === 0) return (
    <div className="absolute top-4 right-4 z-10 w-80">
      <div className="p-6 bg-slate-900/80 backdrop-blur-md rounded-2xl text-white shadow-2xl border border-dashed border-slate-700/50 flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-full border-2 border-slate-700 border-t-blue-500 animate-spin"></div>
        <div className="text-center">
            <h3 className="text-sm font-bold text-slate-300">Đang chờ tín hiệu...</h3>
            <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-tighter">Vui lòng khởi động Mock Drone hoặc ESP32</p>
        </div>
      </div>
    </div>
  );

  const drone = drones[droneIds[0]]; // Show info for first drone for now

  return (
    <div className="absolute top-4 right-4 flex flex-col gap-4 z-10 w-80">
      {/* Telemetry Card */}
      <div className="p-4 bg-slate-900/80 backdrop-blur-md rounded-2xl text-white shadow-2xl border border-slate-700/50">
        <h3 className="text-sm font-semibold text-slate-400 mb-3 uppercase tracking-wider">Drone Status</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col">
            <span className="text-2xl font-bold">{drone.alt.toFixed(1)}m</span>
            <span className="text-xs text-slate-400">Độ cao</span>
          </div>
          <div className="flex flex-col items-center p-2 bg-slate-800/50 rounded-lg">
            <span className="text-[10px] text-slate-400">Heading</span>
            <span className="text-sm font-mono">{drone.yaw}°</span>
          </div>
          <div className="flex flex-col items-center p-2 bg-slate-800/50 rounded-lg">
            <span className="text-[10px] text-slate-400">Battery</span>
            <span className={`text-sm font-mono ${drone.battery < 20 ? 'text-red-400 animate-pulse' : 'text-green-400'}`}>
              {drone.battery}%
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-mono text-blue-300">{drone.state}</span>
            <span className="text-xs text-slate-400">Trạng thái</span>
          </div>
        </div>
      </div>

      {/* Control Buttons */}
      <div className="p-4 bg-slate-900/80 backdrop-blur-md rounded-2xl text-white shadow-2xl border border-slate-700/50 grid grid-cols-2 gap-2">
        <button 
          onClick={() => {
            console.log("Button Clicked: TAKEOFF", drone.id || drone.device_id);
            onCommand(drone.id || drone.device_id, 'TAKEOFF');
          }}
          className="flex items-center justify-center gap-2 p-3 bg-blue-600 hover:bg-blue-500 rounded-xl transition-all"
        >
          <PlaneTakeoff size={20} /> Cất cánh
        </button>
        <button 
          onClick={() => {
            console.log("Button Clicked: LAND", drone.id || drone.device_id);
            onCommand(drone.id || drone.device_id, 'LAND');
          }}
          className="flex items-center justify-center gap-2 p-3 bg-orange-600 hover:bg-orange-500 rounded-xl transition-all"
        >
          <PlaneLanding size={20} /> Hạ cánh
        </button>
        <button 
          onClick={() => {
            console.log("Button Clicked: RTH", drone.id || drone.device_id);
            onCommand(drone.id || drone.device_id, 'RTH');
          }}
          className="flex items-center justify-center gap-2 p-3 bg-teal-600 hover:bg-teal-500 rounded-xl transition-all"
        >
          <Home size={20} /> RTH
        </button>
        <button 
          onClick={() => {
            console.log("Button Clicked: EMERGENCY", drone.id || drone.device_id);
            onCommand(drone.id || drone.device_id, 'EMERGENCY');
          }}
          className="flex items-center justify-center gap-2 p-3 bg-red-600 hover:bg-red-500 rounded-xl transition-all font-bold"
        >
          <AlertOctagon size={20} /> Dừng khẩn
        </button>
      </div>

      {/* Manual Steering (D-Pad) */}
      <div className="p-4 bg-slate-900/80 backdrop-blur-md rounded-2xl text-white shadow-2xl border border-slate-700/50 flex flex-col items-center gap-2">
        <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Manual Steering</h3>
        <div className="flex items-center gap-6">
            {/* Altitude Controls */}
            <div className="flex flex-col gap-2">
                <button onMouseDown={() => onCommand(drone.id || drone.device_id, 'CLIMB')} 
                    className="w-10 h-10 bg-blue-500/20 hover:bg-blue-500/40 text-blue-400 rounded-lg flex items-center justify-center border border-blue-500/20 active:scale-95 transition-all">
                    <ArrowUpCircle size={20} />
                </button>
                <button onMouseDown={() => onCommand(drone.id || drone.device_id, 'DESCEND')} 
                    className="w-10 h-10 bg-orange-500/20 hover:bg-orange-500/40 text-orange-400 rounded-lg flex items-center justify-center border border-orange-500/20 active:scale-95 transition-all">
                    <ArrowDownCircle size={20} />
                </button>
            </div>

            {/* Directional Pad */}
            <div className="grid grid-cols-3 gap-1">
                <button onMouseDown={() => onCommand(drone.id || drone.device_id, 'YAW_LEFT')} 
                    className="w-10 h-10 bg-slate-800 hover:bg-yellow-600 rounded-lg flex items-center justify-center border border-white/5 active:scale-95 transition-all">
                    <RotateCcw size={16} />
                </button>
                <button onMouseDown={() => onCommand(drone.id || drone.device_id, 'MOVE', { direction: 'FORWARD' })} 
                    className="w-10 h-10 bg-slate-800 hover:bg-blue-600 rounded-lg flex items-center justify-center border border-white/5 active:scale-95 transition-all">
                    <Navigation size={18} />
                </button>
                <button onMouseDown={() => onCommand(drone.id || drone.device_id, 'YAW_RIGHT')} 
                    className="w-10 h-10 bg-slate-800 hover:bg-yellow-600 rounded-lg flex items-center justify-center border border-white/5 active:scale-95 transition-all">
                    <RotateCw size={16} />
                </button>
                <button onMouseDown={() => onCommand(drone.id || drone.device_id, 'MOVE', { direction: 'LEFT' })} 
                    className="w-10 h-10 bg-slate-800 hover:bg-blue-600 rounded-lg flex items-center justify-center border border-white/5 active:scale-95 transition-all -rotate-90">
                    <Navigation size={18} />
                </button>
                <button onMouseDown={() => onCommand(drone.id || drone.device_id, 'MOVE', { direction: 'BACKWARD' })} 
                    className="w-10 h-10 bg-slate-800 hover:bg-blue-600 rounded-lg flex items-center justify-center border border-white/5 active:scale-95 transition-all rotate-180">
                    <Navigation size={18} />
                </button>
                <button onMouseDown={() => onCommand(drone.id || drone.device_id, 'MOVE', { direction: 'RIGHT' })} 
                    className="w-10 h-10 bg-slate-800 hover:bg-blue-600 rounded-lg flex items-center justify-center border border-white/5 active:scale-95 transition-all rotate-90">
                    <Navigation size={18} />
                </button>
            </div>
        </div>
        <p className="text-[9px] text-slate-500 mt-2">WASD Move | QE Rotate | Shift/Space Alt</p>
      </div>
    </div>
  );
};

export default ControlPanel;
