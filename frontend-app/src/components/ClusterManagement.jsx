import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/AuthContext';
import { Users, Plus, Trash2, ChevronRight, Play, Info } from 'lucide-react';

const ClusterManagement = () => {
    const { token } = useAuth();
    const [clusters, setClusters] = useState([]);
    const [drones, setDrones] = useState([]);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [newCluster, setNewCluster] = useState({ name: '', description: '', drones: [] });

    const fetchData = async () => {
        const [cRes, dRes] = await Promise.all([
            fetch('http://127.0.0.1:8000/api/clusters/', { headers: { 'Authorization': `Bearer ${token}` } }),
            fetch('http://127.0.0.1:8000/api/drones/', { headers: { 'Authorization': `Bearer ${token}` } })
        ]);
        if (cRes.ok) setClusters(await cRes.json());
        if (dRes.ok) setDrones(await dRes.json());
    };

    useEffect(() => {
        fetchData();
    }, [token]);

    const handleCreate = async (e) => {
        e.preventDefault();
        const res = await fetch('http://127.0.0.1:8000/api/clusters/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(newCluster)
        });
        if (res.ok) {
            fetchData();
            setIsCreateModalOpen(false);
            setNewCluster({ name: '', description: '', drones: [] });
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Xóa cụm này?")) return;
        const res = await fetch(`http://127.0.0.1:8000/api/clusters/${id}/`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) fetchData();
    };

    const toggleDroneInCluster = (droneId) => {
        const current = [...newCluster.drones];
        if (current.includes(droneId)) {
            setNewCluster({...newCluster, drones: current.filter(id => id !== droneId)});
        } else {
            setNewCluster({...newCluster, drones: [...current, droneId]});
        }
    };

    return (
        <div className="flex-1 bg-slate-950 p-8 overflow-y-auto">
            <div className="flex justify-between items-center mb-10">
                <div>
                    <h1 className="text-3xl font-black text-white">DRONE <span className="text-blue-500">CLUSTERS</span></h1>
                    <p className="text-slate-500 text-sm">Quản lý bầy đàn và điều khiển tập trung</p>
                </div>
                <button 
                    onClick={() => setIsCreateModalOpen(true)}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-2xl transition-all shadow-lg shadow-blue-600/20"
                >
                    <Plus size={20} /> Tạo Cụm Mới
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {clusters.map(cluster => (
                    <div key={cluster.id} className="bg-slate-900/50 border border-white/5 rounded-3xl p-8 hover:bg-slate-900 transition-all">
                        <div className="flex justify-between items-start mb-6">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 bg-blue-500/10 text-blue-500 rounded-2xl flex items-center justify-center">
                                    <Users size={30} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-white">{cluster.name}</h3>
                                    <p className="text-slate-500 text-sm italic">{cluster.description || 'Không có mô tả'}</p>
                                </div>
                            </div>
                            <button onClick={() => handleDelete(cluster.id)} className="text-slate-700 hover:text-red-500 transition-colors">
                                <Trash2 size={20} />
                            </button>
                        </div>

                        <div className="space-y-3 mb-8">
                            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Thành viên ({cluster.drone_details.length})</p>
                            <div className="flex flex-wrap gap-2">
                                {cluster.drone_details.map(d => (
                                    <div key={d.id} className="bg-slate-800 text-slate-300 px-3 py-1.5 rounded-lg text-xs border border-white/5 flex items-center gap-2">
                                        <div className={`h-1.5 w-1.5 rounded-full ${d.is_active ? 'bg-green-500' : 'bg-slate-600'}`}></div>
                                        {d.name}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <button className="flex-1 bg-blue-600/10 text-blue-400 hover:bg-blue-600 hover:text-white py-3 rounded-xl transition-all font-bold flex items-center justify-center gap-2">
                                <Play size={18} /> Chạy kịch bản cụm
                            </button>
                            <button className="bg-slate-800 p-3 rounded-xl text-slate-500 hover:text-white transition-colors">
                                <Info size={20} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {isCreateModalOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-white/10 w-full max-w-2xl rounded-3xl p-8 shadow-2xl">
                        <h2 className="text-2xl font-black text-white mb-6">TẠO <span className="text-blue-500">CỤM MỚI</span></h2>
                        <form onSubmit={handleCreate} className="grid grid-cols-2 gap-8">
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">Tên Cụm</label>
                                    <input 
                                        type="text" 
                                        className="w-full bg-slate-950 border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500"
                                        value={newCluster.name}
                                        onChange={e => setNewCluster({...newCluster, name: e.target.value})}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">Mô tả</label>
                                    <textarea 
                                        className="w-full bg-slate-950 border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 h-32"
                                        value={newCluster.description}
                                        onChange={e => setNewCluster({...newCluster, description: e.target.value})}
                                    ></textarea>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <label className="block text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">Chọn Drone ({newCluster.drones.length})</label>
                                <div className="h-64 overflow-y-auto pr-2 space-y-2 custom-scrollbar">
                                    {drones.map(d => (
                                        <div 
                                            key={d.id} 
                                            onClick={() => toggleDroneInCluster(d.id)}
                                            className={`p-3 rounded-xl border cursor-pointer transition-all flex justify-between items-center ${newCluster.drones.includes(d.id) ? 'border-blue-500 bg-blue-500/10' : 'border-white/5 bg-slate-950 hover:bg-slate-800'}`}
                                        >
                                            <span className={newCluster.drones.includes(d.id) ? 'text-blue-400' : 'text-slate-400'}>{d.name}</span>
                                            {newCluster.drones.includes(d.id) && <Plus className="rotate-45 text-blue-500" size={16} />}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="col-span-2 flex gap-4 pt-4">
                                <button type="button" onClick={() => setIsCreateModalOpen(false)} className="flex-1 bg-slate-800 text-slate-400 py-3 rounded-xl">Hủy</button>
                                <button type="submit" className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold">Hoàn tất tạo cụm</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ClusterManagement;
