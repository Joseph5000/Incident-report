/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Shield, Lock, ChevronRight, AlertCircle, Fingerprint, Key } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

import { User } from '../types';
import { saveAuditLog } from '../lib/db';

interface LoginProps {
  onLogin: (user: User) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [badgeNumber, setBadgeNumber] = useState('');
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    // Mock validation: In a real app, this would verify against a backend
    setTimeout(async () => {
      if (passcode === 'SHIELD') {
        const isSupervisor = badgeNumber.startsWith('S');
        const isAdmin = badgeNumber.startsWith('A');
        
        let role: User['role'] = 'Officer';
        if (isAdmin) role = 'Admin';
        else if (isSupervisor) role = 'Supervisor';

        const user: User = {
          badgeNumber,
          name: isAdmin ? `Admin ${badgeNumber}` : isSupervisor ? `Sup. ${badgeNumber}` : `Ofc. ${badgeNumber}`,
          role
        };
        
        // Audit log
        await saveAuditLog({
          id: Math.random().toString(36).substring(7),
          action: 'LOGIN',
          entityType: 'USER',
          entityId: badgeNumber,
          details: `User session established: ${role} access granted.`,
          performedBy: badgeNumber,
          timestamp: new Date().toISOString()
        });

        onLogin(user);
      } else {
        setError("AUTHENTICATION_FAILED: Invalid Credentials or Revoked Badge.");
        setIsSubmitting(false);
      }
    }, 1200);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 relative overflow-hidden">
      {/* Tactical Background Elements */}
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,#2563eb_0%,transparent_70%)] opacity-20" />
        <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(#1e293b 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="bg-slate-900 border border-slate-800 rounded-[40px] shadow-2xl overflow-hidden p-10 space-y-8">
          <div className="text-center space-y-4">
            <div className="w-20 h-20 bg-blue-600 rounded-3xl flex items-center justify-center mx-auto shadow-[0_0_40px_rgba(37,99,235,0.3)]">
              <Shield size={40} className="text-white" />
            </div>
            <div className="space-y-1">
              <h1 className="text-2xl font-black text-white uppercase tracking-tight">ShieldReport</h1>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em]">Authorized Personnel Only</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Badge ID</label>
                <div className="relative group">
                  <Fingerprint className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-blue-500 transition-colors" size={20} />
                  <input 
                    type="text"
                    value={badgeNumber}
                    onChange={(e) => setBadgeNumber(e.target.value)}
                    placeholder="Enter Badge #"
                    className="w-full bg-slate-800 border border-slate-700 text-white pl-12 pr-4 py-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all placeholder:text-slate-600 font-bold tracking-widest text-sm"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tactical Passcode</label>
                <div className="relative group">
                  <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-blue-500 transition-colors" size={20} />
                  <input 
                    type="password"
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
                    placeholder="Enter Code"
                    className="w-full bg-slate-800 border border-slate-700 text-white pl-12 pr-4 py-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all placeholder:text-slate-600 font-bold tracking-widest text-sm"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1 px-1">
                  <div className="flex justify-between">
                    <span className="text-[9px] text-slate-500 uppercase tracking-tighter">Code: SHIELD</span>
                    <button type="button" className="text-[9px] text-blue-500 hover:underline font-bold uppercase tracking-tighter">Reset</button>
                  </div>
                  <p className="text-[8px] text-slate-600 uppercase tracking-[0.1em]">Use 'S' prefix for Supervisor or 'A' for Admin Access</p>
                </div>
              </div>
            </div>

            <AnimatePresence>
              {error && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex items-center gap-3 text-red-400"
                >
                  <AlertCircle size={18} />
                  <p className="text-[10px] font-bold uppercase tracking-wider">{error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            <button 
              type="submit"
              disabled={isSubmitting}
              className={cn(
                "w-full py-5 rounded-[24px] font-black text-xs uppercase tracking-[0.3em] flex items-center justify-center gap-3 transition-all",
                isSubmitting 
                  ? "bg-slate-800 text-slate-600 cursor-not-allowed" 
                  : "bg-blue-600 hover:bg-blue-700 text-white shadow-[0_10px_20px_-10px_rgba(37,99,235,0.5)] active:scale-95"
              )}
            >
              {isSubmitting ? "Verifying..." : (
                <>
                  Establish Connection <ChevronRight size={16} />
                </>
              )}
            </button>
          </form>

          <div className="pt-4 border-t border-slate-800/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest font-mono">System v2.4.0_Stable</span>
            </div>
            <div className="flex items-center gap-1.5">
               <Lock size={10} className="text-slate-600" />
               <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest font-mono">AES-256 Activated</span>
            </div>
          </div>
        </div>
        
        <div className="mt-8 flex justify-center gap-8">
          <p className="text-[10px] font-bold text-slate-700 uppercase tracking-widest">End-to-End Encrypted</p>
          <p className="text-[10px] font-bold text-slate-700 uppercase tracking-widest">GDPR Compliant</p>
          <p className="text-[10px] font-bold text-slate-700 uppercase tracking-widest">CJIS Secured</p>
        </div>
      </motion.div>
    </div>
  );
}
