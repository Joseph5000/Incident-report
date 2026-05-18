/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { getAllReports, deleteReport } from '../lib/db';
import { IncidentReport } from '../types';
import { Trash2, MapPin, Calendar, Clock, AlertCircle, ChevronRight, FileText, X, User as UserIcon, Sparkles, Brain, Loader2, Shield, Volume2, Play, Car, Video, Search, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { generateIncidentSummary } from '../services/geminiService';
import Map from './Map';

export default function ReportHistory() {
  const [reports, setReports] = useState<IncidentReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<IncidentReport | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchReports = async () => {
    setLoading(true);
    const data = await getAllReports();
    // Sort by createdAt descending
    setReports(data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    setLoading(false);
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const handleGenerateSummary = async (report: IncidentReport) => {
    setIsSummarizing(true);
    const summary = await generateIncidentSummary(report);
    setAiSummary(summary);
    setIsSummarizing(false);
  };

  useEffect(() => {
    if (selectedReport) {
      setAiSummary(null);
    }
  }, [selectedReport]);

  const handleDelete = async (e: React.MouseEvent, tempId: string) => {
    e.stopPropagation();
    setConfirmDeleteId(tempId);
  };

  const executeDelete = async () => {
    if (confirmDeleteId) {
      await deleteReport(confirmDeleteId);
      setConfirmDeleteId(null);
      fetchReports();
    }
  };

  const filteredReports = reports.filter(report => {
    const query = searchQuery.toLowerCase();
    return (
      report.description?.toLowerCase().includes(query) ||
      report.officerNotes?.toLowerCase().includes(query) ||
      report.type?.toLowerCase().includes(query)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-4 border-blue-600/30 border-t-blue-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-300 space-y-4">
        <FileText size={64} strokeWidth={1} />
        <p className="font-bold text-xs tracking-[0.2em] uppercase text-slate-400">Archive Logs Empty</p>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-12 max-w-4xl mx-auto space-y-8">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Report History</h2>
          <p className="text-slate-500 font-medium">Review and manage your tactical incident logs.</p>
        </div>
        <div className="bg-slate-100 px-4 py-2 rounded-full border border-slate-200">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            Total Records: {reports.length}
          </p>
        </div>
      </header>

      <div className="relative group">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-500 transition-colors">
          <Search size={18} />
        </div>
        <input 
          type="text"
          placeholder="Search tactical logs (keywords, notes, types)..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-white border border-slate-200 rounded-2xl py-4 pl-12 pr-4 text-sm font-medium shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
        />
        {searchQuery && (
          <button 
            onClick={() => setSearchQuery('')}
            className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-900 transition-colors"
          >
            <X size={18} />
          </button>
        )}
      </div>

      <div className="grid gap-4">
        <AnimatePresence mode="popLayout">
          {filteredReports.length > 0 ? (
            filteredReports.map((report, index) => (
            <motion.div
              key={report.tempId}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => setSelectedReport(report)}
              className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm hover:shadow-xl hover:border-blue-200 transition-all flex flex-col md:flex-row gap-6 relative group cursor-pointer"
            >
              <div className="flex-1 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border",
                      report.status === 'approved' || report.status === 'submitted' ? "bg-green-50 text-green-700 border-green-100" : 
                      report.status === 'pending' ? "bg-amber-50 text-amber-700 border-amber-100" :
                      report.status === 'rejected' ? "bg-red-50 text-red-700 border-red-100" :
                      "bg-blue-50 text-blue-700 border-blue-100"
                    )}>
                      {report.status}
                    </span>
                    <h3 className="text-xl font-bold text-slate-800 leading-tight">
                      {report.type || 'Unnamed Incident'}
                    </h3>
                  </div>
                  
                  <button 
                    onClick={(e) => handleDelete(e, report.tempId)}
                    className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all md:opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>

                <p className="text-slate-500 text-sm line-clamp-2 leading-relaxed">
                  {report.description || 'No description provided.'}
                </p>

                <div className="flex flex-wrap gap-4 text-xs font-medium text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <Calendar size={14} className="text-blue-500" />
                    {new Date(report.createdAt).toLocaleDateString()}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock size={14} className="text-blue-500" />
                    {new Date(report.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  {report.location?.address && (
                    <div className="flex items-center gap-1.5">
                      <MapPin size={14} className="text-blue-500" />
                      <span className="truncate max-w-[200px]">{report.location.address}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 md:border-l md:border-slate-100 md:pl-6">
                <div className="flex -space-x-3 overflow-hidden">
                  {report.images.slice(0, 3).map((img, i) => (
                    <div key={i} className="w-12 h-12 rounded-2xl border-4 border-white overflow-hidden shadow-sm">
                      <img src={img} alt="Evidence" className="w-full h-full object-cover" />
                    </div>
                  ))}
                  {report.images.length > 3 && (
                    <div className="w-12 h-12 rounded-2xl border-4 border-white bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-400 shadow-sm">
                      +{report.images.length - 3}
                    </div>
                  )}
                </div>
                {report.signatures.length > 0 && (
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-50 border border-blue-100">
                    <AlertCircle size={16} className="text-blue-600" />
                  </div>
                )}
                {report.videos && report.videos.length > 0 && (
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-red-50 border border-red-100">
                    <Video size={16} className="text-red-500" />
                  </div>
                )}
                <button className="p-3 text-slate-300 hover:text-blue-600 hover:bg-blue-50 rounded-2xl transition-all">
                  <ChevronRight size={24} />
                </button>
              </div>
            </motion.div>
          ))
        ) : (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="py-12 flex flex-col items-center justify-center text-slate-300 space-y-4"
          >
            <Search size={48} strokeWidth={1} />
            <p className="font-bold text-xs tracking-[0.2em] uppercase text-slate-400">No matching records found</p>
          </motion.div>
        )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {selectedReport && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[180] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 md:p-8"
            onClick={() => setSelectedReport(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white w-full max-w-4xl h-[90vh] rounded-[40px] shadow-2xl overflow-hidden border border-slate-200 flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-6 md:p-10 border-b border-slate-100 flex items-start justify-between bg-slate-50/50">
                <div className="space-y-3">
                    <div className="flex items-center gap-3">
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border",
                      selectedReport.status === 'approved' || selectedReport.status === 'submitted' ? "bg-green-50 text-green-700 border-green-100" : 
                      selectedReport.status === 'pending' ? "bg-amber-50 text-amber-700 border-amber-100" :
                      selectedReport.status === 'rejected' ? "bg-red-50 text-red-700 border-red-100" :
                      "bg-blue-50 text-blue-700 border-blue-100"
                    )}>
                      {selectedReport.status}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <FileText size={12} />
                      Log ID: {selectedReport.tempId.slice(0, 8)}
                    </span>
                  </div>
                  <h2 className="text-3xl md:text-4xl font-black text-slate-900 leading-tight">
                    {selectedReport.type}
                  </h2>
                </div>
                <button 
                  onClick={() => setSelectedReport(null)}
                  className="p-3 bg-white hover:bg-slate-100 rounded-full border border-slate-200 text-slate-400 hover:text-slate-900 transition-all shadow-sm"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-12">
                <section className="grid md:grid-cols-3 gap-8">
                  <div className="md:col-span-2 space-y-6">
                    <div className="space-y-4">
                      <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Incident Narrative</h4>
                      <div className="bg-slate-50 rounded-[32px] p-8 border border-slate-100 space-y-6">
                        <div className="space-y-4">
                          <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-2">
                             <FileText size={12} className="text-blue-500" /> Official Description
                          </div>
                          <p className="text-slate-700 text-lg leading-relaxed whitespace-pre-wrap font-medium">
                            {selectedReport.description || 'No detailed narrative provided for this log.'}
                          </p>
                        </div>

                        {selectedReport.officerNotes && (
                          <div className="space-y-4 pt-4 border-t border-slate-200">
                            <div className="flex items-center gap-2 text-[10px] font-black text-amber-600 uppercase tracking-widest">
                               <Shield size={12} /> Internal Officer Notes (Ofc. #{selectedReport.submittedBy})
                            </div>
                            <div className="bg-slate-100/50 p-6 rounded-2xl border border-slate-200/50 italic text-slate-600 text-sm leading-relaxed">
                              {selectedReport.officerNotes}
                            </div>
                          </div>
                        )}

                        {selectedReport.supervisorNotes && (
                          <div className="space-y-4 pt-4 border-t border-slate-200">
                            <div className="flex items-center gap-2 text-[10px] font-black text-indigo-600 uppercase tracking-widest">
                               <ShieldCheck size={12} /> Supervisor Action Log (Sgt. #{selectedReport.reviewedBy})
                            </div>
                            <div className={cn(
                              "p-6 rounded-2xl border italic text-sm leading-relaxed",
                              selectedReport.status === 'approved' ? "bg-green-50 border-green-100 text-green-700" : "bg-red-50 border-red-100 text-red-700"
                            )}>
                              {selectedReport.supervisorNotes}
                            </div>
                          </div>
                        )}

                        {selectedReport.impoundDetails && (
                          <div className="space-y-4 pt-4 border-t border-slate-200">
                             <div className="flex items-center gap-2 text-[10px] font-black text-blue-600 uppercase tracking-widest">
                               <Car size={12} /> Impoundment Record
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Tow Company</span>
                                <p className="text-xs font-bold text-slate-800">{selectedReport.impoundDetails.towCompany}</p>
                              </div>
                              <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Storage Lot</span>
                                <p className="text-xs font-bold text-slate-800">{selectedReport.impoundDetails.lotNumber}</p>
                              </div>
                              <div className="col-span-2 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Legal Reason</span>
                                <p className="text-xs font-bold text-slate-800 italic">"{selectedReport.impoundDetails.reason}"</p>
                              </div>
                              {selectedReport.impoundDetails.inventoryNotes && (
                                <div className="col-span-2 bg-slate-100 p-4 rounded-2xl border border-slate-200 shadow-sm">
                                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Inventory & Damage Notes</span>
                                  <p className="text-xs text-slate-600 leading-relaxed font-mono">{selectedReport.impoundDetails.inventoryNotes}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {selectedReport.audioNotes && selectedReport.audioNotes.length > 0 && (
                          <div className="space-y-4 pt-4 border-t border-slate-200">
                             <div className="flex items-center gap-2 text-[10px] font-black text-indigo-600 uppercase tracking-widest">
                               <Volume2 size={12} /> Captured Audio Statements
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {selectedReport.audioNotes.map((note) => (
                                <div key={note.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                                      <Volume2 size={14} />
                                    </div>
                                    <div>
                                      <p className="text-[10px] font-black text-slate-800 uppercase tracking-tight">Statement {note.id.slice(0, 4)}</p>
                                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                                        {Math.floor(note.duration / 60)}:{(note.duration % 60).toString().padStart(2, '0')} duration
                                      </p>
                                    </div>
                                  </div>
                                  <audio src={note.data} className="hidden" id={`hist-audio-${note.id}`} />
                                  <button 
                                    onClick={() => {
                                      const el = document.getElementById(`hist-audio-${note.id}`) as HTMLAudioElement;
                                      el?.play();
                                    }}
                                    className="p-2 bg-slate-50 rounded-xl text-slate-400 hover:text-indigo-600 transition-all border border-slate-100"
                                  >
                                    <Play size={14} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="flex flex-wrap gap-6 pt-4 border-t border-slate-200">
                          <div className="space-y-1">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Logged Date</span>
                            <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
                              <Calendar size={14} className="text-blue-500" />
                              {new Date(selectedReport.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                          <div className="space-y-1">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Tactical Time</span>
                            <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
                              <Clock size={14} className="text-blue-500" />
                              {new Date(selectedReport.createdAt).toLocaleTimeString()}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Deployment Context</h4>
                      <div className="space-y-4">
                        <div className="p-6 rounded-3xl bg-slate-50 border border-slate-100 flex items-start gap-3">
                          <MapPin size={18} className="text-blue-500 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-sm font-bold text-slate-700">{selectedReport.location?.address || 'Geolocation coordinate unavailable'}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <p className="text-[10px] text-slate-400 uppercase tracking-tight">
                                {selectedReport.location?.latitude.toFixed(6)}, {selectedReport.location?.longitude.toFixed(6)}
                              </p>
                              {selectedReport.location?.accuracy && (
                                <span className="text-[8px] font-black px-1.5 py-0.5 bg-slate-200 text-slate-500 rounded uppercase tracking-tighter">
                                  ±{Math.round(selectedReport.location.accuracy)}m
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="h-48 rounded-3xl overflow-hidden border border-slate-100 shadow-inner">
                           <Map 
                             center={[selectedReport.location?.latitude || 14.5995, selectedReport.location?.longitude || 120.9842]} 
                             accuracy={selectedReport.location?.accuracy}
                             zoom={16}
                           />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Evidence Units</h4>
                    <div className="grid grid-cols-2 gap-3">
                      {selectedReport.images.map((img, i) => (
                        <div key={i} className="aspect-square rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
                          <img src={img} alt="Evidence" className="w-full h-full object-cover" />
                        </div>
                      ))}
                      {selectedReport.videos?.map((vid) => (
                        <div key={vid.id} className="aspect-square rounded-2xl overflow-hidden border border-red-100 shadow-sm bg-slate-900 relative group">
                          <video src={vid.data} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-slate-900/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => {
                                const v = document.createElement('video');
                                v.src = vid.data;
                                v.style.position = 'fixed';
                                v.style.top = '0';
                                v.style.left = '0';
                                v.style.width = '100%';
                                v.style.height = '100%';
                                v.style.zIndex = '9999';
                                v.style.background = 'black';
                                v.controls = true;
                                v.onclick = () => v.remove();
                                document.body.appendChild(v);
                                v.play();
                              }}
                              className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-slate-900 shadow-xl"
                            >
                              <Play size={18} />
                            </button>
                          </div>
                          <div className="absolute bottom-2 left-2 px-1.5 py-0.5 bg-red-600/90 text-[7px] font-black text-white rounded uppercase tracking-tighter shadow-lg">
                            VIDEO
                          </div>
                        </div>
                      ))}
                      {selectedReport.images.length === 0 && (!selectedReport.videos || selectedReport.videos.length === 0) && (
                        <div className="col-span-2 p-8 rounded-3xl border-2 border-dashed border-slate-100 flex flex-col items-center justify-center text-slate-300">
                          <FileText size={32} />
                          <span className="text-[10px] font-bold uppercase mt-2">No Visual Evidence</span>
                        </div>
                      )}
                    </div>
                  </div>
                </section>

                <section className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-2">
                       <Sparkles size={12} />
                       AI Tactical Briefing
                    </h4>
                    {!aiSummary && !isSummarizing && (
                      <button 
                        onClick={() => handleGenerateSummary(selectedReport)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-blue-100 transition-all border border-blue-100"
                      >
                        <Brain size={14} />
                        Generate Brief
                      </button>
                    )}
                  </div>
                  
                  <AnimatePresence mode="wait">
                    {isSummarizing ? (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="p-8 rounded-[32px] bg-blue-50/30 border border-blue-100/50 flex flex-col items-center justify-center space-y-4"
                      >
                        <Loader2 size={32} className="text-blue-500 animate-spin" />
                        <p className="text-[10px] font-bold text-blue-400 uppercase tracking-[0.2em] animate-pulse">Analyzing tactical data...</p>
                      </motion.div>
                    ) : aiSummary ? (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-8 rounded-[32px] bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 shadow-sm relative overflow-hidden group"
                      >
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                          <Brain size={120} strokeWidth={1} />
                        </div>
                        <p className="text-slate-700 font-medium leading-relaxed italic relative z-10">
                          "{aiSummary}"
                        </p>
                        <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-blue-400 uppercase tracking-widest relative z-10">
                          <Shield size={12} />
                          Gemini Tactical Insight • Verified Analyst
                        </div>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </section>

                <section className="space-y-6">
                  <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Witness Statements</h4>
                  <div className="grid gap-4">
                    {selectedReport.witnesses?.map((witness) => (
                      <div key={witness.id} className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                              <UserIcon size={20} />
                            </div>
                            <div>
                              <p className="font-bold text-slate-800 leading-none">{witness.name}</p>
                              <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">{witness.phone} • {witness.address}</p>
                            </div>
                          </div>
                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-1 rounded border border-slate-100">
                            {new Date(witness.timestamp).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 italic text-slate-600 text-sm leading-relaxed">
                          "{witness.statement}"
                        </div>
                      </div>
                    ))}
                    {(!selectedReport.witnesses || selectedReport.witnesses.length === 0) && (
                      <div className="p-8 rounded-3xl border-2 border-dashed border-slate-100 flex flex-col items-center justify-center text-slate-300">
                        <FileText size={32} />
                        <span className="text-[10px] font-bold uppercase mt-2">Zero Witness records Captured</span>
                      </div>
                    )}
                  </div>
                </section>

                <section className="space-y-6">
                  <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Authorized Signatures</h4>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {selectedReport.signatures.map((sig, i) => (
                      <div key={i} className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                            <UserIcon size={20} />
                          </div>
                          <div>
                            <p className="font-bold text-slate-800 leading-none">{sig.name}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">{sig.type}</p>
                          </div>
                        </div>
                        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                          <img src={sig.data} alt="Signature" className="w-full h-auto grayscale transition-all hover:grayscale-0" />
                        </div>
                      </div>
                    ))}
                    {selectedReport.signatures.length === 0 && (
                      <div className="col-span-full p-8 rounded-3xl border-2 border-dashed border-slate-100 flex flex-col items-center justify-center text-slate-300">
                        <AlertCircle size={32} />
                        <span className="text-[10px] font-bold uppercase mt-2">Zero Signatures Captured</span>
                      </div>
                    )}
                  </div>
                </section>
              </div>

              <div className="p-6 md:p-10 border-t border-slate-100 bg-slate-50/50 flex justify-end">
                <button 
                  onClick={() => setSelectedReport(null)}
                  className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg active:scale-95"
                >
                  Close Archive
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {confirmDeleteId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-6"
            onClick={() => setConfirmDeleteId(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden border border-slate-200"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-8 text-center space-y-6">
                <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-100">
                  <Trash2 size={24} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Delete Report?</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">
                    This action is permanent and will bypass local encryption logs. Recovery is not possible.
                  </p>
                </div>
                
                <div className="flex flex-col gap-3 pt-2">
                  <button 
                    onClick={executeDelete}
                    className="w-full py-4 bg-red-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-red-700 transition-all shadow-lg shadow-red-200"
                  >
                    Confirm Destruction
                  </button>
                  <button 
                    onClick={() => setConfirmDeleteId(null)}
                    className="w-full py-4 text-slate-400 font-bold text-[10px] uppercase tracking-[0.2em] hover:text-slate-600 transition-all"
                  >
                    Abort Operation
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
