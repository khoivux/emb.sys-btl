import React from 'react';
import { useAuth } from '../hooks/AuthContext';
import { User, Mail, Shield, Calendar, Key, ShieldCheck } from 'lucide-react';

const ProfilePage = () => {
    const { user } = useAuth();

    return (
        <div className="flex-1 bg-slate-950 p-8 flex items-center justify-center">
            <div className="w-full max-w-2xl bg-slate-900 border border-white/5 rounded-[40px] overflow-hidden shadow-2xl">
                <div className="bg-gradient-to-br from-blue-600 to-blue-800 p-12 text-center relative">
                    <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
                        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent"></div>
                    </div>
                    
                    <div className="w-32 h-32 bg-white/20 backdrop-blur-xl rounded-[40px] flex items-center justify-center mx-auto mb-6 shadow-2xl border border-white/20 relative">
                        <User className="text-white" size={64} />
                        {user?.isAdmin && (
                            <div className="absolute -bottom-2 -right-2 bg-yellow-500 text-slate-900 p-2 rounded-xl shadow-lg border-4 border-blue-700">
                                <ShieldCheck size={20} />
                            </div>
                        )}
                    </div>
                    
                    <h2 className="text-3xl font-black text-white uppercase tracking-tight">{user?.username}</h2>
                    <p className="text-blue-100/60 text-sm font-medium mt-1">{user?.isAdmin ? 'Hệ thống Quản trị viên' : 'Người dùng tiêu chuẩn'}</p>
                </div>

                <div className="p-12 space-y-8">
                    <div className="grid grid-cols-2 gap-6">
                        <div className="bg-slate-950/50 p-6 rounded-3xl border border-white/5">
                            <div className="flex items-center gap-3 text-slate-500 mb-2">
                                <Mail size={16} />
                                <span className="text-[10px] font-bold uppercase tracking-widest">Email</span>
                            </div>
                            <p className="text-white font-medium">{user?.email || 'Chưa cập nhật'}</p>
                        </div>
                        <div className="bg-slate-950/50 p-6 rounded-3xl border border-white/5">
                            <div className="flex items-center gap-3 text-slate-500 mb-2">
                                <Shield size={16} />
                                <span className="text-[10px] font-bold uppercase tracking-widest">Vai trò</span>
                            </div>
                            <p className="text-white font-medium">{user?.isAdmin ? 'Administrator' : 'Standard User'}</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <button className="w-full flex items-center justify-between bg-slate-950 hover:bg-slate-800 p-6 rounded-3xl border border-white/5 transition-all group">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-blue-500/10 text-blue-500 rounded-2xl group-hover:bg-blue-500 group-hover:text-white transition-all">
                                    <Key size={20} />
                                </div>
                                <div className="text-left">
                                    <p className="text-white font-bold">Đổi mật khẩu</p>
                                    <p className="text-slate-500 text-xs">Cập nhật mật khẩu bảo mật mới</p>
                                </div>
                            </div>
                        </button>
                    </div>

                    <div className="pt-4 text-center">
                        <p className="text-slate-600 text-[10px] uppercase tracking-[0.2em]">Hệ thống bảo mật bởi Antigravity Encryption</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProfilePage;
