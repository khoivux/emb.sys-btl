import React, { useState, useEffect, useCallback } from 'react';
import MapView from './components/MapView.jsx';
import ControlPanel from './components/ControlPanel.jsx';
import FormationScheduler from './components/FormationScheduler.jsx';
import MissionScheduler from './components/MissionScheduler.jsx';
import AuthPage from './components/AuthPage.jsx';
import AdminDashboard from './components/AdminDashboard.jsx';
import DroneManagement from './components/DroneManagement.jsx';
import ClusterManagement from './components/ClusterManagement.jsx';
import ProfilePage from './components/ProfilePage.jsx';
import DiscoveryTab from './components/DiscoveryTab.jsx';
import { useDroneSocket } from './hooks/useDroneSocket.js';
import { AuthProvider, useAuth } from './hooks/AuthContext.jsx';
import { Settings, LogOut, Map as MapIcon, Box, Users, User as UserIcon, Radar, ClipboardList, CalendarClock } from 'lucide-react';

function Dashboard() {
  const { drones, discoveredDrones, setDiscoveredDrones, sendCommand, isConnected } = useDroneSocket();
  const { user, token, logout } = useAuth();
  const [isAdminPanel, setIsAdminPanel] = useState(() => localStorage.getItem('isAdminPanel') === 'true');
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('activeTab') || 'map');

  // Formation mode state
  const [formationMode, setFormationMode] = useState(false);
  const [selectedDrones, setSelectedDrones] = useState([]);
  const [ghostPositions, setGhostPositions] = useState([]);
  const [showLabels, setShowLabels] = useState(true);
  const [targetCenter, setTargetCenter] = useState(null);

  // Mission Scheduler mode
  const [missionSchedulerOpen, setMissionSchedulerOpen] = useState(false);
  const [missionClickEvent, setMissionClickEvent] = useState(null);

  useEffect(() => {
    localStorage.setItem('activeTab', activeTab);
    localStorage.setItem('isAdminPanel', isAdminPanel);
  }, [activeTab, isAdminPanel]);

  // Default to Admin Panel if admin and not set yet
  useEffect(() => {
    if (user?.isAdmin && localStorage.getItem('isAdminPanel') === null) {
        setIsAdminPanel(true);
    }
  }, [user]);

  // Toggle chọn drone
  const handleDroneSelect = useCallback((droneId) => {
    setSelectedDrones(prev =>
      prev.includes(droneId)
        ? prev.filter(id => id !== droneId)
        : [...prev, droneId]
    );
  }, []);

  // Hủy formation mode
  const handleCancelFormation = useCallback(() => {
    setFormationMode(false);
    setSelectedDrones([]);
    setGhostPositions([]);
    setTargetCenter(null);
  }, []);

  // Thực thi gửi lệnh GOTO hàng loạt
  const handleExecuteFormation = useCallback(async (positions) => {
    const t0 = performance.now();
    console.log(`⏱️ [FORMATION] Click Thực thi lúc ${new Date().toISOString()} — ${positions.length} drones`);

    const hostname = window.location.hostname;
    const targets = positions.map(p => ({
      drone_id: p.droneId,
      lat: p.targetLat,
      lng: p.targetLng,
    }));

    try {
      const tFetch = performance.now();
      console.log(`⏱️ [FORMATION] Bắt đầu gọi API sau ${(tFetch - t0).toFixed(0)}ms`);

      const res = await fetch(`http://${hostname}:8000/api/drones/formation/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({ targets }),
      });
      const data = await res.json();

      const tDone = performance.now();
      console.log(`✅ [FORMATION] Backend phản hồi sau ${(tDone - tFetch).toFixed(0)}ms (tổng: ${(tDone - t0).toFixed(0)}ms)`, data);

      // Thoát formation mode sau khi gửi thành công
      handleCancelFormation();
    } catch (err) {
      const tErr = performance.now();
      console.error(`❌ [FORMATION] Lỗi sau ${(tErr - t0).toFixed(0)}ms:`, err);
      alert('Lỗi gửi lệnh đội hình: ' + err.message);
    }
  }, [token, handleCancelFormation]);

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
                        <MapView
                          drones={drones}
                          selectionMode={formationMode}
                          selectedDrones={selectedDrones}
                          onDroneSelect={handleDroneSelect}
                          ghostPositions={ghostPositions}
                          showLabels={showLabels}
                          targetCenter={targetCenter}
                          onMapClick={(latlng) => {
                            if (formationMode) setTargetCenter(latlng);
                            if (missionSchedulerOpen) setMissionClickEvent({ lat: latlng.lat, lng: latlng.lng, ts: Date.now() });
                          }}
                        />

                        {/* Map View Controls: Nút Lên lịch, Đặt lịch bay, Ẩn/Hiện tên */}
                        <div className="absolute top-4 left-4 z-20 flex gap-4">
                          {!formationMode && !missionSchedulerOpen && (
                            <>
                              <button
                                onClick={() => setFormationMode(true)}
                                className="flex items-center gap-2 px-4 py-2.5 bg-slate-900/80 backdrop-blur-md hover:bg-slate-800/90 text-white rounded-xl border border-white/10 shadow-lg transition-all hover:shadow-xl hover:border-white/20 text-sm font-medium"
                              >
                                <ClipboardList size={18} className="text-blue-400" />
                                Lên lịch
                              </button>
                              <button
                                onClick={() => setMissionSchedulerOpen(true)}
                                className="flex items-center gap-2 px-4 py-2.5 bg-slate-900/80 backdrop-blur-md hover:bg-slate-800/90 text-white rounded-xl border border-white/10 shadow-lg transition-all hover:shadow-xl hover:border-white/20 text-sm font-medium"
                              >
                                <CalendarClock size={18} className="text-purple-400" />
                                Đặt Lịch Bay
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => setShowLabels(!showLabels)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border backdrop-blur-md transition-all shadow-lg ${
                              showLabels 
                                ? 'bg-blue-600/90 text-white border-blue-500 shadow-blue-900/20' 
                                : 'bg-slate-900/80 text-slate-400 border-white/5 hover:bg-slate-800/90 hover:text-slate-200'
                            }`}
                            title="Bật/Tắt nhãn tên drone trên bản đồ"
                          >
                            <span className={`w-2 h-2 rounded-full ${showLabels ? 'bg-white' : 'bg-slate-500'}`}></span>
                            {showLabels ? 'Đang hiện tên' : 'Đã ẩn tên'}
                          </button>
                        </div>

                        {/* Formation Scheduler (thay ControlPanel khi bật) */}
                        {formationMode ? (
                          <FormationScheduler
                            drones={drones}
                            selectedDrones={selectedDrones}
                            onDroneSelect={handleDroneSelect}
                            onCancel={handleCancelFormation}
                            onGhostPositions={setGhostPositions}
                            onExecute={handleExecuteFormation}
                            targetCenter={targetCenter}
                          />
                        ) : (
                          <ControlPanel drones={drones} onCommand={sendCommand} isConnected={isConnected} />
                        )}

                        {/* Mission Scheduler độc lập */}
                        {missionSchedulerOpen && !formationMode && (
                          <MissionScheduler
                            drones={drones}
                            token={token}
                            onClose={() => {
                              setGhostPositions([]);
                              setMissionSchedulerOpen(false);
                            }}
                            mapClickEvent={missionClickEvent}
                            onGhostPositions={setGhostPositions}
                          />
                        )}
                    </>
                )}
                {activeTab === 'discovery' && <DiscoveryTab discoveredDrones={discoveredDrones} setDiscoveredDrones={setDiscoveredDrones} />}
                {activeTab === 'drones' && <DroneManagement drones={drones} />}
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
