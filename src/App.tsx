/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Shield, List, History, Settings, Menu, Wifi, WifiOff, RefreshCcw, Fingerprint, Lock, Unlock, AlertCircle, LogOut, Radio, Activity } from 'lucide-react';
import IncidentForm from './components/IncidentForm';
import ReportHistory from './components/ReportHistory';
import Login from './components/Login';
import TacticalFeed from './components/TacticalFeed';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { isBiometricsAvailable, authenticateBiometrics, registerBiometrics } from './services/biometricService';
import { UnitStatus } from './types';

type ViewState = 'feed' | 'new' | 'history' | 'settings';
type ConnectionStatus = 'online' | 'offline' | 'syncing';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(sessionStorage.getItem('shield_auth') === 'true');
  const [currentUser, setCurrentUser] = useState<{ badge: string; name: string } | null>(
    sessionStorage.getItem('shield_user') ? JSON.parse(sessionStorage.getItem('shield_user')!) : null
  );
  const [view, setViewState] = useState<ViewState>('feed');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [status, setStatus] = useState<ConnectionStatus>(navigator.onLine ? 'online' : 'offline');
  const [unitStatus, setUnitStatus] = useState<UnitStatus>('Available');
  const [isLocked, setIsLocked] = useState(false);
  const [biometricsActive, setBiometricsActive] = useState(localStorage.getItem('shield_biometrics') === 'true');
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    // Check if app should be locked on startup (after login)
    if (isAuthenticated && biometricsActive) {
      setIsLocked(true);
      handleUnlock();
    }
  }, [isAuthenticated]);

  const handleLogin = (badge: string) => {
    const user = { badge, name: "Officer Joseph" }; // In real app, name would come from badge lookup
    setIsAuthenticated(true);
    setCurrentUser(user);
    sessionStorage.setItem('shield_auth', 'true');
    sessionStorage.setItem('shield_user', JSON.stringify(user));
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentUser(null);
    sessionStorage.removeItem('shield_auth');
    sessionStorage.removeItem('shield_user');
  };

  const handleUnlock = async () => {
    try {
      const success = await authenticateBiometrics();
      if (success) {
        setIsLocked(false);
        setAuthError(null);
      } else {
        setAuthError("Tactical verification failed. Access denied.");
      }
    } catch (err) {
      if (err instanceof Error && err.message === 'BIOMETRIC_POLICY_RESTRICTION') {
        setAuthError("Iframe security policy is blocking biometrics. Please open ShieldReport in a new tab to authenticate.");
      } else {
        setAuthError("System authentication fault. Please retry signature verification.");
      }
    }
  };

  const toggleBiometrics = async () => {
    try {
      if (!biometricsActive) {
        const success = await registerBiometrics();
        if (success) {
          localStorage.setItem('shield_biometrics', 'true');
          setBiometricsActive(true);
          setAuthError(null);
        }
      } else {
        localStorage.setItem('shield_biometrics', 'false');
        setBiometricsActive(false);
      }
    } catch (err) {
      if (err instanceof Error && err.message === 'BIOMETRIC_POLICY_RESTRICTION') {
        setAuthError("Iframe security is blocking registration. Use the 'Open in new tab' button (top right) to enable hardware security.");
      }
    }
  };

  useEffect(() => {
    const handleOnline = () => {
      setStatus('syncing');
      // Simulate a brief sync period when reconnecting
      setTimeout(() => setStatus('online'), 2000);
    };
    const handleOffline = () => setStatus('offline');

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleManualSync = () => {
    if (status === 'offline') return;
    setStatus('syncing');
    setTimeout(() => setStatus('online'), 2500);
  };

  const StatusIndicator = ({ className }: { className?: string }) => (
    <AnimatePresence mode="wait">
      <motion.div 
        key={status}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        className={cn(
          "flex items-center px-4 py-2 rounded-full border transition-all shadow-sm",
          status === 'online' ? "bg-green-50 text-green-700 border-green-100" :
          status === 'offline' ? "bg-red-50 text-red-700 border-red-100" :
          "bg-blue-50 text-blue-700 border-blue-100",
          className
        )}
      >
        <div className={cn(
          "w-2 h-2 rounded-full mr-3 relative",
          status === 'online' ? "bg-green-500 animate-pulse" :
          status === 'offline' ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" :
          "bg-blue-500 animate-spin"
        )}>
          {status === 'offline' && <div className="absolute inset-0 bg-red-400 rounded-full animate-ping opacity-20" />}
        </div>
        <div className="flex items-center gap-2">
          {status === 'online' && <Wifi size={12} />}
          {status === 'offline' && <WifiOff size={12} />}
          {status === 'syncing' && <RefreshCcw size={12} className="animate-spin" />}
          <span className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">
            {status === 'online' ? "Online • Secured" : 
             status === 'offline' ? "Signal Lost • Local" : 
             "Syncing..."}
          </span>
        </div>
      </motion.div>
    </AnimatePresence>
  );

  const NavItem = ({ id, label, icon: Icon }: { id: ViewState, label: string, icon: any }) => (
    <button
      onClick={() => {
        setViewState(id);
        setSidebarOpen(false);
      }}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all",
        view === id 
          ? "bg-[#2563eb]/10 text-[#2563eb] border border-[#2563eb]/20" 
          : "text-gray-500 hover:text-white hover:bg-[#1a1c1e]"
      )}
    >
      <Icon size={18} />
      <span className="font-medium text-sm tracking-wide">{label}</span>
    </button>
  );

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Mobile Header */}
      <header className="h-20 border-b border-slate-100 flex items-center px-6 sticky top-0 bg-white/80 backdrop-blur-md z-[150]">
        <button 
          onClick={() => setSidebarOpen(true)}
          className="p-2 text-slate-400 hover:text-slate-900 lg:hidden"
        >
          <Menu size={24} />
        </button>
        <div className="flex items-center justify-between w-full ml-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
              <Shield size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-800 tracking-tight">ShieldReport</h1>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Tactical Reporting</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-100">
               <div className={cn(
                 "w-2 h-2 rounded-full",
                 unitStatus === 'Available' ? "bg-green-500 animate-pulse" :
                 unitStatus === 'En Route' ? "bg-blue-400" :
                 unitStatus === 'On Scene' ? "bg-amber-400" : "bg-red-400"
               )} />
               <span className="text-[10px] font-black uppercase text-slate-600 tracking-tight">{unitStatus}</span>
            </div>
            <div className="md:hidden">
              <StatusIndicator className="scale-75 origin-right" />
            </div>
            <div className="hidden md:flex items-center gap-4">
              <StatusIndicator />
              <div className="text-right border-l border-slate-100 pl-4 h-8 flex flex-col justify-center">
                <p className="text-xs font-bold text-slate-700">{currentUser?.name}</p>
                <p className="text-[10px] text-slate-400 tracking-wider">Badge #{currentUser?.badge}</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar Overlay */}
        <AnimatePresence>
          {sidebarOpen && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[190] lg:hidden"
            />
          )}
        </AnimatePresence>

        {/* Sidebar */}
        <aside className={cn(
          "fixed inset-y-0 left-0 w-24 bg-slate-900 z-[200] transition-transform lg:relative lg:translate-x-0 flex flex-col items-center py-8 space-y-10 shadow-2xl lg:shadow-none",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}>
          <div className="space-y-6 flex flex-col items-center">
            <button 
              onClick={() => { setViewState('feed'); setSidebarOpen(false); }}
              className={cn(
                "p-3 rounded-xl transition-all",
                view === 'feed' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-900/50" : "text-slate-400 hover:text-white"
              )}
              title="Tactical Feed"
            >
              <Radio size={24} />
            </button>
            <button 
              onClick={() => { setViewState('new'); setSidebarOpen(false); }}
              className={cn(
                "p-3 rounded-xl transition-all",
                view === 'new' ? "bg-blue-600 text-white shadow-lg shadow-blue-900/50" : "text-slate-400 hover:text-white"
              )}
              title="New Incident Report"
            >
              <Shield size={24} />
            </button>
            <button 
              onClick={() => { setViewState('history'); setSidebarOpen(false); }}
              className={cn(
                "p-3 rounded-xl transition-all",
                view === 'history' ? "bg-blue-600 text-white shadow-lg shadow-blue-900/50" : "text-slate-400 hover:text-white"
              )}
              title="Report History"
            >
              <History size={24} />
            </button>
          </div>

          <div className="space-y-6 flex flex-col items-center pt-8 border-t border-slate-800/50 w-full">
             <div className="flex flex-col gap-3">
                {(['Available', 'En Route', 'On Scene', 'Busy'] as UnitStatus[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => setUnitStatus(s)}
                    className={cn(
                      "w-3 h-3 rounded-full transition-all border",
                      unitStatus === s ? "scale-125 border-white shadow-[0_0_8px_currentColor]" : "border-transparent opacity-30 hover:opacity-100",
                      s === 'Available' ? "bg-green-500 text-green-500" :
                      s === 'En Route' ? "bg-blue-400 text-blue-400" :
                      s === 'On Scene' ? "bg-amber-400 text-amber-400" :
                      "bg-red-400 text-red-400"
                    )}
                    title={s}
                  />
                ))}
             </div>
             <div className="text-[8px] font-black text-slate-600 uppercase tracking-tighter vertical-text select-none">Status</div>
          </div>

          <div className="mt-auto space-y-4 flex flex-col items-center">
            <button 
              onClick={() => { setViewState('settings'); setSidebarOpen(false); }}
              className={cn(
                "p-3 rounded-xl transition-all",
                view === 'settings' ? "bg-blue-600 text-white shadow-lg shadow-blue-900/50" : "text-slate-400 hover:text-white"
              )}
              title="Settings"
            >
              <Settings size={24} />
            </button>
            <button 
              onClick={handleLogout}
              className="p-3 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
              title="Logout"
            >
              <LogOut size={24} />
            </button>
            <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-xs font-medium text-white border border-slate-700">
              {currentUser?.name.split(' ').map(n => n[0]).join('')}
            </div>
          </div>
        </aside>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto bg-slate-50 scrollbar-hide">
          <AnimatePresence mode="wait">
            <motion.div
              key={view}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="h-full"
            >
              {view === 'feed' && <TacticalFeed />}
              {view === 'new' && <IncidentForm />}
              {view === 'history' && <ReportHistory />}
              {view === 'settings' && (
                <div className="p-12 max-w-2xl mx-auto space-y-12">
                  <header>
                    <h2 className="text-2xl font-bold text-slate-800">Settings</h2>
                    <p className="text-slate-400 text-sm">Configure your tactical device interface and connectivity.</p>
                  </header>
                  
                  <section className="space-y-6">
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Hardware & Connectivity</h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
                        <div className="space-y-1">
                          <p className="text-sm font-bold text-slate-700">Force Data Synchronization</p>
                          <p className="text-xs text-slate-400">Manually push tactical logs to central server.</p>
                        </div>
                        <button 
                          onClick={handleManualSync}
                          disabled={status === 'offline' || status === 'syncing'}
                          className={cn(
                            "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                            status === 'offline' ? "bg-slate-100 text-slate-400 cursor-not-allowed" :
                            status === 'syncing' ? "bg-blue-50 text-blue-400" :
                            "bg-blue-600 text-white hover:bg-blue-700"
                          )}
                        >
                          {status === 'syncing' ? "Syncing..." : "Sync Now"}
                        </button>
                      </div>
                      <div className="flex items-center justify-between p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
                        <div className="space-y-1">
                          <p className="text-sm font-bold text-slate-700">Offline Mode Persistence</p>
                          <p className="text-xs text-slate-400">Stores data locally when signal is lost.</p>
                        </div>
                        <div className="w-12 h-6 bg-blue-600 rounded-full relative">
                          <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full shadow-md" />
                        </div>
                      </div>
                      <div className="flex items-center justify-between p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
                        <div className="space-y-1">
                          <p className="text-sm font-bold text-slate-700">Auto-EXIF Extraction</p>
                          <p className="text-xs text-slate-400">Automatically pull GPS from evidence photos.</p>
                        </div>
                        <div className="w-12 h-6 bg-blue-600 rounded-full relative">
                          <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full shadow-md" />
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className="space-y-6">
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Security & Biometrics</h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
                        <div className="space-y-1">
                          <p className="text-sm font-bold text-slate-700">Biometric Lock</p>
                          <p className="text-xs text-slate-400">Require Fingerprint/FaceID to access logs.</p>
                          {!isBiometricsAvailable() && (
                            <p className="text-[10px] text-red-500 font-bold uppercase tracking-tight">Hardware not supported</p>
                          )}
                          {authError && view === 'settings' && (
                            <p className="text-[10px] text-amber-600 font-bold uppercase tracking-tight flex items-center gap-1">
                              <AlertCircle size={10} />
                              {authError}
                            </p>
                          )}
                        </div>
                        <button 
                          onClick={toggleBiometrics}
                          disabled={!isBiometricsAvailable()}
                          className={cn(
                            "w-12 h-6 rounded-full relative transition-all",
                            biometricsActive ? "bg-blue-600" : "bg-slate-200",
                            !isBiometricsAvailable() && "opacity-50 cursor-not-allowed"
                          )}
                        >
                          <div className={cn(
                            "absolute top-1 w-4 h-4 bg-white rounded-full shadow-md transition-all",
                            biometricsActive ? "right-1" : "left-1"
                          )} />
                        </button>
                      </div>
                      
                      {biometricsActive && (
                        <button 
                          onClick={() => setIsLocked(true)}
                          className="w-full flex items-center justify-center gap-2 p-4 bg-slate-900 text-white rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg"
                        >
                          <Lock size={14} />
                          Secure Terminal Now
                        </button>
                      )}
                    </div>
                  </section>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* App Lock Overlay */}
      <AnimatePresence>
        {isLocked && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] bg-slate-900 flex flex-col items-center justify-center p-8 text-center"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="space-y-8 max-w-sm w-full"
            >
              <div className="w-24 h-24 bg-blue-600 rounded-[32px] flex items-center justify-center mx-auto shadow-[0_0_50px_rgba(37,99,235,0.3)] border border-blue-400/20">
                <Shield size={48} className="text-white" />
              </div>
              
              <div className="space-y-2">
                <h1 className="text-2xl font-black text-white tracking-tight uppercase">Terminal Locked</h1>
                <p className="text-slate-400 text-sm leading-relaxed">
                  ShieldReport Tactical v2.4 secured. <br />Please verify your identity to continue login.
                </p>
              </div>

              {authError && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-400 text-xs font-bold text-left">
                  <AlertCircle size={18} />
                  <span>{authError}</span>
                </div>
              )}

              <button 
                onClick={handleUnlock}
                className="w-full h-20 bg-blue-600 hover:bg-blue-700 text-white rounded-3xl font-black text-base uppercase tracking-[0.2em] transition-all shadow-2xl flex items-center justify-center gap-4 group active:scale-95"
              >
                <Fingerprint size={28} className="group-hover:scale-110 transition-transform" />
                Auth Scan
              </button>

              <div className="pt-12">
                <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">
                  End-to-End Encrypted Terminal
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
