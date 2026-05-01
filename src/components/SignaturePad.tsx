/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { Trash2, Check, X, PenTool, AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';

interface SignaturePadProps {
  onSave: (data: string) => void;
  onCancel: () => void;
  title?: string;
}

export default function SignaturePad({ onSave, onCancel, title = 'Party Signature' }: SignaturePadProps) {
  const sigPad = useRef<SignatureCanvas>(null);
  const [isEmpty, setIsEmpty] = useState(true);
  const [showError, setShowError] = useState(false);

  const clear = () => {
    sigPad.current?.clear();
    setIsEmpty(true);
    setShowError(false);
  };

  const save = () => {
    const empty = sigPad.current?.isEmpty() ?? true;
    if (empty) {
      setShowError(true);
      return;
    }
    
    const canvas = sigPad.current?.getCanvas();
    if (canvas) {
      const data = canvas.toDataURL('image/png');
      onSave(data);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
      <div className="bg-white w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl border border-slate-200">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-800">{title}</h3>
            <p className="text-xs text-slate-400">Please sign inside the box below.</p>
          </div>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 bg-slate-50 italic text-[10px] text-slate-400 flex items-center gap-2">
          <PenTool size={10} /> Digital signature will be cryptographically linked to Case ID
        </div>

        <div className="p-6 space-y-4">
          <div className={cn(
            "border rounded-2xl overflow-hidden touch-none h-64 transition-all duration-300 relative",
            showError ? "border-red-500 bg-red-50/10 shadow-[0_0_15px_rgba(239,68,68,0.1)]" : "border-slate-200 bg-white"
          )}>
            <SignatureCanvas
              ref={sigPad}
              onBegin={() => {
                setIsEmpty(false);
                setShowError(false);
              }}
              penColor="#0f172a"
              canvasProps={{
                className: 'w-full h-full',
              }}
            />
          </div>
          {showError && (
            <div className="flex items-center gap-2 text-red-500 animate-in fade-in slide-in-from-top-1">
              <AlertCircle size={14} />
              <span className="text-[10px] font-black uppercase tracking-widest">Action Required: Signature cannot be blank</span>
            </div>
          )}
        </div>

        <div className="p-6 bg-slate-50 flex items-center gap-3">
          <button
            onClick={clear}
            className="flex-1 py-3 px-4 rounded-xl border border-slate-200 text-slate-500 font-bold uppercase tracking-widest text-[10px] hover:bg-white transition-colors flex items-center justify-center gap-2"
          >
            <Trash2 size={14} /> Clear
          </button>
          <button
            onClick={save}
            className={cn(
              "flex-[2] py-3 px-4 rounded-xl font-bold uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 transition-all shadow-lg",
              isEmpty 
                ? "bg-slate-100 text-slate-400 shadow-none border border-slate-200" 
                : "bg-blue-600 text-white shadow-blue-200 hover:bg-blue-700"
            )}
          >
            <Check size={14} /> Confirm Signature
          </button>
        </div>
      </div>
    </div>
  );
}
