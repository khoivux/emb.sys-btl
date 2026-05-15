import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/AuthContext';
import { Users, LayoutDashboard, Database, Activity, Trash2, ShieldCheck } from 'lucide-react';

const AdminDashboard = () => {
    const { token } = useAuth();
    const [stats, setStats] = useState(null);
    const [users, setUsers] = useState([]);
    const [view, setView] = useState('stats'); // 'stats' or 'users'

    useEffect(() => {
        const fetchData = async () => {
            const headers = { 'Authorization': `Bearer ${token}` };
            
            // Fetch Stats
            const statsRes = await fetch('http://127.0.0.1:8000/api/drones/stats/', { headers });
            if (statsRes.ok) setStats(await statsRes.json());

            const usersRes = await fetch('http://127.0.0.1:8000/api/users/', { headers });
            if (usersRes.ok) setUsers(await usersRes.json());
        };
        fetchData();
    }, [token]);

    const deleteUser = async (id) => {
        if (!window.confirm("Bạn có chắc chắn muốn xóa người dùng này?")) return;
        const res = await fetch(`http://127.0.0.1:8000/api/users/${id}/`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) setUsers(users.filter(u => u.id !== id));
    };

    return (
        <div className="flex-1 bg-slate-950 p-8 overflow-y-auto">
            <div className="flex justify-between items-center mb-10">
                <div>
                    <h1 className="text-3xl font-black text-white">ADMIN <span className="text-blue-500">PANEL</span></h1>
                    <p className="text-slate-500 text-sm">Hệ thống quản lý người dùng và thiết bị tập trung</p>
                </div>
                
                <div className="flex bg-slate-900 rounded-2xl p-1 border border-white/5">
                    <button 
                        onClick={() => setView('stats')}
                        className={`flex items-center gap-2 px-6 py-3 rounded-xl transition-all ${view === 'stats' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        <LayoutDashboard size={18} /> Thống kê
                    </button>
                    <button 
                        onClick={() => setView('users')}
                        className={`flex items-center gap-2 px-6 py-3 rounded-xl transition-all ${view === 'users' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        <Users size={18} /> Người dùng
                    </button>
                </div>
            </div>

            {view === 'stats' && stats && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-slate-900/50 p-8 rounded-3xl border border-white/5 shadow-xl">
                        <Database className="text-blue-500 mb-4" size={32} />
                        <span className="text-4xl font-black text-white">{stats.total_drones}</span>
                        <p className="text-slate-500 text-sm mt-1 uppercase tracking-widest">Tổng số Drone</p>
                    </div>
                    <div className="bg-slate-900/50 p-8 rounded-3xl border border-white/5 shadow-xl">
                        <Activity className="text-green-500 mb-4" size={32} />
                        <span className="text-4xl font-black text-white">{stats.active_drones}</span>
                        <p className="text-slate-500 text-sm mt-1 uppercase tracking-widest">Đang hoạt động</p>
                    </div>
                    <div className="bg-slate-900/50 p-8 rounded-3xl border border-white/5 shadow-xl">
                        <Users className="text-purple-500 mb-4" size={32} />
                        <span className="text-4xl font-black text-white">{stats.total_users}</span>
                        <p className="text-slate-500 text-sm mt-1 uppercase tracking-widest">Người dùng</p>
                    </div>

                    <div className="md:col-span-3 bg-slate-900/50 p-8 rounded-3xl border border-white/5 mt-4">
                        <h3 className="text-xl font-bold text-white mb-6">Thống kê Drone theo User</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            {stats.user_breakdown.map((u, i) => (
                                <div key={i} className="bg-slate-800/30 p-4 rounded-2xl border border-white/5 flex justify-between items-center">
                                    <span className="text-slate-300 font-medium">{u.username}</span>
                                    <span className="bg-blue-500/20 text-blue-400 px-3 py-1 rounded-lg text-xs font-bold">{u.drone_count} Drone</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {view === 'users' && (
                <div className="bg-slate-900/50 rounded-3xl border border-white/5 overflow-hidden shadow-xl">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-white/5 text-slate-400 text-xs uppercase tracking-widest">
                                <th className="px-8 py-6">User</th>
                                <th className="px-8 py-6">Email</th>
                                <th className="px-8 py-6">Quyền hạn</th>
                                <th className="px-8 py-6">Ngày tham gia</th>
                                <th className="px-8 py-6 text-right">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {users.map(u => (
                                <tr key={u.id} className="hover:bg-white/5 transition-colors group">
                                    <td className="px-8 py-5 text-white font-bold">{u.username}</td>
                                    <td className="px-8 py-5 text-slate-400">{u.email || 'N/A'}</td>
                                    <td className="px-8 py-5">
                                        {u.is_staff ? (
                                            <span className="flex items-center gap-1 text-blue-400 text-xs font-bold">
                                                <ShieldCheck size={14} /> ADMIN
                                            </span>
                                        ) : (
                                            <span className="text-slate-500 text-xs font-bold">USER</span>
                                        )}
                                    </td>
                                    <td className="px-8 py-5 text-slate-500 text-sm">
                                        {new Date(u.date_joined).toLocaleDateString()}
                                    </td>
                                    <td className="px-8 py-5 text-right">
                                        <button 
                                            onClick={() => deleteUser(u.id)}
                                            className="p-2 text-slate-600 hover:text-red-500 transition-colors"
                                            disabled={u.is_staff}
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default AdminDashboard;
