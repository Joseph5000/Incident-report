/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import exifr from 'exifr';
import { Camera, MapPin, Clock, FileText, Upload, CheckCircle, AlertCircle, Trash2, X, PenTool, UserPlus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import Map from './Map';
import SignaturePad from './SignaturePad';
import { reverseGeocode } from '../lib/geocoding';
import { saveDraft, setFormDraft, getFormDraft, clearFormDraft } from '../lib/db';
import { IncidentReport, LocationData } from '../types';
import { cn } from '../lib/utils';

export default function IncidentForm() {
  const [report, setReport] = useState<Partial<IncidentReport>>({
    tempId: crypto.randomUUID(),
    type: 'Vehicle Accident',
    description: '',
    officerNotes: '',
    images: [],
    signatures: [],
    status: 'draft',
    createdAt: new Date().toISOString(),
    location: {
      latitude: 14.5995, // Default Manila
      longitude: 120.9842,
      timestamp: new Date().toISOString()
    }
  });

  const [isProcessing, setIsProcessing] = useState(false);
  const [currentAddress, setCurrentAddress] = useState('Acquiring location...');
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [currentParty, setCurrentParty] = useState({ name: '', type: 'Involved Party' });
  const [signatureStep, setSignatureStep] = useState<'info' | 'pad'>('info');
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load draft on mount
  useEffect(() => {
    const loadDraft = async () => {
      const draft = await getFormDraft();
      if (draft) {
        setReport(draft);
        if (draft.location?.address) {
          setCurrentAddress(draft.location.address);
        }
      }
    };
    loadDraft();
  }, []);

  // Save draft on every change
  useEffect(() => {
    if (report && report.tempId) {
      setFormDraft(report);
    }
  }, [report]);

  // Sync address on coordinate change
  useEffect(() => {
    if (report.location?.latitude && report.location?.longitude) {
      updateAddress(report.location.latitude, report.location.longitude);
    }
  }, [report.location?.latitude, report.location?.longitude]);

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};
    
    if (!report.images || report.images.length === 0) {
      newErrors.images = "At least one evidence photo is required for tactical verification.";
    }
    
    if (!report.description || report.description.trim().length < 10) {
      newErrors.description = "A detailed officer narrative (min 10 characters) is required.";
    }
    
    if (!report.signatures || report.signatures.length === 0) {
      newErrors.signatures = "At least one digital signature is required to validate the report authenticity.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const updateAddress = async (lat: number, lon: number) => {
    const data = await reverseGeocode(lat, lon);
    setCurrentAddress(data.address);
    setReport(prev => ({
      ...prev,
      location: {
        ...prev.location!,
        address: data.address,
        barangay: data.barangay,
        city: data.city
      }
    }));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsProcessing(true);
    setErrors(prev => ({ ...prev, images: '' }));
    
    const newImages: string[] = [...(report.images || [])];
    let newLocation = { ...report.location! };
    let locationUpdated = false;

    for (const file of Array.from(files)) {
      try {
        // 1. Extract EXIF
        const metadata = await exifr.gps(file);
        const timestampData = await exifr.parse(file, ['DateTimeOriginal']);

        if (metadata && metadata.latitude && metadata.longitude) {
          newLocation = {
            ...newLocation,
            latitude: metadata.latitude,
            longitude: metadata.longitude,
            timestamp: timestampData?.DateTimeOriginal?.toISOString() || newLocation.timestamp
          };
          locationUpdated = true;
        }

        // 2. Read file as Base64 for preview
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve) => {
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
        newImages.push(base64);

      } catch (err) {
        console.error('Error processing image:', err);
      }
    }

    setReport(prev => ({ 
      ...prev, 
      images: newImages,
      location: locationUpdated ? newLocation : prev.location
    }));
    
    setIsProcessing(false);
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      const firstError = Object.values(errors)[0];
      // Optional: scroll to first error
      return;
    }

    setIsProcessing(true);
    // Simulate API call
    setTimeout(async () => {
      const finalReport = { ...report, status: 'submitted' as const };
      await saveDraft(finalReport as IncidentReport);
      await clearFormDraft();
      alert('Report submitted successfully to central database.');
      setIsProcessing(false);
      // Reset form
      setReport({
        tempId: crypto.randomUUID(),
        type: 'Vehicle Accident',
        description: '',
        officerNotes: '',
        images: [],
        signatures: [],
        status: 'draft',
        createdAt: new Date().toISOString(),
        location: { latitude: 14.5995, longitude: 120.9842, timestamp: new Date().toISOString() }
      });
      setErrors({});
    }, 1500);
  };

  return (
    <div className="max-w-5xl mx-auto p-8 space-y-8 pb-32">
      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            New Incident Report
          </h2>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">
            Case ID: INC-{report.tempId?.split('-')[0].toUpperCase()}
          </p>
        </div>
        <div className="flex items-center gap-3 text-right">
           <div className="hidden sm:block">
             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Incident Timestamp</p>
             <p className="text-sm font-mono text-slate-600 font-medium">{format(new Date(report.location!.timestamp), 'yyyy-MM-dd HH:mm:ss')} UTC</p>
           </div>
        </div>
      </div>

      {Object.keys(errors).length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3"
        >
          <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={18} />
          <div>
            <p className="text-sm font-bold text-red-800 uppercase tracking-wider">Tactical Readiness Check Failed</p>
            <p className="text-xs text-red-600 mt-1">Please address the required fields highlighted below before submitting the report.</p>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column: Form Inputs */}
        <div className="space-y-6">
          {/* Media Capture Section */}
          <div className={cn(
            "bg-white p-6 rounded-3xl border transition-all space-y-4 shadow-sm",
            errors.images ? "border-red-200 bg-red-50/10" : "border-slate-200"
          )}>
            <div className="flex items-center justify-between mb-2">
              <label className={cn(
                "text-[10px] font-bold uppercase tracking-widest flex items-center gap-2",
                errors.images ? "text-red-500" : "text-slate-400"
              )}>
                Evidence Collection {errors.images && "• REQUIRED"}
              </label>
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="text-blue-600 font-bold text-[10px] hover:underline flex items-center gap-1"
              >
                <Camera size={12} /> OPEN CAMERA
              </button>
            </div>
            
            <div className="grid grid-cols-3 gap-3">
              <AnimatePresence>
                {report.images?.map((img, idx) => (
                  <motion.div 
                    key={idx}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="relative aspect-square rounded-2xl overflow-hidden border border-slate-100 bg-slate-50 group"
                  >
                    <img src={img} alt="Evidence" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button 
                        onClick={() => setReport(prev => ({ ...prev, images: prev.images?.filter((_, i) => i !== idx) }))}
                        className="bg-white text-slate-900 p-2 rounded-full shadow-xl"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
                className={cn(
                  "aspect-square flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-2xl transition-all",
                  errors.images 
                    ? "border-red-200 bg-red-50/50 text-red-300" 
                    : "border-slate-200 text-slate-400 hover:text-blue-600 hover:border-blue-400 hover:bg-blue-50/30"
                )}
              >
                <Upload size={24} />
                <span className="text-[8px] font-bold uppercase tracking-widest">Capture</span>
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleImageUpload} 
                accept="image/*" 
                className="hidden" 
                multiple
              />
            </div>
            {errors.images && <p className="text-[10px] text-red-500 font-medium">{errors.images}</p>}
          </div>

          {/* Details Section */}
          <div className={cn(
            "bg-white p-6 rounded-3xl border transition-all space-y-6 shadow-sm",
            errors.description ? "border-red-200 bg-red-50/10" : "border-slate-200"
          )}>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Incident Category</label>
              <select 
                value={report.type}
                onChange={(e) => setReport(prev => ({ ...prev, type: e.target.value }))}
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all appearance-none"
              >
                <option>Vehicle Accident</option>
                <option>Hit and Run</option>
                <option>Traffic Obstruction</option>
                <option>Public Disturbance</option>
                <option>Other / Assist</option>
              </select>
            </div>

            <div>
              <label className={cn(
                "text-[10px] font-bold uppercase tracking-widest block mb-2",
                errors.description ? "text-red-500" : "text-slate-400"
              )}>
                Officer Summary {errors.description && "• REQUIRED"}
              </label>
              <textarea 
                value={report.description}
                onChange={(e) => {
                  setReport(prev => ({ ...prev, description: e.target.value }));
                  if (e.target.value.length >= 10) setErrors(prev => ({ ...prev, description: '' }));
                }}
                placeholder="Enter detailed observation, involved parties, and actions taken..."
                rows={5}
                className={cn(
                  "w-full bg-white border rounded-xl px-4 py-3 text-sm transition-all resize-none focus:outline-none focus:ring-2",
                  errors.description 
                    ? "border-red-200 bg-red-50/30 text-red-900 focus:ring-red-500/10 focus:border-red-500" 
                    : "border-slate-200 text-slate-700 placeholder:text-slate-300 focus:ring-blue-500/20 focus:border-blue-500"
                )}
              />
              {errors.description && <p className="text-[10px] text-red-500 font-medium">{errors.description}</p>}
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Internal Officer Notes (Optional)</label>
              <textarea 
                value={report.officerNotes || ''}
                onChange={(e) => setReport(prev => ({ ...prev, officerNotes: e.target.value }))}
                placeholder="Confidential tactical observations, suspicious behaviors, or follow-up requirements..."
                rows={3}
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
              />
            </div>
          </div>

          {/* Signatures Section */}
          <div className={cn(
            "bg-white p-6 rounded-3xl border transition-all space-y-6 shadow-sm",
            errors.signatures ? "border-red-200 bg-red-50/10" : "border-slate-200"
          )}>
            <div className="flex items-center justify-between mb-2">
              <label className={cn(
                "text-[10px] font-bold uppercase tracking-widest flex items-center gap-2",
                errors.signatures ? "text-red-500" : "text-slate-400"
              )}>
                Digital Signatures & Assertions {errors.signatures && "• REQUIRED"}
              </label>
              <button 
                onClick={() => setShowSignaturePad(true)}
                className="text-blue-600 font-bold text-[10px] hover:underline flex items-center gap-1"
              >
                <UserPlus size={12} /> ADD PARTY
              </button>
            </div>

            <div className="space-y-3">
              {report.signatures?.length === 0 ? (
                <div className={cn(
                  "border-2 border-dashed rounded-2xl p-8 text-center",
                  errors.signatures ? "border-red-100 bg-red-50/30" : "border-slate-100 bg-slate-50/30"
                )}>
                  <PenTool size={24} className={cn("mx-auto mb-2", errors.signatures ? "text-red-200" : "text-slate-200")} />
                  <p className={cn(
                    "text-[10px] font-bold uppercase tracking-widest",
                    errors.signatures ? "text-red-400" : "text-slate-300"
                  )}>No signatures recorded</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {report.signatures?.map((sig, idx) => (
                    <motion.div 
                      key={idx}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 group"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-white rounded-lg border border-slate-200 p-1 flex items-center justify-center shadow-sm">
                          <img src={sig.data} alt="Signature" className="max-w-full max-h-full object-contain" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-800">{sig.name}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{sig.type}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => setReport(prev => ({ ...prev, signatures: prev.signatures?.filter((_, i) => i !== idx) }))}
                        className="p-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
            {errors.signatures && <p className="text-[10px] text-red-500 font-medium">{errors.signatures}</p>}

            <div className="p-4 bg-blue-50/30 rounded-2xl border border-blue-50 flex items-start gap-3">
              <CheckCircle size={16} className="text-blue-500 mt-0.5 shrink-0" />
              <p className="text-[10px] text-blue-700/70 leading-relaxed italic">
                By signing, parties acknowledge that statements provided are true and correct to the best of their knowledge at the time of recording.
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Mapping & Geo */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 space-y-6 shadow-sm flex flex-col h-full">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  Evidence Mapping
                </label>
                <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded flex items-center gap-1">
                  <div className="w-1 h-1 bg-blue-600 rounded-full animate-pulse" /> LIVE GPS SYNC
                </span>
              </div>
              
              <div className="space-y-3">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-start gap-3">
                  <MapPin size={18} className="text-blue-500 mt-0.5 shrink-0" />
                  <p className="text-sm font-medium text-slate-800 leading-relaxed">
                    {currentAddress}
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[9px] font-bold text-slate-300 uppercase tracking-widest mb-1 block">Latitude</label>
                    <div className="bg-slate-50 px-3 py-2 rounded-xl border border-slate-100 font-mono text-[11px] text-slate-600">
                      {report.location?.latitude.toFixed(6)}
                    </div>
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-slate-300 uppercase tracking-widest mb-1 block">Longitude</label>
                    <div className="bg-slate-50 px-3 py-2 rounded-xl border border-slate-100 font-mono text-[11px] text-slate-600">
                      {report.location?.longitude.toFixed(6)}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 min-h-[300px] rounded-2xl overflow-hidden border border-slate-100">
              <Map center={[report.location?.latitude || 14.5995, report.location?.longitude || 120.9842]} />
            </div>
            
            <button 
              onClick={() => {
                navigator.geolocation.getCurrentPosition((pos) => {
                  setReport(prev => ({
                    ...prev,
                    location: {
                      ...prev.location!,
                      latitude: pos.coords.latitude,
                      longitude: pos.coords.longitude
                    }
                  }));
                });
              }}
              className="w-full py-3 text-xs font-bold text-slate-400 hover:text-blue-600 transition-colors uppercase tracking-widest border border-dashed border-slate-200 rounded-xl hover:border-blue-200 hover:bg-blue-50/20"
            >
              Reset to Device Location
            </button>
          </div>
        </div>
      </div>

      {/* Floating Action Bar */}
      <div className="fixed bottom-0 left-20 right-0 p-6 bg-white/80 backdrop-blur-xl border-t border-slate-100 flex items-center justify-center z-50">
        <div className="max-w-5xl w-full flex items-center justify-between gap-6">
          <button 
            onClick={async () => {
              if (confirm('Discard this report? All unsaved data will be lost.')) {
                await clearFormDraft();
                window.location.reload();
              }
            }}
            className="px-6 py-4 text-slate-400 hover:text-red-500 transition-colors text-xs font-bold uppercase tracking-widest flex items-center gap-2"
          >
            <Trash2 size={16} /> Discard Case
          </button>
          
          <button 
            onClick={handleSubmit}
            disabled={isProcessing}
            className={cn(
              "flex-1 max-w-md flex items-center justify-center gap-3 py-4 rounded-2xl font-bold uppercase tracking-widest text-xs transition-all shadow-xl",
              isProcessing 
                ? "bg-slate-100 text-slate-300 cursor-not-allowed" 
                : "bg-blue-600 text-white active:scale-[0.98] shadow-blue-200 hover:bg-blue-700"
            )}
          >
            {isProcessing ? (
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
              >
                <Clock size={18} />
              </motion.div>
            ) : (
              <>
                <CheckCircle size={18} />
                Submit Official Report
              </>
            )}
          </button>
        </div>
      </div>

      {/* Signature Modal */}
      <AnimatePresence>
        {showSignaturePad && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl border border-slate-200 relative"
            >
              <div className="p-8 space-y-6">
                <div>
                  <h3 className="text-xl font-bold text-slate-800">Assign Identity</h3>
                  <p className="text-sm text-slate-400">Specify the party details before capturing signature.</p>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Full Legal Name</label>
                    <input 
                      type="text" 
                      value={currentParty.name}
                      onChange={(e) => setCurrentParty(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g. John Doe"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Party Type</label>
                    <select 
                      value={currentParty.type}
                      onChange={(e) => setCurrentParty(prev => ({ ...prev, type: e.target.value }))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium appearance-none"
                    >
                      <option>Involved Party</option>
                      <option>Witness</option>
                      <option>Legal Representative</option>
                      <option>Reporting Officer</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button 
                    onClick={() => {
                      setShowSignaturePad(false);
                      setSignatureStep('info');
                      setCurrentParty({ name: '', type: 'Involved Party' });
                    }}
                    className="flex-1 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    disabled={!currentParty.name}
                    onClick={() => setSignatureStep('pad')}
                    className={cn(
                      "flex-[2] py-4 rounded-2xl font-bold uppercase tracking-widest text-[10px] transition-all",
                      !currentParty.name ? "bg-slate-100 text-slate-300" : "bg-blue-600 text-white shadow-lg shadow-blue-200"
                    )}
                  >
                    Proceed to Sign
                  </button>
                </div>
              </div>

              {signatureStep === 'pad' && (
                <div className="absolute inset-0 z-10 bg-white">
                  <SignaturePad 
                    title={`Signature: ${currentParty.name}`}
                    onCancel={() => setSignatureStep('info')}
                    onSave={(data) => {
                      const newSignature = { ...currentParty, data };
                      setReport(prev => ({
                        ...prev,
                        signatures: [...(prev.signatures || []), newSignature]
                      }));
                      setShowSignaturePad(false);
                      setSignatureStep('info');
                      setCurrentParty({ name: '', type: 'Involved Party' });
                    }}
                  />
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
