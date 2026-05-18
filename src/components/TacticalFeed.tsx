/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, Bell, Radio, User, Car, Clock, ChevronRight, Zap, Shield, MapPin, Loader2, X, Info, ExternalLink, FileText } from 'lucide-react';
import { BoloAlert, TacticalFeedItem } from '../types';
import { cn } from '../lib/utils';
import { reverseGeocode } from '../lib/geocoding';
import { getAllBolos, getAllFeedItems, saveBolo, saveFeedItem } from '../lib/db';

export default function TacticalFeed() {
  const [location, setLocation] = useState<{lat: number, lon: number} | null>(null);
  const [areaInfo, setAreaInfo] = useState<{address: string, city: string, barangay: string} | null>(null);
  const [isLocating, setIsLocating] = useState(true);
  const [selectedBolo, setSelectedBolo] = useState<BoloAlert | null>(null);
  const [sectorSummary, setSectorSummary] = useState<string>('Syncing tactical data...');
  const [bolos, setBolos] = useState<BoloAlert[]>([]);
  const [feedItems, setFeedItems] = useState<TacticalFeedItem[]>([]);

  useEffect(() => {
    const loadTacticalData = async () => {
      let bData = await getAllBolos();
      let fData = await getAllFeedItems();

      const hasSeeded = localStorage.getItem('tactical_seeded');

      // Seed ONLY if it's the first time the app is run
      if (!hasSeeded) {
        if (bData.length === 0) {
          const seedBolos: BoloAlert[] = [
            {
              id: '1',
              type: 'Vehicle',
              title: 'Blue Sedan - Armed Suspect',
              description: 'Vehicle involved in armed robbery. Plate: ABC-123. Last seen heading North.',
              timestamp: new Date().toISOString(),
              priority: 'Emergency'
            },
            {
              id: '2',
              type: 'Person',
              title: 'Missing Elderly Female',
              description: '82yo female, white hair, last seen wearing red sweater.',
              timestamp: new Date().toISOString(),
              priority: 'High'
            }
          ];
          for (const b of seedBolos) await saveBolo(b);
          bData = seedBolos;
        }

        if (fData.length === 0) {
          const seedFeed: TacticalFeedItem[] = [
            { id: '1', type: 'Dispatch', content: 'Unit 402 responding to 10-31 Code 3 in South Sector.', timestamp: '10:45 AM' },
            { id: '2', type: 'Department', content: 'Shift briefing relocated to Central Precinct today.', timestamp: '09:30 AM' },
            { id: '3', type: 'BOLO', content: 'New BOLO issued for 2018 Silver Ford F150.', timestamp: '11:02 AM' }
          ];
          for (const f of seedFeed) await saveFeedItem(f);
          fData = seedFeed;
        }
        localStorage.setItem('tactical_seeded', 'true');
      }

      setBolos(bData);
      setFeedItems(fData);
    };
    loadTacticalData();
  }, []);

  useEffect(() => {
    const fetchSummary = async () => {
      if (bolos.length === 0 && feedItems.length === 0) {
        setSectorSummary('SITUATIONAL AWARENESS: No active tactical data for current sector. Signal parity normal.');
        return;
      }

      const emergencyBolos = bolos.filter(b => b.priority === 'Emergency');
      const highPriorityBolos = bolos.filter(b => b.priority === 'High');
      const dispatchItems = feedItems.filter(f => f.type === 'Dispatch');

      let summary = 'SITUATIONAL AWARENESS: ';
      
      if (emergencyBolos.length > 0) {
        summary += `CRITICAL: ${emergencyBolos.length} Emergency BOLO(s) active. Immediate tactical vigilance required. `;
      } else if (highPriorityBolos.length > 0) {
        summary += `${highPriorityBolos.length} High-priority targets identified in sector. `;
      } else {
        summary += `${bolos.length} Active BOLO(s) recorded. `;
      }

      if (dispatchItems.length > 0) {
        summary += `Sector radio traffic monitoring ${dispatchItems.length} active responses. `;
      }

      summary += `Current sector: ${areaInfo?.barangay || areaInfo?.city || 'Scanning...'}.`;

      setSectorSummary(summary);
    };
    
    fetchSummary();
  }, [areaInfo, bolos, feedItems]);

  useEffect(() => {
    if (!navigator.geolocation) {
      setIsLocating(false);
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setLocation({ lat: latitude, lon: longitude });
        setIsLocating(true);
        try {
          const data = await reverseGeocode(latitude, longitude);
          setAreaInfo(data);
        } catch (err) {
          console.error('Reverse Geocode error:', err);
        } finally {
          setIsLocating(false);
        }
      },
      (err) => {
        console.error('Geolocation error:', err);
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);


  return (
    <div className="p-4 md:p-12 max-w-5xl mx-auto space-y-12">
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-indigo-600 p-6 rounded-[32px] text-white shadow-xl shadow-indigo-900/20 relative overflow-hidden group border border-indigo-500"
      >
        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
          <Zap size={100} />
        </div>
        <div className="flex items-center gap-3 mb-2">
          <Shield size={16} className="text-white" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em]">Live Sector Intelligence</span>
        </div>
        <p className="text-lg font-black italic leading-tight tracking-tight max-w-2xl">
          {sectorSummary}
        </p>
      </motion.div>

      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h2 className="text-3xl font-black text-slate-800 uppercase tracking-tighter italic">Tactical Feed</h2>
          <div className="flex items-center gap-2">
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Real-time Intelligence & Ops Data</p>
            {areaInfo && (
              <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-[9px] font-black uppercase tracking-widest border border-blue-100">
                Local Sector Active
              </span>
            )}
          </div>
        </div>
        
        <div className="flex flex-col md:flex-row items-end md:items-center gap-4">
          <div className="text-right">
             <div className="flex items-center justify-end gap-2 text-slate-400">
               <MapPin size={12} className={isLocating ? "animate-bounce text-blue-500" : "text-blue-500"} />
               <span className="text-[10px] font-black uppercase tracking-widest">Current Sector</span>
             </div>
             <p className="text-sm font-bold text-slate-700">
               {isLocating ? "Acquiring Signal..." : areaInfo?.barangay || areaInfo?.city || "Unknown Sector"}
             </p>
             <p className="text-[9px] text-slate-400 font-medium tracking-tight">
               {location ? `${location.lat.toFixed(4)}, ${location.lon.toFixed(4)}` : "Coordinates Pending"}
             </p>
          </div>

          <div className="px-4 py-2 bg-slate-900 rounded-xl flex items-center gap-3 border border-slate-800 shadow-xl">
            <div className="relative">
              <div className="w-2 h-2 bg-red-500 rounded-full" />
              <div className="absolute inset-0 w-2 h-2 bg-red-500 rounded-full animate-ping" />
            </div>
            <span className="text-[10px] font-black text-white uppercase tracking-widest leading-none">Live Ops Feed</span>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Active BOLOs */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center gap-3">
            <AlertTriangle className="text-amber-500" size={18} />
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Active BOLO Alerts</h3>
          </div>
          
          <div className="space-y-4">
            {bolos.map((bolo) => (
              <motion.div 
                key={bolo.id}
                layoutId={`bolo-card-${bolo.id}`}
                whileHover={{ scale: 1.01 }}
                onClick={() => setSelectedBolo(bolo)}
                className={cn(
                  "p-6 rounded-[32px] border bg-white shadow-sm transition-all flex flex-col md:flex-row gap-6 cursor-pointer",
                  bolo.priority === 'Emergency' ? "border-red-100 bg-red-50/10" : "border-slate-100"
                )}
              >
                <div className={cn(
                  "w-16 h-16 rounded-2xl flex items-center justify-center shrink-0",
                  bolo.type === 'Vehicle' ? "bg-blue-100 text-blue-600" : "bg-purple-100 text-purple-600"
                )}>
                  {bolo.type === 'Vehicle' ? <Car size={32} /> : <User size={32} />}
                </div>
                
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className={cn(
                      "text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full",
                      bolo.priority === 'Emergency' ? "bg-red-500 text-white" : "bg-slate-100 text-slate-500"
                    )}>
                      {bolo.priority}
                    </span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter italic">
                      <Clock size={10} className="inline mr-1" />
                      {new Date(bolo.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <h4 className="text-lg font-black text-slate-800 leading-tight">{bolo.title}</h4>
                  <p className="text-sm text-slate-500 leading-relaxed font-medium">{bolo.description}</p>
                </div>

                <div className="flex items-center justify-center md:items-end md:justify-end">
                   <button className="p-4 bg-slate-50 rounded-2xl hover:bg-slate-100 text-slate-400 hover:text-slate-900 transition-all border border-slate-100">
                     <ChevronRight size={20} />
                   </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Radio Feed & Notifications */}
        <div className="space-y-8">
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <Radio className="text-blue-500" size={18} />
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Unit Activity</h3>
            </div>
            <div className="bg-slate-900 rounded-[32px] p-6 text-white shadow-2xl border border-slate-800 space-y-4">
               {feedItems.map((item) => (
                 <div key={item.id} className="flex gap-4 border-b border-slate-800/50 pb-4 last:border-0 last:pb-0">
                    <div className={cn(
                      "w-1 h-1 rounded-full mt-2 shrink-0",
                      item.type === 'Dispatch' ? "bg-blue-400" : 
                      item.type === 'BOLO' ? "bg-amber-400" : "bg-slate-400"
                    )} />
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{item.type}</span>
                        <span className="text-[10px] font-bold text-slate-600">{item.timestamp}</span>
                      </div>
                      <p className="text-sm font-medium leading-relaxed italic text-slate-300">{item.content}</p>
                    </div>
                 </div>
               ))}
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <Bell className="text-indigo-500" size={18} />
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Tactical Quick-Actions</h3>
            </div>
            <div className="grid grid-cols-1 gap-3">
              <button className="flex items-center gap-4 p-5 bg-white border border-slate-100 rounded-3xl hover:bg-slate-50 transition-all shadow-sm group">
                <div className="w-10 h-10 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
                  <Zap size={20} />
                </div>
                <div className="text-left">
                  <p className="text-xs font-black text-slate-800 uppercase tracking-tight">Rapid Pursuit Mode</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Enhanced GPS Frequency</p>
                </div>
              </button>
              <button className="flex items-center gap-4 p-5 bg-white border border-slate-100 rounded-3xl hover:bg-slate-50 transition-all shadow-sm group">
                <div className="w-10 h-10 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
                  <Shield size={20} />
                </div>
                <div className="text-left">
                  <p className="text-xs font-black text-slate-800 uppercase tracking-tight">Encrypted Upload</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Wipe Local Device Drafts</p>
                </div>
              </button>
            </div>
          </section>
        </div>
      </div>
      <AnimatePresence>
        {selectedBolo && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedBolo(null)}
              className="absolute inset-0 bg-slate-900/80 backdrop-blur-md"
            />
            
            <motion.div 
              layoutId={`bolo-card-${selectedBolo.id}`}
              className="relative w-full max-w-2xl bg-white rounded-[40px] shadow-2xl overflow-hidden flex flex-col"
            >
              <div className={cn(
                "h-3 w-full",
                selectedBolo.priority === 'Emergency' ? "bg-red-500" : "bg-amber-500"
              )} />
              
              <div className="p-8 md:p-12 space-y-8 overflow-y-auto max-h-[85vh]">
                <div className="flex items-start justify-between">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <span className={cn(
                        "text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full",
                        selectedBolo.priority === 'Emergency' ? "bg-red-500 text-white" : "bg-amber-100 text-amber-700"
                      )}>
                        {selectedBolo.priority} Priority
                      </span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <Clock size={12} />
                        Issued {new Date(selectedBolo.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <h3 className="text-3xl font-black text-slate-800 leading-tight uppercase tracking-tighter italic">
                      {selectedBolo.title}
                    </h3>
                  </div>
                  <button 
                    onClick={() => setSelectedBolo(null)}
                    className="p-3 bg-slate-50 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-2xl transition-all"
                  >
                    <X size={24} />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-6 bg-slate-50 rounded-3xl space-y-2 border border-slate-100/50">
                    <div className="flex items-center gap-2 text-slate-400">
                      <Info size={14} />
                      <span className="text-[10px] font-black uppercase tracking-widest">Type</span>
                    </div>
                    <p className="font-black text-slate-900 text-lg">{selectedBolo.type}</p>
                  </div>
                  <div className="p-6 bg-slate-50 rounded-3xl space-y-2 border border-slate-100/50">
                    <div className="flex items-center gap-2 text-slate-400">
                      <MapPin size={14} />
                      <span className="text-[10px] font-black uppercase tracking-widest">Last Known Area</span>
                    </div>
                    <p className="font-black text-slate-900 text-lg">{areaInfo?.barangay || 'Sector 7'}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <h5 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                    <FileText size={12} className="text-slate-400" />
                    Detailed Intelligence Report
                  </h5>
                  <div className="p-8 bg-slate-900 text-slate-200 rounded-[32px] font-medium leading-relaxed italic border border-slate-800 shadow-inner">
                    "{selectedBolo.description}"
                    <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between">
                      <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Dispatch Verified</span>
                      <Shield size={16} className="text-blue-500" />
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex flex-col md:flex-row gap-4">
                  <button className="flex-1 py-5 bg-slate-900 text-white rounded-3xl font-black uppercase tracking-widest text-[11px] shadow-xl hover:bg-slate-800 transition-all flex items-center justify-center gap-3">
                    <ExternalLink size={16} /> Mark as Identifying
                  </button>
                  <button className="flex-1 py-5 bg-red-600 text-white rounded-3xl font-black uppercase tracking-widest text-[11px] shadow-xl hover:bg-red-500 transition-all flex items-center justify-center gap-3">
                    <AlertTriangle size={16} /> Broadcast Arrival
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
