import React, { useState } from 'react';
import { useAuth } from '../hooks/AuthContext';
import { Lock, User, Mail, ArrowRight } from 'lucide-react';

const AuthPage = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [formData, setFormData] = useState({ username: '', password: '', email: '' });
    const [error, setError] = useState('');
    const { login } = useAuth();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        const endpoint = isLogin ? '/api/auth/login/' : '/api/auth/register/';
        
        try {
            const response = await fetch(`http://127.0.0.1:8000${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            const data = await response.json();
            
            if (response.ok) {
                if (isLogin) {
                    login(data.access);
                } else {
                    setIsLogin(true);
                    alert("Đăng ký thành công! Vui lòng đăng nhập.");
                }
            } else {
                setError(data.error || data.detail || "Đã có lỗi xảy ra");
            }
        } catch (err) {
            setError("Không thể kết nối tới server");
        }
    };

    return (
        <div className="w-full h-full flex items-center justify-center bg-slate-950 p-6">
            <div className="w-full max-w-md p-8 bg-slate-900/50 backdrop-blur-2xl rounded-3xl border border-white/5 shadow-2xl">
                <div className="text-center mb-10">
                    <h1 className="text-3xl font-black text-white tracking-tight">
                        DRONE <span className="text-blue-500">SYSTEM</span>
                    </h1>
                    <p className="text-slate-500 text-sm mt-2">
                        {isLogin ? 'Đăng nhập để điều khiển drone của bạn' : 'Tạo tài khoản mới để bắt đầu'}
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <div className="relative">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                        <input 
                            type="text" 
                            placeholder="Tên đăng nhập"
                            className="w-full bg-slate-800/50 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-blue-500/50 transition-all"
                            value={formData.username}
                            onChange={(e) => setFormData({...formData, username: e.target.value})}
                            required
                        />
                    </div>

                    {!isLogin && (
                        <div className="relative">
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                            <input 
                                type="email" 
                                placeholder="Email (Tùy chọn)"
                                className="w-full bg-slate-800/50 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-blue-500/50 transition-all"
                                value={formData.email}
                                onChange={(e) => setFormData({...formData, email: e.target.value})}
                            />
                        </div>
                    )}

                    <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                        <input 
                            type="password" 
                            placeholder="Mật khẩu"
                            className="w-full bg-slate-800/50 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-blue-500/50 transition-all"
                            value={formData.password}
                            onChange={(e) => setFormData({...formData, password: e.target.value})}
                            required
                        />
                    </div>

                    {error && <p className="text-red-400 text-xs pl-2">{error}</p>}

                    <button className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-2xl mt-4 flex items-center justify-center gap-2 transition-all group">
                        {isLogin ? 'Đăng nhập' : 'Đăng ký'}
                        <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                    </button>
                </form>

                <div className="mt-8 text-center">
                    <button 
                        onClick={() => setIsLogin(!isLogin)}
                        className="text-slate-500 text-sm hover:text-blue-400 transition-colors"
                    >
                        {isLogin ? 'Chưa có tài khoản? Đăng ký ngay' : 'Đã có tài khoản? Đăng nhập'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AuthPage;
