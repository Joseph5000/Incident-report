/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShieldAlert, 
  Radio, 
  Trash2, 
  Plus, 
  X, 
  Check, 
  AlertTriangle, 
  User, 
  Car, 
  Clock, 
  FileText,
  Search,
  LayoutDashboard
} from 'lucide-react';
import { BoloAlert, TacticalFeedItem, User as UserType, IncidentReport, AuditLog } from '../types';
import { 
  getAllBolos, 
  getAllFeedItems, 
  saveBolo, 
  saveFeedItem, 
  deleteBolo, 
  deleteFeedItem,
  getAllReports,
  saveAuditLog,
  getAllAuditLogs
} from '../lib/db';
import { cn } from '../lib/utils';
import { format } from 'date-fns';

interface AdminPanelProps {
  currentUser: UserType | null;
}

export default function AdminPanel({ currentUser }: AdminPanelProps) {
  const [bolos, setBolos] = useState<BoloAlert[]>([]);
  const [feedItems, setFeedItems] = useState<TacticalFeedItem[]>([]);
  const [allReports, setAllReports] = useState<IncidentReport[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [activeTab, setActiveTab] = useState<'feed' | 'reports' | 'logs'>('feed');
  const [showAddBolo, setShowAddBolo] = useState(false);
  const [showAddFeed, setShowAddFeed] = useState(false);
  const [newBolo, setNewBolo] = useState<Partial<BoloAlert>>({
    type: 'Person',
    priority: 'Medium'
  });
  const [newFeed, setNewFeed] = useState<Partial<TacticalFeedItem>>({
    type: 'Dispatch'
  });
  const [itemToDelete, setItemToDelete] = useState<{ id: string, type: 'BOLO' | 'FEED', title?: string } | null>(null);

  const loadData = async () => {
    const bData = await getAllBolos();
    const fData = await getAllFeedItems();
    const rData = await getAllReports();
    const lData = await getAllAuditLogs();
    setBolos(bData);
    setFeedItems(fData);
    setAuditLogs(lData.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
    setAllReports(rData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddBolo = async () => {
    const bolo: BoloAlert = {
      ...newBolo as BoloAlert,
      id: Math.random().toString(36).substring(7),
      timestamp: new Date().toISOString(),
    };
    await saveBolo(bolo);
    
    // Log
    await saveAuditLog({
      id: Math.random().toString(36).substring(7),
      action: 'CREATE',
      entityType: 'BOLO',
      entityId: bolo.id,
      details: `Created BOLO: ${bolo.title}`,
      performedBy: currentUser?.badgeNumber || 'System',
      timestamp: new Date().toISOString()
    });

    setShowAddBolo(false);
    setNewBolo({ type: 'Person', priority: 'Medium' });
    loadData();
  };

  const handleAddFeed = async () => {
    const item: TacticalFeedItem = {
      ...newFeed as TacticalFeedItem,
      id: Math.random().toString(36).substring(7),
      timestamp: format(new Date(), 'HH:mm aaa'),
    };
    await saveFeedItem(item);
    
    // Log
    await saveAuditLog({
      id: Math.random().toString(36).substring(7),
      action: 'CREATE',
      entityType: 'FEED',
      entityId: item.id,
      details: `Created Feed Item: ${item.content.substring(0, 30)}...`,
      performedBy: currentUser?.badgeNumber || 'System',
      timestamp: new Date().toISOString()
    });

    setShowAddFeed(false);
    setNewFeed({ type: 'Dispatch' });
    loadData();
  };

  const handleDeleteBolo = async (id: string) => {
    const boloToDelete = bolos.find(b => b.id === id);
    await deleteBolo(id);
    
    // Log
    await saveAuditLog({
      id: Math.random().toString(36).substring(7),
      action: 'DELETE',
      entityType: 'BOLO',
      entityId: id,
      details: `Deleted BOLO: ${boloToDelete?.title || id}`,
      performedBy: currentUser?.badgeNumber || 'System',
      timestamp: new Date().toISOString()
    });

    loadData();
  };

  const handleDeleteFeed = async (id: string) => {
    const feedToDelete = feedItems.find(f => f.id === id);
    await deleteFeedItem(id);
    
    // Log
    await saveAuditLog({
      id: Math.random().toString(36).substring(7),
      action: 'DELETE',
      entityType: 'FEED',
      entityId: id,
      details: `Deleted Feed Item: ${feedToDelete?.content.substring(0, 30) || id}...`,
      performedBy: currentUser?.badgeNumber || 'System',
      timestamp: new Date().toISOString()
    });

    loadData();
  };

  if (currentUser?.role !== 'Admin') {
    return (
      <div className="h-full flex items-center justify-center p-8 text-center space-y-4">
        <ShieldAlert size={64} className="text-red-500 mx-auto opacity-50" />
        <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter italic">Access Restricted</h2>
        <p className="text-slate-500 text-sm max-w-xs mx-auto">This terminal is restricted to Administrative level clearance only. Unauthorized access attempt logged.</p>
      </div>
    );
  }

  return (
    <div className="p-8 md:p-12 max-w-7xl mx-auto space-y-12 pb-24">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-800 uppercase tracking-tighter italic flex items-center gap-3">
             <ShieldAlert className="text-red-600" size={32} />
             System Command Center
          </h2>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">Administrative Intelligence Management Console</p>
        </div>
        
        <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
          <button 
            onClick={() => setActiveTab('feed')}
            className={cn(
              "px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
              activeTab === 'feed' ? "bg-white text-slate-900 shadow-sm border border-slate-200" : "text-slate-400 hover:text-slate-600"
            )}
          >
            Tactical Feed
          </button>
          <button 
            onClick={() => setActiveTab('reports')}
            className={cn(
              "px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
              activeTab === 'reports' ? "bg-white text-slate-900 shadow-sm border border-slate-200" : "text-slate-400 hover:text-slate-600"
            )}
          >
            Full Data Audit
          </button>
          <button 
            onClick={() => setActiveTab('logs')}
            className={cn(
              "px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
              activeTab === 'logs' ? "bg-white text-slate-900 shadow-sm border border-slate-200" : "text-slate-400 hover:text-slate-600"
            )}
          >
            System Logs
          </button>
        </div>
      </header>

      {activeTab === 'feed' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* BOLO MANAGEMENT */}
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertTriangle className="text-amber-500" size={20} />
                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">BOLO Alert Broadcasts</h3>
              </div>
              <button 
                onClick={() => setShowAddBolo(true)}
                className="p-3 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-900/20"
              >
                <Plus size={20} />
              </button>
            </div>

            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-4 scrollbar-hide">
              {bolos.map((bolo) => (
                <div key={bolo.id} className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm flex items-start gap-4 hover:border-slate-300 transition-all group">
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
                    bolo.type === 'Vehicle' ? "bg-blue-50 text-blue-600" : "bg-purple-50 text-purple-600"
                  )}>
                    {bolo.type === 'Vehicle' ? <Car size={24} /> : <User size={24} />}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className={cn(
                        "text-[8px] font-black uppercase px-2 py-0.5 rounded",
                        bolo.priority === 'Emergency' ? "bg-red-100 text-red-600" : "bg-slate-100 text-slate-500"
                      )}>
                        {bolo.priority}
                      </span>
                      <button 
                        onClick={() => setItemToDelete({ id: bolo.id, type: 'BOLO', title: bolo.title })}
                        className="text-slate-300 hover:text-red-500 hover:bg-red-50 p-2 rounded-xl transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <p className="text-sm font-black text-slate-800 tracking-tight">{bolo.title}</p>
                    <p className="text-[10px] text-slate-500 line-clamp-2">{bolo.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* FEED MANAGEMENT */}
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Radio className="text-blue-500" size={20} />
                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Unit Activity Log</h3>
              </div>
              <button 
                onClick={() => setShowAddFeed(true)}
                className="p-3 bg-slate-900 text-white rounded-2xl hover:bg-black transition-all shadow-lg"
              >
                <Plus size={20} />
              </button>
            </div>

            <div className="bg-slate-900 rounded-[40px] p-8 text-white space-y-6 shadow-2xl border border-slate-800 max-h-[60vh] overflow-y-auto scrollbar-hide">
              {feedItems.map((item) => (
                <div key={item.id} className="flex gap-6 relative group pb-6 border-b border-white/5 last:border-0 last:pb-0 underline-offset-4">
                  <div className={cn(
                    "w-1.5 h-1.5 rounded-full mt-2 shrink-0 shadow-lg",
                    item.type === 'Dispatch' ? "bg-blue-400" : 
                    item.type === 'BOLO' ? "bg-amber-400" : "bg-slate-400"
                  )} />
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">{item.type}</span>
                        <span className="text-[9px] font-bold text-slate-600">{item.timestamp}</span>
                      </div>
                      <button 
                        onClick={() => setItemToDelete({ id: item.id, type: 'FEED', title: item.content.substring(0, 30) })}
                        className="text-slate-50 hover:text-red-400 hover:bg-white/10 p-2 rounded-xl transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <p className="text-xs font-medium leading-relaxed italic text-slate-200">{item.content}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : activeTab === 'reports' ? (
        <div className="space-y-8">
           {/* All Reports List */}
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
             {allReports.map((report) => (
               <div key={report.tempId} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4 hover:border-blue-200 transition-all cursor-default">
                  <div className="flex items-center justify-between">
                    <span className={cn(
                      "text-[8px] font-black uppercase px-2 py-0.5 rounded",
                      report.status === 'approved' || report.status === 'submitted' ? "bg-green-100 text-green-700" : 
                      report.status === 'pending' ? "bg-amber-100 text-amber-700" :
                      report.status === 'rejected' ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-500"
                    )}>
                      {report.status}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{format(new Date(report.createdAt), 'MMM dd, HH:mm')}</span>
                  </div>
                  <div>
                    <h4 className="text-lg font-black text-slate-800 tracking-tighter uppercase italic">{report.type}</h4>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                       Ofc. #{report.submittedBy || 'N/A'} • {report.images.length} Evidence Units
                    </p>
                  </div>
                  <p className="text-xs text-slate-500 line-clamp-3 bg-slate-50 p-4 rounded-2xl italic border border-slate-100">
                    "{report.description}"
                  </p>
                  <div className="flex items-center gap-2 text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] pt-2 border-t border-slate-100">
                    <LayoutDashboard size={14} /> 
                    Full Audit Trace Active
                  </div>
               </div>
             ))}
             {allReports.length === 0 && (
               <div className="col-span-full py-24 text-center space-y-4">
                  <FileText size={64} className="mx-auto text-slate-200" />
                  <p className="text-xs font-black text-slate-400 uppercase tracking-[0.3em]">No tactical records in main database</p>
               </div>
             )}
           </div>
        </div>
      ) : (
        <div className="space-y-8">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Administrative Audit Trail</h3>
            <span className="text-[9px] font-bold text-slate-400">Total Logs: {auditLogs.length}</span>
          </div>
          <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden">
             <table className="w-full text-left border-collapse">
               <thead>
                 <tr className="bg-slate-50 border-b border-slate-100">
                   <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-slate-500">Timestamp</th>
                   <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-slate-500">Actor</th>
                   <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-slate-500">Action</th>
                   <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-slate-500">Details</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-slate-50">
                 {auditLogs.map((log) => (
                   <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                     <td className="px-6 py-4 whitespace-nowrap text-[10px] font-mono text-slate-500">
                       {format(new Date(log.timestamp), 'yyyy-MM-dd HH:mm:ss')}
                     </td>
                     <td className="px-6 py-4 whitespace-nowrap">
                       <div className="flex items-center gap-2">
                         <div className="w-5 h-5 bg-slate-200 rounded-full flex items-center justify-center text-[8px] font-black">
                           {log.performedBy.substring(0, 2)}
                         </div>
                         <span className="text-[10px] font-bold text-slate-700">#{log.performedBy}</span>
                       </div>
                     </td>
                     <td className="px-6 py-4 whitespace-nowrap">
                       <span className={cn(
                         "text-[8px] font-black uppercase px-2 py-0.5 rounded",
                         log.action === 'CREATE' ? "bg-blue-100 text-blue-600" : 
                         log.action === 'DELETE' ? "bg-red-100 text-red-600" : "bg-slate-100 text-slate-600"
                       )}>
                         {log.action}
                       </span>
                     </td>
                     <td className="px-6 py-4 text-[10px] text-slate-600 italic">
                       {log.details}
                     </td>
                   </tr>
                 ))}
                 {auditLogs.length === 0 && (
                   <tr>
                     <td colSpan={4} className="px-6 py-24 text-center">
                        <FileText size={48} className="mx-auto text-slate-100 mb-4" />
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-300">No administrative logs recorded</p>
                     </td>
                   </tr>
                 )}
               </tbody>
             </table>
          </div>
        </div>
      )}

      {/* MODALS */}
      <AnimatePresence>
        {showAddBolo && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
             <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               onClick={() => setShowAddBolo(false)}
               className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
             />
             <motion.div 
               initial={{ scale: 0.9, opacity: 0 }}
               animate={{ scale: 1, opacity: 1 }}
               exit={{ scale: 0.9, opacity: 0 }}
               className="bg-white w-full max-w-lg rounded-[40px] shadow-2xl overflow-hidden relative border border-slate-200"
             >
                <div className="p-8 md:p-12 space-y-8">
                  <div className="flex items-center justify-between">
                     <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter italic">Broadcast BOLO</h3>
                     <button onClick={() => setShowAddBolo(false)} className="p-2 text-slate-400 hover:text-slate-900"><X size={24} /></button>
                  </div>
                  
                  <div className="space-y-6">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Alert Target</label>
                       <input 
                         type="text" 
                         placeholder="e.g. Blue Civic Plate #XYZ"
                         className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-6 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                         onChange={(e) => setNewBolo({ ...newBolo, title: e.target.value })}
                       />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Entity Type</label>
                          <select 
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-6 text-xs font-black uppercase"
                            onChange={(e) => setNewBolo({ ...newBolo, type: e.target.value as any })}
                          >
                             <option value="Person">Person</option>
                             <option value="Vehicle">Vehicle</option>
                             <option value="Alert">General Alert</option>
                          </select>
                       </div>
                       <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Priority</label>
                          <select 
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-6 text-xs font-black uppercase"
                            onChange={(e) => setNewBolo({ ...newBolo, priority: e.target.value as any })}
                          >
                             <option value="Low">Low</option>
                             <option value="Medium">Medium</option>
                             <option value="High">High</option>
                             <option value="Emergency">Emergency</option>
                          </select>
                       </div>
                    </div>

                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Detailed Intel</label>
                       <textarea 
                         rows={3}
                         placeholder="Detailed description of target and incident..."
                         className="w-full bg-slate-50 border border-slate-200 rounded-3xl py-4 px-6 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                         onChange={(e) => setNewBolo({ ...newBolo, description: e.target.value })}
                       />
                    </div>
                  </div>

                  <button 
                    onClick={handleAddBolo}
                    className="w-full py-5 bg-blue-600 text-white rounded-3xl font-black uppercase tracking-widest text-[11px] shadow-xl hover:bg-blue-700 transition-all flex items-center justify-center gap-3"
                  >
                    <Radio size={18} /> Deploy BOLO Broadcast
                  </button>
                </div>
             </motion.div>
          </div>
        )}

        {showAddFeed && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
             <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               onClick={() => setShowAddFeed(false)}
               className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
             />
             <motion.div 
               initial={{ scale: 0.9, opacity: 0 }}
               animate={{ scale: 1, opacity: 1 }}
               exit={{ scale: 0.9, opacity: 0 }}
               className="bg-white w-full max-w-lg rounded-[40px] shadow-2xl overflow-hidden relative border border-slate-200"
             >
                <div className="p-8 md:p-12 space-y-8">
                  <div className="flex items-center justify-between">
                     <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter italic">Post Activity</h3>
                     <button onClick={() => setShowAddFeed(false)} className="p-2 text-slate-400 hover:text-slate-900"><X size={24} /></button>
                  </div>
                  
                  <div className="space-y-6">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Item Category</label>
                       <div className="flex gap-2">
                          {['Dispatch', 'Department', 'BOLO'].map((t) => (
                            <button 
                              key={t}
                              onClick={() => setNewFeed({ ...newFeed, type: t as any })}
                              className={cn(
                                "flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                newFeed.type === t ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-400"
                              )}
                            >
                              {t}
                            </button>
                          ))}
                       </div>
                    </div>

                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Transmission Content</label>
                       <textarea 
                         rows={4}
                         placeholder="Radio traffic or department update text..."
                         className="w-full bg-slate-50 border border-slate-200 rounded-3xl py-4 px-6 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                         onChange={(e) => setNewFeed({ ...newFeed, content: e.target.value })}
                       />
                    </div>
                  </div>

                  <button 
                    onClick={handleAddFeed}
                    className="w-full py-5 bg-slate-900 text-white rounded-3xl font-black uppercase tracking-widest text-[11px] shadow-xl hover:bg-black transition-all flex items-center justify-center gap-3"
                  >
                    <Check size={18} /> Transmit Activity Log
                  </button>
                </div>
             </motion.div>
          </div>
        )}

        {itemToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
             <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               onClick={() => setItemToDelete(null)}
               className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm"
             />
             <motion.div 
               initial={{ scale: 0.9, opacity: 0 }}
               animate={{ scale: 1, opacity: 1 }}
               exit={{ scale: 0.9, opacity: 0 }}
               className="bg-white w-full max-w-sm rounded-[40px] shadow-2xl overflow-hidden relative border border-slate-200"
             >
                <div className="p-10 text-center space-y-8">
                  <div className="w-20 h-20 bg-red-50 text-red-600 rounded-[30px] flex items-center justify-center mx-auto shadow-inner shadow-red-100">
                    <Trash2 size={40} />
                  </div>
                  
                  <div className="space-y-3">
                    <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter italic">Confirm Secure Delete</h3>
                    <p className="text-[11px] text-slate-500 font-medium leading-relaxed px-4">
                      Are you sure you want to permanently purge this {itemToDelete.type} record? This action will be archived in the administrative audit log.
                    </p>
                    {itemToDelete.title && (
                      <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 mt-4">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Target</p>
                        <p className="text-[12px] font-bold text-slate-800 line-clamp-1 italic">"{itemToDelete.title}"</p>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-4">
                    <button 
                      onClick={() => setItemToDelete(null)}
                      className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase tracking-widest text-[9px] hover:bg-slate-200 transition-all"
                    >
                      Abort
                    </button>
                    <button 
                      onClick={() => {
                        if (itemToDelete.type === 'BOLO') handleDeleteBolo(itemToDelete.id);
                        else handleDeleteFeed(itemToDelete.id);
                        setItemToDelete(null);
                      }}
                      className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-black uppercase tracking-widest text-[9px] hover:bg-red-700 transition-all shadow-xl shadow-red-900/20"
                    >
                      Purge Data
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
