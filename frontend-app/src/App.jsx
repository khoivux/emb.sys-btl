import React from 'react';
import MapView from './components/MapView.jsx';
import ControlPanel from './components/ControlPanel.jsx';
import { useDroneSocket } from './hooks/useDroneSocket.js';
import { Navigation, Shield, User, History } from 'lucide-react';

function App() {
  const { drones, sendCommand } = useDroneSocket();

  return (
    <div className="relative w-screen h-screen bg-slate-950 overflow-hidden flex font-sans">
      
      {/* Sidebar Navigation (Aesthetics) */}
      <div className="w-20 bg-slate-900 border-r border-slate-800 flex flex-col items-center py-8 gap-10 z-20">
        <div className="text-blue-500 bg-blue-500/10 p-3 rounded-2xl">
          <Navigation size={28} />
        </div>
        <div className="flex flex-col gap-8 text-slate-500">
          <Shield className="hover:text-blue-400 cursor-pointer transition-colors" />
          <History className="hover:text-blue-400 cursor-pointer transition-colors" />
          <User className="hover:text-blue-400 cursor-pointer transition-colors" />
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 relative">
        {/* Map Background */}
        <MapView drones={drones} />

        {/* Dashboard Components */}
        <div className="absolute top-6 left-6 z-10 flex flex-col gap-2">
            <h1 className="text-2xl font-black text-white bg-slate-900/40 backdrop-blur-xl px-4 py-2 rounded-lg border border-white/10 shadow-2xl">
                DRONE <span className="text-blue-500">CONTROL</span> CENTER
            </h1>
            <p className="text-[10px] text-slate-500 font-mono tracking-widest pl-1">REAL-TIME TELEMETRY SYSTEM v1.0</p>
        </div>

        {/* Real-time Control Panel */}
        <ControlPanel drones={drones} onCommand={sendCommand} />

        {/* Bottom Status Bar (Aesthetics) */}
        <div className="absolute bottom-6 left-6 right-6 h-12 bg-slate-900/60 backdrop-blur-xl rounded-2xl border border-white/5 shadow-2xl flex items-center px-6 justify-between text-slate-400 text-xs z-10">
            <div className="flex gap-6">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                    <span>SYSTEM: ONLINE</span>
                </div>
                <div className="flex items-center gap-2">
                    <span>MQTT BRIDGE: 127.0.0.1:1883</span>
                </div>
            </div>
            <div>
                <span>PTIT UNIVERSITY - EMBEDDED SYSTEMS PROJECT</span>
            </div>
        </div>
      </div>
    </div>
  );
}

export default App;
