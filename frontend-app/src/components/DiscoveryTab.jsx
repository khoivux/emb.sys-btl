import React, { useState } from 'react';
import { useAuth } from '../hooks/AuthContext';
import { Signal, Shield, Plus, Loader2, Cpu, Zap } from 'lucide-react';

const DiscoveryTab = ({ discoveredDrones, setDiscoveredDrones }) => {
    const { token } = useAuth();
    const [claimingId, setClaimingId] = useState(null);

    const handleClaim = async (id, deviceId) => {
        setClaimingId(id);
        const name = prompt("Đặt tên cho Drone này:", `Drone ${deviceId.slice(0, 4)}`);
        if (!name) {
            setClaimingId(null);
            return;
        }

        const res = await fetch(`http://127.0.0.1:8000/api/drones/${id}/claim/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ name })
        });

        if (res.ok) {
            // Remove from discovered list locally
            setDiscoveredDrones(prev => prev.filter(d => d.id !== id));
            alert("Kết nối thành công!");
        } else {
            alert("Có lỗi xảy ra khi kết nối.");
        }
        setClaimingId(null);
    };

    return (
        <div className="flex-1 bg-slate-950 p-8 flex flex-col items-center overflow-y-auto custom-scrollbar">
            {/* Header Section */}
            <div className="w-full max-w-4xl mb-12 text-center">
                <h1 className="text-4xl font-black text-white tracking-tighter mb-4">
                    SCANNING FOR <span className="text-blue-500">DEVICES</span>
                </h1>
                <div className="flex justify-center items-center gap-4 text-slate-500 font-mono text-xs tracking-widest uppercase">
                    <span>MQTT Bridge: Active</span>
                    <div className="h-1 w-1 bg-slate-700 rounded-full"></div>
                    <span>Protocol: WebSocket 2.0</span>
                </div>
            </div>

            {/* Radar Animation */}
            <div className="relative w-80 h-80 mb-20">
                <div className="absolute inset-0 border-2 border-blue-500/20 rounded-full"></div>
                <div className="absolute inset-4 border border-blue-500/10 rounded-full"></div>
                <div className="absolute inset-16 border border-blue-500/5 rounded-full"></div>
                
                {/* Rotating Sweep */}
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-transparent w-1/2 h-full origin-right animate-[spin_4s_linear_infinite] rounded-l-full blur-sm"></div>
                
                {/* Center Core */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                    <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-600/50">
                        <Signal className="text-white animate-pulse" size={24} />
                    </div>
                </div>

                {/* Discovered Dots */}
                {discoveredDrones.map((drone, i) => (
                    <div 
                        key={drone.id}
                        className="absolute w-3 h-3 bg-blue-400 rounded-full shadow-[0_0_15px_rgba(96,165,250,0.8)] animate-pulse"
                        style={{
                            top: `${30 + (i * 20) % 40}%`,
                            left: `${30 + (i * 25) % 40}%`
                        }}
                    ></div>
                ))}
            </div>

            {/* Discovery List */}
            <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-6">
                {discoveredDrones.length === 0 ? (
                    <div className="col-span-full py-20 border-2 border-dashed border-white/5 rounded-[40px] flex flex-col items-center justify-center">
                        <Loader2 className="text-slate-800 animate-spin mb-4" size={48} />
                        <p className="text-slate-600 font-bold uppercase tracking-widest">Đang tìm kiếm thiết bị mới...</p>
                        <p className="text-slate-700 text-xs mt-2">Hãy bật ESP32 và đảm bảo nó đã kết nối Wifi</p>
                    </div>
                ) : (
                    discoveredDrones.map(drone => (
                        <div key={drone.id} className="bg-slate-900/40 backdrop-blur-xl border border-white/5 p-8 rounded-[40px] hover:border-blue-500/30 transition-all group flex flex-col justify-between">
                            <div className="flex items-start justify-between mb-8">
                                <div className="flex gap-4">
                                    <div className="w-14 h-14 bg-blue-600/10 text-blue-400 rounded-3xl flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all">
                                        <Cpu size={30} />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-white mb-1">Thiết bị lạ</h3>
                                        <p className="text-xs text-slate-500 font-mono">{drone.device_id}</p>
                                    </div>
                                </div>
                                <div className="bg-green-500/10 text-green-500 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                                    <Zap size={10} fill="currentColor" /> Ready
                                </div>
                            </div>

                            <button 
                                onClick={() => handleClaim(drone.id, drone.device_id)}
                                disabled={claimingId === drone.id}
                                className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white py-4 rounded-3xl font-bold transition-all shadow-xl shadow-blue-600/20 flex items-center justify-center gap-3"
                            >
                                {claimingId === drone.id ? <Loader2 className="animate-spin" size={20} /> : <Plus size={20} />}
                                GHÉP ĐÔI THIẾT BỊ
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default DiscoveryTab;
