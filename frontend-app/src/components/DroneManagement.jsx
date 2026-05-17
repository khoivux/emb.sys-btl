import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/AuthContext';
import { Plus, Trash2, Cpu, Battery, Signal, Navigation, Loader2, Edit2, X, ShieldCheck } from 'lucide-react';

const DroneManagement = (props) => {
    const { token } = useAuth();
    const [drones, setDrones] = useState([]);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [editingDrone, setEditingDrone] = useState(null);
    const [newDrone, setNewDrone] = useState({ device_id: '', name: '' });
    const [loading, setLoading] = useState(false);

    const baseUrl = `http://${window.location.hostname}:8000`;

    const fetchData = async () => {
        try {
            const res = await fetch(`${baseUrl}/api/drones/`, { headers: { 'Authorization': `Bearer ${token}` } });
            if (res.ok) setDrones(await res.json());
        } catch (err) {
            console.error("Lỗi tải dữ liệu:", err);
        }
    };

    // Sync live updates into the local list
    useEffect(() => {
        if (props.drones && Object.keys(props.drones).length > 0) {
            setDrones(currentDrones => 
                currentDrones.map(d => {
                    const live = props.drones[d.device_id];
                    if (live) {
                        return { ...d, ...live };
                    }
                    return d;
                })
            );
        }
    }, [props.drones]);

    useEffect(() => {
        fetchData();
        // Lắng nghe sự kiện từ tab Discovery nếu có
        const handleRefresh = () => fetchData();
        window.addEventListener('drone_claimed', handleRefresh);
        return () => window.removeEventListener('drone_claimed', handleRefresh);
    }, [token]);



    const handleUpdateDrone = async (e) => {
        e.preventDefault();
        setLoading(true);
        const res = await fetch(`${baseUrl}/api/drones/${editingDrone.id}/`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ name: editingDrone.name })
        });
        if (res.ok) {
            const updated = await res.json();
            setDrones(prev => prev.map(d => d.id === updated.id ? updated : d));
            setEditingDrone(null);
        }
        setLoading(false);
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Bạn có chắc chắn muốn xóa Drone này?")) return;
        const res = await fetch(`${baseUrl}/api/drones/${id}/`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            setDrones(prev => prev.filter(d => d.id !== id));
        }
    };

    const handleAddDrone = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await fetch(`${baseUrl}/api/drones/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(newDrone)
            });
            if (res.ok) {
                const created = await res.json();
                setDrones(prev => [...prev, created]);
                setIsAddModalOpen(false);
                setNewDrone({ device_id: '', name: '' });
            } else {
                const errData = await res.json();
                alert("Lỗi: " + (errData.detail || JSON.stringify(errData)));
            }
        } catch (err) {
            alert("Lỗi kết nối server");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex-1 bg-slate-950 p-8 overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center mb-10">
                <div>
                    <h1 className="text-3xl font-black text-white uppercase tracking-tighter">My <span className="text-blue-500">Drones</span></h1>
                    <p className="text-slate-500 text-sm font-medium">Hệ thống quản lý hạm đội thiết bị bay</p>
                </div>
                <button 
                    onClick={() => setIsAddModalOpen(true)}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-2xl transition-all shadow-lg shadow-blue-600/20 font-bold"
                >
                    <Plus size={20} /> THÊM THỦ CÔNG
                </button>
            </div>



            {/* MAIN LIST */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {drones.length === 0 && !loading && (
                    <div className="col-span-full py-20 bg-slate-900/20 border-2 border-dashed border-white/5 rounded-[40px] flex flex-col items-center justify-center text-center">
                        <Cpu className="text-slate-800 mb-4" size={60} />
                        <h3 className="text-slate-500 font-bold uppercase tracking-widest">Chưa có drone nào</h3>
                        <p className="text-slate-700 text-sm mt-2">Hãy bật thiết bị và vào tab Radar để tìm kiếm</p>
                    </div>
                )}
                
                {drones.map(drone => {
                    const liveData = (props.drones && props.drones[drone.device_id]) || {};
                    const isActive = liveData.is_active !== undefined ? liveData.is_active : drone.is_active;
                    const battery = liveData.battery !== undefined ? liveData.battery : (drone.battery || 0);

                    if (liveData.device_id) {
                        console.log(`🔌 [UI MERGE] Drone ${drone.device_id}: Active=${isActive}, Battery=${battery}`);
                    }

                    return (
                        <div key={drone.id} className="bg-slate-900/40 backdrop-blur-xl border border-white/5 rounded-[40px] p-8 hover:border-blue-500/30 transition-all group relative overflow-hidden">
                            <div className="absolute top-6 right-6 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button 
                                    onClick={() => setEditingDrone(drone)}
                                    className="bg-slate-800 hover:bg-blue-600 text-white p-2.5 rounded-xl transition-all"
                                >
                                    <Edit2 size={16} />
                                </button>
                                <button 
                                    onClick={() => handleDelete(drone.id)} 
                                    className="bg-slate-800 hover:bg-red-600 text-white p-2.5 rounded-xl transition-all"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>

                            <div className="flex items-start gap-4 mb-8">
                                <div className={`w-14 h-14 rounded-3xl flex items-center justify-center shadow-2xl ${isActive ? 'bg-green-600 shadow-green-500/20 text-white' : 'bg-slate-800 text-slate-500'}`}>
                                    <Cpu size={28} />
                                </div>
                                <div>
                                    <h3 className="text-white font-black text-xl tracking-tight">{drone.name}</h3>
                                    <p className="text-slate-500 text-xs font-mono">{drone.device_id}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-slate-950/50 p-4 rounded-3xl border border-white/5">
                                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-2">Trạng thái</p>
                                    <div className="flex items-center gap-2">
                                        <div className={`h-2 w-2 rounded-full ${isActive ? 'bg-green-500 animate-pulse' : 'bg-slate-600'}`}></div>
                                        <span className={`text-xs font-black ${isActive ? 'text-green-500' : 'text-slate-500'}`}>
                                            {isActive ? 'ONLINE' : 'OFFLINE'}
                                        </span>
                                    </div>
                                </div>
                                <div className="bg-slate-950/50 p-4 rounded-3xl border border-white/5">
                                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-2">Pin</p>
                                    <div className="flex items-center gap-2">
                                        <Battery size={14} className={battery < 20 ? 'text-red-500' : 'text-blue-500'} />
                                        <span className="text-xs font-black text-white">{battery}%</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* EDIT MODAL */}
            {editingDrone && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
                    <div className="bg-slate-900 border border-white/10 p-10 rounded-[50px] w-full max-w-md shadow-2xl">
                        <div className="flex justify-between items-center mb-8">
                            <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Sửa thông tin</h2>
                            <button onClick={() => setEditingDrone(null)} className="text-slate-500 hover:text-white">
                                <X size={28} />
                            </button>
                        </div>
                        
                        <form onSubmit={handleUpdateDrone}>
                            <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-3">Tên gợi nhớ của Drone</label>
                            <input 
                                autoFocus
                                value={editingDrone.name}
                                onChange={(e) => setEditingDrone({...editingDrone, name: e.target.value})}
                                className="w-full bg-slate-950 border border-white/5 rounded-3xl p-5 text-white mb-10 focus:border-blue-500 outline-none transition-all text-lg font-bold"
                            />
                            
                            <button 
                                type="submit"
                                disabled={loading}
                                className="w-full bg-blue-600 hover:bg-blue-500 py-5 rounded-[24px] text-white font-black text-lg flex items-center justify-center gap-3 transition-all shadow-2xl shadow-blue-600/30"
                            >
                                {loading ? <Loader2 className="animate-spin" size={24} /> : <ShieldCheck size={24} />}
                                LƯU THAY ĐỔI
                            </button>
                        </form>
                    </div>
                </div>
            )}
            {/* ADD MODAL */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
                    <div className="bg-slate-900 border border-white/10 p-10 rounded-[50px] w-full max-w-md shadow-2xl">
                        <div className="flex justify-between items-center mb-8">
                            <h2 className="text-2xl font-black text-white uppercase tracking-tighter">ĐĂNG KÝ <span className="text-blue-500">MỚI</span></h2>
                            <button onClick={() => setIsAddModalOpen(false)} className="text-slate-500 hover:text-white">
                                <X size={28} />
                            </button>
                        </div>
                        
                        <form onSubmit={handleAddDrone}>
                            <div className="mb-6">
                                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-3">Tên gợi nhớ</label>
                                <input 
                                    autoFocus
                                    value={newDrone.name}
                                    onChange={(e) => setNewDrone({...newDrone, name: e.target.value})}
                                    className="w-full bg-slate-950 border border-white/5 rounded-3xl p-5 text-white focus:border-blue-500 outline-none transition-all font-bold"
                                    placeholder="Ví dụ: Drone Thám Hiểm 01"
                                    required
                                />
                            </div>

                            <div className="mb-10">
                                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-3">Mã Thiết Bị (Device ID)</label>
                                <input 
                                    value={newDrone.device_id}
                                    onChange={(e) => setNewDrone({...newDrone, device_id: e.target.value})}
                                    className="w-full bg-slate-950 border border-white/5 rounded-3xl p-5 text-white focus:border-blue-500 outline-none transition-all font-mono"
                                    placeholder="Ví dụ: drone_99"
                                    required
                                />
                            </div>
                            
                            <button 
                                type="submit"
                                disabled={loading}
                                className="w-full bg-blue-600 hover:bg-blue-500 py-5 rounded-[24px] text-white font-black text-lg flex items-center justify-center gap-3 transition-all shadow-2xl shadow-blue-600/30"
                            >
                                {loading ? <Loader2 className="animate-spin" size={24} /> : <Plus size={24} />}
                                ĐĂNG KÝ NGAY
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DroneManagement;
