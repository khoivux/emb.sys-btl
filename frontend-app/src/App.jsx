import React, { useState } from 'react';
import MapView from './components/MapView.jsx';
import ControlPanel from './components/ControlPanel.jsx';
import AuthPage from './components/AuthPage.jsx';
import AdminDashboard from './components/AdminDashboard.jsx';
import DroneManagement from './components/DroneManagement.jsx';
import ClusterManagement from './components/ClusterManagement.jsx';
import ProfilePage from './components/ProfilePage.jsx';
import DiscoveryTab from './components/DiscoveryTab.jsx';
import { useDroneSocket } from './hooks/useDroneSocket.js';
import { AuthProvider, useAuth } from './hooks/AuthContext.jsx';
import { Settings, LogOut, Map as MapIcon, Box, Users, User as UserIcon, Radar } from 'lucide-react';

function Dashboard() {
  const { drones, discoveredDrones, setDiscoveredDrones, sendCommand, isConnected } = useDroneSocket();
  const { user, logout } = useAuth();
  const [isAdminPanel, setIsAdminPanel] = useState(false);
  const [activeTab, setActiveTab] = useState('map'); // 'map', 'drones', 'clusters', 'profile', 'discovery'

  // Default to Admin Panel if admin
  React.useEffect(() => {
    if (user?.isAdmin) {
        setIsAdminPanel(true);
    }
  }, [user]);

  return (
    <div className="relative w-screen h-screen bg-slate-950 overflow-hidden flex font-sans text-slate-200">
      
      {/* Sidebar */}
      <div className="w-20 bg-slate-900 border-r border-white/5 flex flex-col items-center py-8 gap-10 z-50">
          <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-900/20">
              <Box className="text-white" size={28} />
          </div>

          <div className="flex flex-col gap-6 flex-1">
              <button 
                onClick={() => { setActiveTab('map'); setIsAdminPanel(false); }}
                className={`p-3 rounded-xl transition-all ${activeTab === 'map' && !isAdminPanel ? 'bg-blue-600/20 text-blue-400' : 'text-slate-500 hover:bg-white/5 hover:text-slate-300'}`}
                title="Bản đồ"
              >
                  <MapIcon size={24} />
              </button>
              <button 
                onClick={() => { setActiveTab('discovery'); setIsAdminPanel(false); }}
                className={`p-3 rounded-xl transition-all ${activeTab === 'discovery' ? 'bg-blue-600/20 text-blue-400' : 'text-slate-500 hover:bg-white/5 hover:text-slate-300'}`}
                title="Quét thiết bị"
              >
                  <Radar size={24} className={discoveredDrones.length > 0 ? 'animate-pulse text-blue-500' : ''} />
              </button>
              <button 
                onClick={() => { setActiveTab('drones'); setIsAdminPanel(false); }}
                className={`p-3 rounded-xl transition-all ${activeTab === 'drones' ? 'bg-blue-600/20 text-blue-400' : 'text-slate-500 hover:bg-white/5 hover:text-slate-300'}`}
                title="Quản lý Drone"
              >
                  <Box size={24} />
              </button>
              <button 
                onClick={() => { setActiveTab('clusters'); setIsAdminPanel(false); }}
                className={`p-3 rounded-xl transition-all ${activeTab === 'clusters' ? 'bg-blue-600/20 text-blue-400' : 'text-slate-500 hover:bg-white/5 hover:text-slate-300'}`}
                title="Quản lý Cụm"
              >
                  <Users size={24} />
              </button>
              <button 
                onClick={() => { setActiveTab('profile'); setIsAdminPanel(false); }}
                className={`p-3 rounded-xl transition-all ${activeTab === 'profile' ? 'bg-blue-600/20 text-blue-400' : 'text-slate-500 hover:bg-white/5 hover:text-slate-300'}`}
                title="Tài khoản"
              >
                  <UserIcon size={24} />
              </button>
          </div>

          <div className="flex flex-col gap-4">
              {user?.isAdmin && (
                <button 
                    onClick={() => setIsAdminPanel(!isAdminPanel)}
                    className={`p-3 rounded-xl transition-all ${isAdminPanel ? 'bg-blue-600 text-white' : 'text-slate-600 hover:text-slate-400'}`}
                >
                    <Settings size={24} />
                </button>
              )}
              <button onClick={logout} className="p-3 text-slate-600 hover:text-red-400 transition-colors">
                  <LogOut size={24} />
              </button>
          </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 relative flex overflow-hidden">
        {isAdminPanel && user?.isAdmin ? (
            <AdminDashboard />
        ) : (
            <>
                {activeTab === 'map' && (
                    <>
                        <MapView drones={drones} />
                        <ControlPanel drones={drones} onCommand={sendCommand} isConnected={isConnected} />
                    </>
                )}
                {activeTab === 'discovery' && <DiscoveryTab discoveredDrones={discoveredDrones} setDiscoveredDrones={setDiscoveredDrones} />}
                {activeTab === 'drones' && <DroneManagement />}
                {activeTab === 'clusters' && <ClusterManagement />}
                {activeTab === 'profile' && <ProfilePage />}

                {/* Bottom Status Bar - Only show on Map */}
                {activeTab === 'map' && (
                    <div className="absolute bottom-6 left-6 right-6 h-12 bg-slate-900/60 backdrop-blur-xl rounded-2xl border border-white/5 shadow-2xl flex items-center px-6 justify-between text-slate-400 text-xs z-10">
                        <div className="flex gap-6">
                            <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                                <span>SYSTEM: {isConnected ? 'CONNECTED' : 'DISCONNECTED'}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span>USER: {user?.username ? user.username.toUpperCase() : 'LOADING...'}</span>
                            </div>
                        </div>
                        <div>
                            <span>PTIT UNIVERSITY - EMBEDDED SYSTEMS PROJECT</span>
                        </div>
                    </div>
                )}
            </>
        )}
      </div>
    </div>
  );
}

function AppContent() {
  const { token } = useAuth();
  return token ? <Dashboard /> : <AuthPage />;
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
