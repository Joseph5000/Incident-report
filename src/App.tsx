/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Shield, List, History, Settings, Menu } from 'lucide-react';
import IncidentForm from './components/IncidentForm';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';

type ViewState = 'new' | 'history' | 'settings';

export default function App() {
  const [view, setViewState] = useState<ViewState>('new');
  const [sidebarOpen, setSidebarOpen] = useState(false);

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

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Mobile Header */}
      <header className="h-20 border-b border-slate-100 flex items-center px-6 sticky top-0 bg-white/80 backdrop-blur-md z-40">
        <button 
          onClick={() => setSidebarOpen(true)}
          className="p-2 text-slate-400 hover:text-slate-900 lg:hidden"
        >
          <Menu size={24} />
        </button>
        <div className="flex items-center justify-between w-full ml-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
              <Shield size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-800 tracking-tight">ShieldReport</h1>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Tactical Reporting System</p>
            </div>
          </div>
          
          <div className="hidden md:flex items-center gap-4">
            <div className="flex items-center bg-green-50 px-3 py-1.5 rounded-full border border-green-100">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
              <span className="text-[10px] font-bold text-green-700 uppercase tracking-tight">System Online • Local Sync Active</span>
            </div>
            <div className="text-right border-l border-slate-100 pl-4">
              <p className="text-xs font-bold text-slate-700">Officer Joseph</p>
              <p className="text-[10px] text-slate-400 tracking-wider">Badge #14492</p>
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
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60] lg:hidden"
            />
          )}
        </AnimatePresence>

        {/* Sidebar */}
        <aside className={cn(
          "fixed inset-y-0 left-0 w-20 bg-slate-900 z-[70] transition-transform lg:relative lg:translate-x-0 flex flex-col items-center py-8 space-y-8 shadow-2xl lg:shadow-none",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}>
          <div className="space-y-6 flex flex-col items-center">
            <button 
              onClick={() => { setViewState('new'); setSidebarOpen(false); }}
              className={cn(
                "p-3 rounded-xl transition-all",
                view === 'new' ? "bg-blue-600 text-white shadow-lg shadow-blue-900/50" : "text-slate-400 hover:text-white"
              )}
            >
              <Shield size={24} />
            </button>
            <button 
              onClick={() => { setViewState('history'); setSidebarOpen(false); }}
              className={cn(
                "p-3 rounded-xl transition-all",
                view === 'history' ? "bg-blue-600 text-white shadow-lg shadow-blue-900/50" : "text-slate-400 hover:text-white"
              )}
            >
              <History size={24} />
            </button>
            <button 
              onClick={() => { setViewState('settings'); setSidebarOpen(false); }}
              className={cn(
                "p-3 rounded-xl transition-all",
                view === 'settings' ? "bg-blue-600 text-white shadow-lg shadow-blue-900/50" : "text-slate-400 hover:text-white"
              )}
            >
              <Settings size={24} />
            </button>
          </div>

          <div className="mt-auto">
            <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-xs font-medium text-white border border-slate-700">JC</div>
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
              {view === 'new' && <IncidentForm />}
              {view === 'history' && (
                <div className="flex flex-col items-center justify-center h-full text-slate-300 space-y-4">
                  <List size={64} strokeWidth={1} />
                  <p className="font-bold text-xs tracking-[0.2em] uppercase text-slate-400">Archive Logs Empty</p>
                </div>
              )}
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
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
