/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Check, X, Search, FileText, User as UserIcon, LayoutDashboard, TrendingUp, AlertTriangle, ShieldCheck, Map as MapIcon, Calendar } from 'lucide-react';
import { getDrafts, saveDraft } from '../lib/db';
import { IncidentReport, User } from '../types';
import { cn } from '../lib/utils';
import { format } from 'date-fns';

interface DashboardProps {
  currentUser: User | null;
}

export default function Dashboard({ currentUser }: DashboardProps) {
  const [reports, setReports] = useState<IncidentReport[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    submitted: 0,
    accidents: 0,
    toReview: 0
  });

  const loadReports = async () => {
    const data = await getDrafts();
    setReports(data || []);
    
    const total = data?.length || 0;
    const submitted = data?.filter(r => r.status === 'submitted' || r.status === 'approved').length || 0;
    const accidents = data?.filter(r => r.type === 'Vehicle Accident').length || 0;
    const toReview = data?.filter(r => r.status === 'pending').length || 0;
    
    setStats({
      total,
      pending: data?.filter(r => r.status === 'draft').length || 0,
      submitted,
      accidents,
      toReview
    });
  };

  useEffect(() => {
    loadReports();
  }, []);

  const handleStatusChange = async (report: IncidentReport, newStatus: 'approved' | 'rejected') => {
    const notes = prompt(`Enter supervisor notes for ${newStatus}:`);
    const updatedReport: IncidentReport = {
      ...report,
      status: newStatus,
      reviewedBy: currentUser?.badgeNumber,
      supervisorNotes: notes || '',
      updatedAt: new Date().toISOString()
    };
    await saveDraft(updatedReport);
    await loadReports();
  };

  const filteredReports = reports.filter(r => 
    r.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.location.address?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const pendingReviews = reports.filter(r => r.status === 'pending');

  const typeData = [
    { name: 'Accid.', value: reports.filter(r => r.type === 'Vehicle Accident').length },
    { name: 'H&R', value: reports.filter(r => r.type === 'Hit and Run').length },
    { name: 'Imp.', value: reports.filter(r => r.type === 'Vehicle Impound').length },
    { name: 'Traffic', value: reports.filter(r => r.type === 'Traffic Obstruction').length },
    { name: 'Other', value: reports.filter(r => !['Vehicle Accident', 'Hit and Run', 'Vehicle Impound', 'Traffic Obstruction'].includes(r.type)).length },
  ];

  const statusData = [
    { name: 'Finalized', value: stats.submitted },
    { name: 'Queued', value: stats.toReview + stats.pending },
  ];

  const COLORS = ['#2563eb', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef'];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 pb-24">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-800 uppercase tracking-tighter italic flex items-center gap-3">
            <LayoutDashboard className="text-blue-600" size={32} />
            Command Center
          </h2>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">Sector Tactical Intelligence Overview • Role: {currentUser?.role}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input 
              type="text" 
              placeholder="Search reports..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 bg-white border border-slate-100 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-600/20 w-64"
            />
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl border border-slate-100 shadow-sm">
             <Calendar size={14} className="text-slate-400" />
             <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Last 30 Days</span>
          </div>
        </div>
      </header>

      {/* Hero Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Total Logs', value: stats.total, icon: ShieldCheck, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Finalized', value: stats.submitted, icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Pending Review', value: stats.toReview, icon: AlertTriangle, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'Vehicle Crash', value: stats.accidents, icon: MapIcon, color: 'text-red-600', bg: 'bg-red-50' },
        ].map((item, idx) => (
          <div key={idx} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between group hover:border-blue-200 transition-all cursor-default">
            <div className="space-y-1">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.label}</p>
              <h3 className="text-3xl font-black text-slate-800 tracking-tighter">{item.value}</h3>
            </div>
            <div className={`w-12 h-12 ${item.bg} ${item.color} rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform`}>
              <item.icon size={24} />
            </div>
          </div>
        ))}
      </div>

      {currentUser?.role === 'Supervisor' && pendingReviews.length > 0 && (
        <section className="space-y-4">
           <div className="flex items-center justify-between px-2">
             <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
               <AlertTriangle size={14} className="text-amber-500" />
               Critical Pending Reviews
             </h3>
             <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full uppercase tracking-widest animate-pulse">Action Required</span>
           </div>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             {pendingReviews.map((report) => (
               <div key={report.tempId} className="bg-white p-6 rounded-[32px] border-2 border-amber-100 shadow-xl shadow-amber-900/5 space-y-4 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <FileText size={80} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center font-black italic shadow-sm">
                        PR
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-800 uppercase tracking-tighter">{report.type}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Submitted by Ofc. #{report.submittedBy || 'N/A'}</p>
                      </div>
                    </div>
                    <div className="text-right">
                       <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{format(new Date(report.createdAt), 'HH:mm')}</p>
                       <p className="text-[8px] font-bold text-amber-500 uppercase tracking-tight">Priority Alpha</p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-600 line-clamp-2 bg-slate-50 p-3 rounded-xl border border-slate-100 font-mono italic">
                    "{report.description}"
                  </p>
                  <div className="flex items-center gap-2 pt-2">
                    <button 
                      onClick={() => handleStatusChange(report, 'approved')}
                      className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                    >
                      <Check size={14} /> Approve Log
                    </button>
                    <button 
                      onClick={() => handleStatusChange(report, 'rejected')}
                      className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                    >
                      <X size={14} /> Reject
                    </button>
                  </div>
               </div>
             ))}
           </div>
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Incident Types Chart */}
        <div className="lg:col-span-2 bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Incident Distribution</h3>
            <span className="text-[9px] font-bold text-blue-600 uppercase tracking-widest">By Category</span>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={typeData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }}
                />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
                />
                <Bar dataKey="value" fill="#2563eb" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status Distribution */}
        <div className="bg-slate-900 p-8 rounded-[40px] border border-slate-800 shadow-2xl space-y-6 text-white">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">System Sync Status</h3>
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          </div>
          <div className="h-[200px] w-full flex items-center justify-center">
             <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={8}
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === 0 ? '#3b82f6' : '#1e293b'} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-4 pt-4 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Finalized</span>
              </div>
              <span className="text-sm font-black italic">{stats.submitted} Units</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-slate-700" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">In Workflow</span>
              </div>
              <span className="text-sm font-black italic">{stats.toReview + stats.pending} Units</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity Mini-List */}
      <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm space-y-6">
        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Recent Tactical Entries</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredReports.slice(0, 9).map((report, i) => (
            <div key={i} className="p-5 bg-slate-50 rounded-3xl border border-slate-100 flex items-center gap-4 hover:bg-slate-100 transition-colors cursor-default">
               <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-blue-600 shadow-sm border border-slate-100">
                 <ShieldCheck size={18} />
               </div>
               <div className="flex-1 overflow-hidden">
                 <p className="text-[10px] font-black text-slate-800 uppercase tracking-tighter truncate">{report.type}</p>
                 <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest truncate">{report.location.address || 'Location Hidden'}</p>
               </div>
               <span className={cn(
                 "text-[8px] font-black px-1.5 py-0.5 rounded uppercase",
                 report.status === 'approved' || report.status === 'submitted' ? "bg-green-100 text-green-700" : 
                 report.status === 'pending' ? "bg-amber-100 text-amber-700" :
                 report.status === 'rejected' ? "bg-red-100 text-red-700" : "bg-slate-300 text-slate-600"
               )}>
                 {report.status}
               </span>
            </div>
          ))}
          {filteredReports.length === 0 && (
            <div className="col-span-full py-12 text-center text-slate-300">
               <ShieldCheck size={48} className="mx-auto mb-3 opacity-20" />
               <p className="text-[10px] font-black uppercase tracking-widest">No matching logs found in sector database</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
