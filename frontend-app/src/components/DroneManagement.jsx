import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/AuthContext';
import { Plus, Trash2, Cpu, Battery, Signal, Navigation } from 'lucide-react';

const DroneManagement = () => {
    const { token } = useAuth();
    const [drones, setDrones] = useState([]);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [newDrone, setNewDrone] = useState({ device_id: '', name: '' });

    const [unclaimedDrones, setUnclaimedDrones] = useState([]);

    const fetchData = async () => {
        const [res, discRes] = await Promise.all([
            fetch('http://127.0.0.1:8000/api/drones/', { headers: { 'Authorization': `Bearer ${token}` } }),
            fetch('http://127.0.0.1:8000/api/drones/discovery/', { headers: { 'Authorization': `Bearer ${token}` } })
        ]);
        if (res.ok) setDrones(await res.json());
        if (discRes.ok) setUnclaimedDrones(await discRes.json());
    };

    useEffect(() => {
        fetchData();
    }, [token]);

    const handleClaim = async (id, name) => {
        const res = await fetch(`http://127.0.0.1:8000/api/drones/${id}/claim/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ name })
        });
        if (res.ok) fetchData();
    };

    const handleAddDrone = async (e) => {
        e.preventDefault();
        const res = await fetch('http://127.0.0.1:8000/api/drones/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(newDrone)
        });
        if (res.ok) {
            fetchDrones();
            setIsAddModalOpen(false);
            setNewDrone({ device_id: '', name: '' });
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Bạn có chắc chắn muốn xóa Drone này?")) return;
        const res = await fetch(`http://127.0.0.1:8000/api/drones/${id}/`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) fetchDrones();
    };

    return (
        <div className="flex-1 bg-slate-950 p-8 overflow-y-auto">
            <div className="flex justify-between items-center mb-10">
                <div>
                    <h1 className="text-3xl font-black text-white">MY <span className="text-blue-500">DRONES</span></h1>
                    <p className="text-slate-500 text-sm">Quản lý và thiết lập thông tin thiết bị</p>
                </div>
                <button 
                    onClick={() => setIsAddModalOpen(true)}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-2xl transition-all shadow-lg shadow-blue-600/20"
                >
                    <Plus size={20} /> Thêm Drone Thủ Công
                </button>
            </div>

            {/* DISCOVERY SECTION */}
            {unclaimedDrones.length > 0 && (
                <div className="mb-12">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="h-2 w-2 bg-blue-500 rounded-full animate-ping"></div>
                        <h2 className="text-sm font-bold text-blue-400 uppercase tracking-widest">Phát hiện thiết bị mới ở gần</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {unclaimedDrones.map(drone => (
                            <div key={drone.id} className="bg-blue-600/5 border border-blue-500/20 rounded-3xl p-6 flex flex-col justify-between">
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="w-10 h-10 bg-blue-600/20 text-blue-400 rounded-xl flex items-center justify-center">
                                        <Signal size={20} />
                                    </div>
                                    <div>
                                        <p className="text-xs text-blue-300 font-mono">{drone.device_id}</p>
                                        <p className="text-white text-[10px] uppercase font-bold">Chưa kết nối</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => handleClaim(drone.id, `Drone ${drone.device_id.slice(0,4)}`)}
                                    className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-xl text-xs font-bold transition-all"
                                >
                                    Ghép đôi ngay
                                </button>
                            </div>
                        ))}
                    </div>
                    <div className="h-px bg-white/5 mt-10"></div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {drones.filter(d => d.owner !== null).map(drone => (
                    <div key={drone.id} className="bg-slate-900/50 border border-white/5 rounded-3xl p-6 hover:border-blue-500/30 transition-all group relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleDelete(drone.id)} className="text-slate-600 hover:text-red-500 p-2">
                                <Trash2 size={18} />
                            </button>
                        </div>

                        <div className="flex items-start gap-4 mb-6">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${drone.is_active ? 'bg-green-500/10 text-green-500' : 'bg-slate-800 text-slate-500'}`}>
                                <Cpu size={24} />
                            </div>
                            <div>
                                <h3 className="text-white font-bold text-lg">{drone.name}</h3>
                                <p className="text-slate-500 text-xs font-mono">{drone.device_id}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-slate-800/30 p-3 rounded-xl border border-white/5">
                                <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Trạng thái</p>
                                <div className="flex items-center gap-2">
                                    <div className={`h-2 w-2 rounded-full ${drone.is_active ? 'bg-green-500 animate-pulse' : 'bg-slate-600'}`}></div>
                                    <span className={`text-xs font-bold ${drone.is_active ? 'text-green-500' : 'text-slate-500'}`}>
                                        {drone.is_active ? 'ONLINE' : 'OFFLINE'}
                                    </span>
                                </div>
                            </div>
                            <div className="bg-slate-800/30 p-3 rounded-xl border border-white/5">
                                <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Cập nhật lần cuối</p>
                                <span className="text-xs text-slate-300">
                                    {new Date(drone.last_seen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {isAddModalOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-white/10 w-full max-w-md rounded-3xl p-8 shadow-2xl">
                        <h2 className="text-2xl font-black text-white mb-6">ĐĂNG KÝ <span className="text-blue-500">DRONE MỚI</span></h2>
                        <form onSubmit={handleAddDrone} className="space-y-6">
                            <div>
                                <label className="block text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">Tên Drone</label>
                                <input 
                                    type="text" 
                                    className="w-full bg-slate-950 border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500"
                                    placeholder="Ví dụ: Drone Thám Hiểm 01"
                                    value={newDrone.name}
                                    onChange={e => setNewDrone({...newDrone, name: e.target.value})}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">Mã Thiết Bị (Device ID)</label>
                                <input 
                                    type="text" 
                                    className="w-full bg-slate-950 border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500"
                                    placeholder="Ví dụ: drone_001"
                                    value={newDrone.device_id}
                                    onChange={e => setNewDrone({...newDrone, device_id: e.target.value})}
                                    required
                                />
                            </div>
                            <div className="flex gap-4 pt-4">
                                <button 
                                    type="button"
                                    onClick={() => setIsAddModalOpen(false)}
                                    className="flex-1 bg-slate-800 text-slate-400 py-3 rounded-xl hover:bg-slate-700 transition-colors"
                                >
                                    Hủy
                                </button>
                                <button 
                                    type="submit"
                                    className="flex-1 bg-blue-600 text-white py-3 rounded-xl hover:bg-blue-500 transition-colors font-bold"
                                >
                                    Đăng ký ngay
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DroneManagement;
