/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import exifr from 'exifr';
import { createWorker } from 'tesseract.js';
import { Camera, MapPin, Clock, FileText, Upload, CheckCircle, Activity, RefreshCcw, AlertCircle, Trash2, X, PenTool, UserPlus, User as UserIcon, Car, Mic, MicOff, Square, Volume2, Play, Scan, Video, VideoOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import Map from './Map';
import SignaturePad from './SignaturePad';
import { reverseGeocode } from '../lib/geocoding';
import { saveDraft, setFormDraft, getFormDraft, clearFormDraft } from '../lib/db';
import { IncidentReport, LocationData, User } from '../types';
import { cn } from '../lib/utils';
import { analyzeIncidentMedia, generateNarrative, suggestIncidentType } from '../services/geminiService';
import { exportReportPDF } from '../services/pdfService';

const uuid = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
};

interface IncidentFormProps {
  currentUser: User | null;
}

export default function IncidentForm({ currentUser }: IncidentFormProps) {
  const [report, setReport] = useState<Partial<IncidentReport>>({
    tempId: uuid(),
    type: 'Vehicle Accident',
    description: '',
    officerNotes: '',
    impoundDetails: {
      towCompany: '',
      lotNumber: '',
      reason: '',
      inventoryNotes: ''
    },
    images: [],
    signatures: [],
    involvement: [],
    vehicles: [],
    audioNotes: [],
    videos: [],
    witnesses: [],
    status: 'draft',
    createdAt: new Date().toISOString(),
    location: {
      latitude: 14.5995, // Default Manila
      longitude: 120.9842,
      accuracy: undefined,
      timestamp: new Date().toISOString()
    }
  });

  const [isProcessing, setIsProcessing] = useState(false);
  const [locationSource, setLocationSource] = useState<'gps' | 'exif' | 'manual'>('gps');
  const [currentAddress, setCurrentAddress] = useState('Acquiring location...');
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [showInvolvementModal, setShowInvolvementModal] = useState(false);
  const [showVehicleModal, setShowVehicleModal] = useState(false);
  const [showWitnessModal, setShowWitnessModal] = useState(false);
  const [currentParty, setCurrentParty] = useState({ name: '', type: 'Involved Party' });
  const [involvementForm, setInvolvementForm] = useState({ name: '', type: 'Suspect' as const, description: '', contact: '', dob: '' });
  const [vehicleForm, setVehicleForm] = useState({ plate: '', make: '', model: '', color: '', notes: '' });
  const [witnessForm, setWitnessForm] = useState({ name: '', phone: '', address: '', statement: '' });
  const [signatureStep, setSignatureStep] = useState<'info' | 'pad'>('info');
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lpScanInputRef = useRef<HTMLInputElement>(null);

  // License Plate OCR State
  const [isScanningLP, setIsScanningLP] = useState(false);
  const [lpProcessingProgress, setLpProcessingProgress] = useState(0);
  const [ocrProcessingIdx, setOcrProcessingIdx] = useState<number | null>(null);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrResult, setOcrResult] = useState<{ text: string, idx: number } | null>(null);

  // AI Assistant State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<{ damageType: string; severity: string; identifiedItems: string[] } | null>(null);
  const [isGeneratingNarrative, setIsGeneratingNarrative] = useState(false);

  // Speech Recognition State
  const [isListening, setIsListening] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    // Initialize Speech Recognition
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        const field = isListening;
        if (field) {
          setReport(prev => ({
            ...prev,
            [field]: (prev[field as keyof Partial<IncidentReport>] || '') + (prev[field as keyof Partial<IncidentReport>] ? ' ' : '') + transcript
          }));
          
          if (field === 'description' && transcript.length > 0) {
            setErrors(prev => ({ ...prev, description: '' }));
          }
        }
        setIsListening(null);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech Recognition Error:', event.error);
        setIsListening(null);
      };

      recognitionRef.current.onend = () => {
        setIsListening(null);
      };
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [isListening]);

  const toggleListening = (field: string) => {
    if (isListening === field) {
      recognitionRef.current?.stop();
    } else {
      if (!(window as any).SpeechRecognition && !(window as any).webkitSpeechRecognition) {
        alert('Speech recognition is not supported in this browser.');
        return;
      }
      setIsListening(field);
      recognitionRef.current?.start();
    }
  };

  const handleGeneralOCR = async (idx: number) => {
    const imageData = report.images?.[idx];
    if (!imageData) return;

    setOcrProcessingIdx(idx);
    setOcrProgress(0);

    try {
      const worker = await createWorker('eng', 1, {
        logger: m => {
          if (m.status === 'recognizing text') {
            setOcrProgress(Math.round(m.progress * 100));
          }
        },
      });

      const { data: { text } } = await worker.recognize(imageData);
      
      const cleanedText = text.trim();
      
      if (cleanedText) {
        setOcrResult({ text: cleanedText, idx });
      } else {
        alert('No legible text detected in this image.');
      }
      
      await worker.terminate();
    } catch (err) {
      console.error('OCR Error:', err);
      alert('Failed to extract text. Ensure the image is clear and contains readable text.');
    } finally {
      setOcrProcessingIdx(null);
      setOcrProgress(0);
    }
  };

  const handleAIAnalysis = async () => {
    if (!report.images || report.images.length === 0) {
      alert("Capture at least one piece of evidence for AI analysis.");
      return;
    }
    
    setIsAnalyzing(true);
    try {
      const result = await analyzeIncidentMedia(report.images);
      if (result) {
        setAiAnalysis(result);
      }
    } catch (err) {
      console.error("AI Analysis Failed", err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSmartNarrative = async () => {
    if (!report.description || report.description.length < 10) {
      alert("Enter a brief description first for the AI to expand upon.");
      return;
    }

    setIsGeneratingNarrative(true);
    try {
      const result = await generateNarrative(report.description, report.officerNotes);
      if (result) {
        setReport(prev => ({ ...prev, description: result }));
      }
    } catch (err) {
      console.error("Narrative Generation Failed", err);
    } finally {
      setIsGeneratingNarrative(false);
    }
  };

  const handleLPScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanningLP(true);
    setLpProcessingProgress(0);

    try {
      const worker = await createWorker('eng', 1, {
        logger: m => {
          if (m.status === 'recognizing text') {
            setLpProcessingProgress(Math.round(m.progress * 100));
          }
        },
      });

      const { data: { text } } = await worker.recognize(file);
      
      // Clean up the text - usually license plates are alphanumeric
      // This is a naive regex, could be improved based on locale
      const cleanedPlate = text.replace(/[^A-Z0-9]/gi, '').toUpperCase();
      
      if (cleanedPlate) {
        setVehicleForm(prev => ({ ...prev, plate: cleanedPlate }));
      }
      
      await worker.terminate();
    } catch (err) {
      console.error('OCR Error:', err);
      alert('Failed to scan license plate. Please try capturing a clearer image or enter manually.');
    } finally {
      setIsScanningLP(false);
      setLpProcessingProgress(0);
      if (lpScanInputRef.current) lpScanInputRef.current.value = '';
    }
  };

  // Audio Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Video Recording State
  const [isRecordingVideo, setIsRecordingVideo] = useState(false);
  const [videoTime, setVideoTime] = useState(0);
  const videoMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const videoChunksRef = useRef<Blob[]>([]);
  const videoTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);

  const startVideoRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      videoMediaRecorderRef.current = mediaRecorder;
      videoChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          videoChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const videoBlob = new Blob(videoChunksRef.current, { type: 'video/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(videoBlob);
        reader.onloadend = () => {
          const base64data = reader.result as string;
          setReport(prev => ({
            ...prev,
            videos: [
              ...(prev.videos || []),
              {
                id: uuid(),
                data: base64data,
                timestamp: new Date().toISOString()
              }
            ]
          }));
        };
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecordingVideo(true);
      setVideoTime(0);
      videoTimerRef.current = setInterval(() => {
        setVideoTime(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Failed to start video recording', err);
      alert('Camera access denied or not available.');
    }
  };

  const stopVideoRecording = () => {
    if (videoMediaRecorderRef.current && isRecordingVideo) {
      videoMediaRecorderRef.current.stop();
      setIsRecordingVideo(false);
      if (videoTimerRef.current) clearInterval(videoTimerRef.current);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64data = reader.result as string;
          setReport(prev => ({
            ...prev,
            audioNotes: [
              ...(prev.audioNotes || []),
              {
                id: uuid(),
                data: base64data,
                duration: recordingTime,
                timestamp: new Date().toISOString()
              }
            ]
          }));
        };
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Failed to start recording', err);
      alert('Microphone access denied or not available.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

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

  // AI Auto-categorization
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (report.description && report.description.length > 50) {
        try {
          const suggestedType = await suggestIncidentType(report.description);
          const validTypes = ["Vehicle Accident", "Hit and Run", "Vehicle Impound", "Traffic Obstruction", "Public Disturbance", "Other / Assist"];
          if (suggestedType && validTypes.includes(suggestedType) && suggestedType !== report.type) {
            setReport(prev => ({ ...prev, type: suggestedType }));
          }
        } catch (err) {
          console.warn("Auto-categorization failed", err);
        }
      }
    }, 3000); // Debounce AI call

    return () => clearTimeout(timer);
  }, [report.description]);

  // Sync address on coordinate change
  useEffect(() => {
    if (report.location?.latitude && report.location?.longitude) {
      updateAddress(report.location.latitude, report.location.longitude);
    }
  }, [report.location?.latitude, report.location?.longitude]);

  // Live GPS Watch
  useEffect(() => {
    if (!navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        // Only update if we are in GPS tracking mode
        if (locationSource !== 'gps') return;

        setReport(prev => ({
          ...prev,
          location: {
            ...(prev.location || {}),
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            timestamp: new Date().toISOString()
          } as LocationData
        }));
      },
      (err) => console.error('GPS Watch Error:', err),
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [locationSource]);

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
        ...(prev.location || {}),
        latitude: lat,
        longitude: lon,
        address: data.address,
        barangay: data.barangay,
        city: data.city
      } as LocationData
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
        // 1. Extract EXIF (GPS and Timestamp)
        try {
          const exifData = await exifr.parse(file, {
            gps: true,
            pick: ['latitude', 'longitude', 'DateTimeOriginal', 'CreateDate', 'ModifyDate']
          });

          if (exifData && exifData.latitude && exifData.longitude) {
            const photoDate = exifData.DateTimeOriginal || exifData.CreateDate || exifData.ModifyDate;
            newLocation = {
              ...newLocation,
              latitude: exifData.latitude,
              longitude: exifData.longitude,
              timestamp: photoDate instanceof Date ? photoDate.toISOString() : (photoDate || newLocation.timestamp)
            };
            locationUpdated = true;
            setLocationSource('exif');
          }
        } catch (exifErr) {
          console.warn('EXIF extraction skipped or failed for file:', file.name, exifErr);
        }

        // 2. Read file as Base64 for preview
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error('File reading failed'));
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
      const finalReport = { 
        ...report, 
        status: currentUser?.role === 'Supervisor' ? 'approved' : 'pending' as const,
        submittedBy: currentUser?.badgeNumber,
        updatedAt: new Date().toISOString()
      };
      await saveDraft(finalReport as IncidentReport);
      await clearFormDraft();
      alert('Report submitted successfully to central database.');
      setIsProcessing(false);
      // Reset form
      setReport({
        tempId: uuid(),
        type: 'Vehicle Accident',
        description: '',
        officerNotes: '',
        impoundDetails: {
          towCompany: '',
          lotNumber: '',
          reason: '',
          inventoryNotes: ''
        },
        images: [],
        signatures: [],
        involvement: [],
        vehicles: [],
        audioNotes: [],
        videos: [],
        witnesses: [],
        status: 'draft',
        createdAt: new Date().toISOString(),
        location: { 
          latitude: 14.5995, 
          longitude: 120.9842, 
          accuracy: undefined,
          timestamp: new Date().toISOString() 
        }
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
           <button 
             onClick={() => exportReportPDF(report as IncidentReport)}
             className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-slate-800 transition-all"
           >
             <FileText size={14} /> Export PDF
           </button>
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
              <div className="flex items-center gap-4">
                <button 
                  onClick={handleAIAnalysis}
                  disabled={isAnalyzing || !report.images?.length}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all",
                    isAnalyzing ? "bg-amber-100 text-amber-600" : "bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
                  )}
                >
                  {isAnalyzing ? (
                    <RefreshCcw size={12} className="animate-spin" />
                  ) : (
                    <Activity size={12} />
                  )}
                  {isAnalyzing ? "Analyzing..." : "AI Intelligence"}
                </button>
                {!isRecordingVideo ? (
                  <button 
                    onClick={startVideoRecording}
                    className="text-red-600 font-black text-[10px] hover:underline flex items-center gap-1.5 uppercase tracking-widest"
                  >
                    <Video size={14} /> Record Video
                  </button>
                ) : (
                  <button 
                    onClick={stopVideoRecording}
                    className="text-slate-900 font-black text-[10px] flex items-center gap-1.5 uppercase tracking-widest animate-pulse"
                  >
                    <VideoOff size={14} /> Stop ({formatTime(videoTime)})
                  </button>
                )}
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="text-blue-600 font-bold text-[10px] hover:underline flex items-center gap-1 uppercase tracking-widest"
                >
                  <Camera size={12} /> Camera
                </button>
              </div>
            </div>
            
            {aiAnalysis && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-5 bg-gradient-to-br from-indigo-600 to-blue-700 rounded-2xl text-white space-y-3 shadow-xl relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <Activity size={80} />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle size={16} className="text-blue-300" />
                    <span className="text-[10px] font-black uppercase tracking-widest">AI Intelligence Assessment</span>
                  </div>
                  <button onClick={() => setAiAnalysis(null)} className="p-1 hover:bg-white/10 rounded-full transition-colors">
                    <X size={14} />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[8px] font-bold text-blue-200 uppercase tracking-tighter">Severity Index</p>
                    <p className="text-sm font-black">{aiAnalysis.severity}</p>
                  </div>
                  <div>
                    <p className="text-[8px] font-bold text-blue-200 uppercase tracking-tighter">Damage Type</p>
                    <p className="text-sm font-black">{aiAnalysis.damageType}</p>
                  </div>
                </div>
                <div>
                   <p className="text-[8px] font-bold text-blue-200 uppercase tracking-tighter mb-1">Identified Assets</p>
                   <div className="flex flex-wrap gap-2">
                     {aiAnalysis.identifiedItems.map((item, i) => (
                       <span key={i} className="px-2 py-1 bg-white/10 backdrop-blur-md rounded-lg text-[9px] font-black">
                         {item}
                       </span>
                     ))}
                   </div>
                </div>
              </motion.div>
            )}

            <div className="grid grid-cols-3 gap-3">
              <AnimatePresence>
                {report.images?.map((img, idx) => (
                  <motion.div 
                    key={`img-${idx}`}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="relative aspect-square rounded-2xl overflow-hidden border border-slate-100 bg-slate-50 group"
                  >
                    <img src={img} alt="Evidence" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                       {ocrProcessingIdx === idx ? (
                         <div className="flex-1 bg-white/90 backdrop-blur-md rounded-xl p-1.5 flex items-center gap-2">
                           <div className="w-4 h-4 border-2 border-slate-200 border-t-indigo-600 rounded-full animate-spin" />
                           <span className="text-[10px] font-black text-slate-800 uppercase tracking-widest">{ocrProgress}%</span>
                         </div>
                       ) : (
                         <>
                           <button 
                             onClick={() => handleGeneralOCR(idx)}
                             title="Extract Text (OCR)"
                             className="flex-1 bg-indigo-600/90 backdrop-blur-md text-white py-2 rounded-xl shadow-lg border border-indigo-500/50 hover:bg-indigo-600 transition-all flex items-center justify-center gap-1.5"
                           >
                             <Scan size={14} />
                             <span className="text-[9px] font-black uppercase tracking-widest">OCR</span>
                           </button>
                           <button 
                             onClick={() => setReport(prev => ({ ...prev, images: prev.images?.filter((_, i) => i !== idx) }))}
                             className="bg-white/90 backdrop-blur-md text-slate-900 p-2 rounded-xl shadow-lg border border-slate-200 hover:bg-white transition-all"
                           >
                             <Trash2 size={14} />
                           </button>
                         </>
                       )}
                    </div>
                  </motion.div>
                ))}
                {report.videos?.map((vid) => (
                  <motion.div 
                    key={vid.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="relative aspect-square rounded-2xl overflow-hidden border border-red-100 bg-slate-900 group"
                  >
                    <video src={vid.data} className="w-full h-full object-cover" />
                    <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-red-600 text-[8px] font-black text-white rounded uppercase tracking-tighter shadow-lg flex items-center gap-1">
                      <div className="w-1 h-1 bg-white rounded-full animate-pulse" /> MP4 EVIDENCE
                    </div>
                    <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
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
                        className="bg-white text-slate-900 p-2 rounded-xl shadow-xl hover:bg-slate-100 transition-colors"
                      >
                        <Play size={14} />
                      </button>
                      <button 
                        onClick={() => setReport(prev => ({ ...prev, videos: prev.videos?.filter(v => v.id !== vid.id) }))}
                        className="bg-red-600 text-white p-2 rounded-xl shadow-xl hover:bg-red-500 transition-colors"
                      >
                        <Trash2 size={14} />
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
                <option>Vehicle Impound</option>
                <option>Traffic Obstruction</option>
                <option>Public Disturbance</option>
                <option>Other / Assist</option>
              </select>
            </div>

            {report.type === 'Vehicle Impound' && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-4 pt-2 border-t border-slate-100"
              >
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Tow Company</label>
                    <input 
                      type="text"
                      value={report.impoundDetails?.towCompany || ''}
                      onChange={(e) => setReport(prev => ({ 
                        ...prev, 
                        impoundDetails: { ...prev.impoundDetails!, towCompany: e.target.value } 
                      }))}
                      placeholder="Company Name"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Lot Number / Location</label>
                    <input 
                      type="text"
                      value={report.impoundDetails?.lotNumber || ''}
                      onChange={(e) => setReport(prev => ({ 
                        ...prev, 
                        impoundDetails: { ...prev.impoundDetails!, lotNumber: e.target.value } 
                      }))}
                      placeholder="Storage Lot #"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Legal Reason for Impound</label>
                  <input 
                    type="text"
                    value={report.impoundDetails?.reason || ''}
                    onChange={(e) => setReport(prev => ({ 
                      ...prev, 
                      impoundDetails: { ...prev.impoundDetails!, reason: e.target.value } 
                    }))}
                    placeholder="e.g. Evidence, Illegal Parking, Unregistered"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Inventory Notes (Valuables/Damage)</label>
                  <textarea 
                    rows={2}
                    value={report.impoundDetails?.inventoryNotes || ''}
                    onChange={(e) => setReport(prev => ({ 
                      ...prev, 
                      impoundDetails: { ...prev.impoundDetails!, inventoryNotes: e.target.value } 
                    }))}
                    placeholder="List personal property left in vehicle, existing damage, etc."
                    className="w-full bg-slate-100 border border-slate-200 rounded-xl px-4 py-3 text-sm resize-none"
                  />
                </div>
              </motion.div>
            )}

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className={cn(
                  "text-[10px] font-bold uppercase tracking-widest block",
                  errors.description ? "text-red-500" : "text-slate-400"
                )}>
                  Officer Summary {errors.description && "• REQUIRED"}
                </label>
                <div className="flex items-center gap-2">
                  <button 
                    type="button"
                    onClick={handleSmartNarrative}
                    disabled={isGeneratingNarrative || !report.description}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all shadow-sm",
                      isGeneratingNarrative ? "bg-slate-100 text-slate-400 font-bold" : "bg-slate-900 text-white hover:bg-slate-800"
                    )}
                  >
                    {isGeneratingNarrative ? <RefreshCcw size={10} className="animate-spin" /> : <PenTool size={10} />}
                    {isGeneratingNarrative ? "Generating..." : "Smart Assistant"}
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleListening('description')}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all",
                      isListening === 'description' 
                        ? "bg-red-500 text-white animate-pulse" 
                        : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                    )}
                  >
                    {isListening === 'description' ? <MicOff size={10} /> : <Mic size={10} />}
                    {isListening === 'description' ? "Listening..." : "Dictate"}
                  </button>
                </div>
              </div>
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

            {/* Tactical Audio Section */}
            <div className="space-y-4 pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Tactical Audio Logs</label>
                {!isRecording ? (
                  <button 
                    type="button"
                    onClick={startRecording}
                    className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-100 transition-colors"
                  >
                    <Mic size={14} /> Start Record
                  </button>
                ) : (
                  <button 
                    type="button"
                    onClick={stopRecording}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest animate-pulse"
                  >
                    <Square size={14} /> Stop ({formatTime(recordingTime)})
                  </button>
                )}
              </div>

              <div className="space-y-2">
                {report.audioNotes?.length === 0 ? (
                  <div className="p-6 border-2 border-dashed border-slate-100 rounded-2xl text-center">
                    <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">No audio statements captured</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2">
                    {report.audioNotes?.map((note) => (
                      <div key={note.id} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between group">
                        <div className="flex items-center gap-3">
                           <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600">
                             <Volume2 size={18} />
                           </div>
                           <div>
                             <p className="text-xs font-black text-slate-800 uppercase tracking-tight">Audio Note {note.id.slice(0, 4)}</p>
                             <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                               {formatTime(note.duration)} • {new Date(note.timestamp).toLocaleTimeString()}
                             </p>
                           </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <audio src={note.data} className="hidden" id={`audio-${note.id}`} />
                          <button 
                            type="button"
                            onClick={() => {
                              const el = document.getElementById(`audio-${note.id}`) as HTMLAudioElement;
                              el?.play();
                            }}
                            className="p-3 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-blue-500 transition-all shadow-sm"
                          >
                            <Play size={14} />
                          </button>
                          <button 
                            type="button"
                            onClick={() => setReport(prev => ({ ...prev, audioNotes: prev.audioNotes?.filter(n => n.id !== note.id) }))}
                            className="p-3 bg-white border border-slate-200 rounded-xl text-slate-300 hover:text-red-500 transition-all shadow-sm"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Internal Officer Notes (Optional)</label>
                <button
                  type="button"
                  onClick={() => toggleListening('officerNotes')}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all",
                    isListening === 'officerNotes' 
                      ? "bg-red-500 text-white animate-pulse" 
                      : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                  )}
                >
                  {isListening === 'officerNotes' ? <MicOff size={10} /> : <Mic size={10} />}
                  {isListening === 'officerNotes' ? "Listening..." : "Dictate"}
                </button>
              </div>
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
          {/* Involvement Section */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 space-y-6 shadow-sm">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                <UserPlus size={12} className="text-blue-500" /> Involvement Records
              </label>
              <button 
                onClick={() => setShowInvolvementModal(true)}
                className="text-blue-600 font-bold text-[10px] hover:underline"
              >
                + ADD PERSON
              </button>
            </div>
            
            <div className="space-y-3">
              {report.involvement?.length === 0 ? (
                <div className="p-8 border-2 border-dashed border-slate-100 rounded-2xl text-center">
                  <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">No persons recorded</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  {report.involvement?.map((person) => (
                    <div key={person.id} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between group">
                      <div className="flex items-center gap-3">
                         <div className={cn(
                           "w-8 h-8 rounded-lg flex items-center justify-center text-white",
                           person.type === 'Suspect' ? "bg-red-500" :
                           person.type === 'Witness' ? "bg-blue-500" : "bg-slate-500"
                         )}>
                           <UserIcon size={14} />
                         </div>
                         <div>
                           <p className="text-xs font-black text-slate-800 uppercase tracking-tight">{person.name}</p>
                           <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{person.type} {person.description && `• ${person.description.slice(0, 20)}...`}</p>
                         </div>
                      </div>
                      <button 
                        onClick={() => setReport(prev => ({ ...prev, involvement: prev.involvement?.filter(p => p.id !== person.id) }))}
                        className="p-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Witnesses Section */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 space-y-6 shadow-sm">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                <UserIcon size={12} className="text-blue-500" /> Witness Statements
              </label>
              <button 
                onClick={() => setShowWitnessModal(true)}
                className="text-blue-600 font-bold text-[10px] hover:underline"
              >
                + ADD WITNESS
              </button>
            </div>
            
            <div className="space-y-3">
              {report.witnesses?.length === 0 ? (
                <div className="p-8 border-2 border-dashed border-slate-100 rounded-2xl text-center">
                  <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">No witness statements recorded</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  {report.witnesses?.map((witness) => (
                    <div key={witness.id} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex flex-col gap-3 group">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                           <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center text-white">
                             <UserIcon size={14} />
                           </div>
                           <div>
                             <p className="text-xs font-black text-slate-800 uppercase tracking-tight">{witness.name}</p>
                             <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{witness.phone} • {witness.address?.slice(0, 30)}...</p>
                           </div>
                        </div>
                        <button 
                          onClick={() => setReport(prev => ({ ...prev, witnesses: prev.witnesses?.filter(w => w.id !== witness.id) }))}
                          className="p-2 text-slate-300 hover:text-red-500 transition-all"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <div className="p-3 bg-white/50 border border-slate-100 rounded-xl">
                        <p className="text-[10px] text-slate-500 italic font-medium leading-relaxed">
                          "{witness.statement}"
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Vehicles Section */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 space-y-6 shadow-sm">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                <Car size={12} className="text-blue-500" /> Vehicle Identification
              </label>
              <button 
                onClick={() => setShowVehicleModal(true)}
                className="text-blue-600 font-bold text-[10px] hover:underline"
              >
                + ADD VEHICLE
              </button>
            </div>
            
            <div className="space-y-3">
              {report.vehicles?.length === 0 ? (
                <div className="p-8 border-2 border-dashed border-slate-100 rounded-2xl text-center">
                  <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">No vehicles recorded</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  {report.vehicles?.map((v) => (
                    <div key={v.id} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between group">
                      <div className="flex items-center gap-3">
                         <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-white">
                           <Car size={14} />
                         </div>
                         <div>
                           <p className="text-xs font-black text-slate-800 uppercase tracking-tight">{v.plate}</p>
                           <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{v.color} {v.make} {v.model}</p>
                         </div>
                      </div>
                      <button 
                        onClick={() => setReport(prev => ({ ...prev, vehicles: prev.vehicles?.filter(veh => veh.id !== v.id) }))}
                        className="p-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200 space-y-6 shadow-sm flex flex-col h-full">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  Evidence Mapping
                </label>
                <div className="flex items-center gap-2">
                  {report.location?.accuracy && (
                    <span className={cn(
                      "text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-tighter transition-colors",
                      report.location.accuracy < 20 ? "bg-green-100 text-green-700" :
                      report.location.accuracy < 50 ? "bg-amber-100 text-amber-700" :
                      "bg-red-100 text-red-700"
                    )}>
                      ±{Math.round(report.location.accuracy)}m Accuracy
                    </span>
                  )}
                  <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded flex items-center gap-1">
                    <div className="w-1 h-1 bg-blue-600 rounded-full animate-pulse" /> LIVE GPS SYNC
                  </span>
                </div>
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

            <div className="flex-1 min-h-[300px] rounded-2xl overflow-hidden border border-slate-100 relative">
              {locationSource === 'exif' && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000]">
                  <button 
                    type="button"
                    onClick={() => setLocationSource('gps')}
                    className="bg-blue-600 text-white px-4 py-2 rounded-full shadow-xl flex items-center gap-2 text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all border border-blue-500 whitespace-nowrap"
                  >
                    <Clock size={12} /> Sync with Live GPS
                  </button>
                </div>
              )}
              <Map 
                center={[report.location?.latitude || 14.5995, report.location?.longitude || 120.9842]} 
                accuracy={report.location?.accuracy}
              />
            </div>
            
            <button 
              type="button"
              onClick={() => {
                setLocationSource('gps');
                navigator.geolocation.getCurrentPosition((pos) => {
                  setReport(prev => ({
                    ...prev,
                    location: {
                      ...prev.location!,
                      latitude: pos.coords.latitude,
                      longitude: pos.coords.longitude,
                      accuracy: pos.coords.accuracy
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

      <AnimatePresence>
        {showInvolvementModal && (
          <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-white w-full max-w-lg rounded-3xl shadow-2xl p-8 space-y-6">
               <h3 className="text-xl font-bold italic">Add Involvement Record</h3>
               <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Subject Name</label>
                    <input type="text" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm" value={involvementForm.name} onChange={e => setInvolvementForm({...involvementForm, name: e.target.value})} />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Role</label>
                    <select className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm" value={involvementForm.type} onChange={e => setInvolvementForm({...involvementForm, type: e.target.value as any})}>
                      <option>Suspect</option>
                      <option>Witness</option>
                      <option>Victim</option>
                      <option>Reporting Person</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">DOB</label>
                    <input type="date" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm" value={involvementForm.dob} onChange={e => setInvolvementForm({...involvementForm, dob: e.target.value})} />
                  </div>
                  <div className="col-span-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Description / Tattoos / Physicals</label>
                    <textarea rows={2} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm" value={involvementForm.description} onChange={e => setInvolvementForm({...involvementForm, description: e.target.value})} />
                  </div>
               </div>
               <div className="flex gap-4">
                 <button onClick={() => setShowInvolvementModal(false)} className="flex-1 text-slate-400 text-xs font-bold uppercase tracking-widest">Cancel</button>
                 <button onClick={() => {
                   setReport(prev => ({ ...prev, involvement: [...(prev.involvement || []), { ...involvementForm, id: uuid() }] }));
                   setShowInvolvementModal(false);
                   setInvolvementForm({ name: '', type: 'Suspect', description: '', contact: '', dob: '' });
                 }} className="flex-1 bg-blue-600 text-white py-4 rounded-2xl font-bold uppercase tracking-widest text-[10px]">Add Record</button>
               </div>
            </motion.div>
          </div>
        )}

        {showWitnessModal && (
          <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-white w-full max-w-lg rounded-3xl shadow-2xl p-8 space-y-6">
               <h3 className="text-xl font-bold italic">Capture Witness Statement</h3>
               <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Witness Full Name</label>
                    <input type="text" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm" value={witnessForm.name} onChange={e => setWitnessForm({...witnessForm, name: e.target.value})} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Phone Number</label>
                      <input type="tel" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm" value={witnessForm.phone} onChange={e => setWitnessForm({...witnessForm, phone: e.target.value})} />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Address</label>
                      <input type="text" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm" value={witnessForm.address} onChange={e => setWitnessForm({...witnessForm, address: e.target.value})} />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Official Statement / Notes</label>
                    <textarea rows={4} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm resize-none" value={witnessForm.statement} onChange={e => setWitnessForm({...witnessForm, statement: e.target.value})} placeholder="What did the witness observe? Include key tactical details..." />
                  </div>
               </div>
               <div className="flex gap-4">
                 <button onClick={() => setShowWitnessModal(false)} className="flex-1 text-slate-400 text-xs font-bold uppercase tracking-widest">Cancel</button>
                 <button onClick={() => {
                   setReport(prev => ({ ...prev, witnesses: [...(prev.witnesses || []), { ...witnessForm, id: uuid(), timestamp: new Date().toISOString() }] }));
                   setShowWitnessModal(false);
                   setWitnessForm({ name: '', phone: '', address: '', statement: '' });
                 }} className="flex-1 bg-blue-600 text-white py-4 rounded-2xl font-bold uppercase tracking-widest text-[10px]">Save Statement</button>
               </div>
            </motion.div>
          </div>
        )}

        {ocrResult && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xl">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              className="bg-white w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden"
            >
              <div className="bg-indigo-600 p-8 flex items-center justify-between text-white">
                <div className="flex items-center gap-4">
                   <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md">
                     <Scan size={24} />
                   </div>
                   <div>
                     <h3 className="text-xl font-black uppercase tracking-tighter italic">OCR Text Extraction</h3>
                     <p className="text-[10px] font-bold text-white/60 uppercase tracking-widest">Review and append to narrative</p>
                   </div>
                </div>
                <button onClick={() => setOcrResult(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="p-8 space-y-6">
                <div className="flex gap-6">
                  <div className="w-32 aspect-square rounded-2xl overflow-hidden border border-slate-100 shrink-0">
                    <img src={report.images?.[ocrResult.idx]} alt="OCR Source" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 space-y-4">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                       <FileText size={12} className="text-indigo-500" /> Extracted Intelligence
                    </label>
                    <textarea 
                      className="w-full bg-slate-50 border border-slate-200 rounded-3xl p-6 text-sm font-medium leading-relaxed italic text-slate-700 min-h-[200px] resize-none focus:ring-4 focus:ring-indigo-100 transition-all outline-none"
                      value={ocrResult.text}
                      onChange={(e) => setOcrResult({ ...ocrResult, text: e.target.value })}
                    />
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    onClick={() => setOcrResult(null)}
                    className="flex-1 py-5 rounded-3xl text-slate-400 font-black uppercase tracking-widest text-[11px] hover:text-slate-900 transition-colors"
                  >
                    Discard Scan
                  </button>
                  <button 
                    onClick={() => {
                      setReport(prev => ({
                        ...prev,
                        description: (prev.description ? prev.description + '\n\n' : '') + `[INTEL ATTACHMENT - CLIP ${ocrResult.idx + 1}]:\n${ocrResult.text}`
                      }));
                      setOcrResult(null);
                    }}
                    className="flex-[2] py-5 bg-indigo-600 text-white rounded-3xl font-black uppercase tracking-widest text-[11px] shadow-xl hover:bg-indigo-500 transition-all flex items-center justify-center gap-3"
                  >
                    <CheckCircle size={16} /> Append to Narrative
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {showVehicleModal && (
          <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-white w-full max-w-lg rounded-3xl shadow-2xl p-8 space-y-6">
               <h3 className="text-xl font-bold italic">Identify Vehicle</h3>
               <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">License Plate</label>
                      <button 
                        type="button" 
                        onClick={() => lpScanInputRef.current?.click()}
                        disabled={isScanningLP}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all",
                          isScanningLP ? "bg-slate-100 text-slate-400" : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm"
                        )}
                      >
                        <Scan size={12} /> {isScanningLP ? `Scanning ${lpProcessingProgress}%` : "Scan Plate"}
                      </button>
                      <input 
                        type="file" 
                        ref={lpScanInputRef} 
                        onChange={handleLPScan} 
                        accept="image/*" 
                        capture="environment"
                        className="hidden" 
                      />
                    </div>
                    <input 
                      type="text" 
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm uppercase font-mono tracking-widest focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium" 
                      value={vehicleForm.plate} 
                      onChange={e => setVehicleForm({...vehicleForm, plate: e.target.value})} 
                      placeholder="ABC 1234"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Make</label>
                    <input type="text" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm" value={vehicleForm.make} onChange={e => setVehicleForm({...vehicleForm, make: e.target.value})} />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Model</label>
                    <input type="text" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm" value={vehicleForm.model} onChange={e => setVehicleForm({...vehicleForm, model: e.target.value})} />
                  </div>
                  <div className="col-span-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Color & Distinct Features</label>
                    <input type="text" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm" value={vehicleForm.color} onChange={e => setVehicleForm({...vehicleForm, color: e.target.value})} />
                  </div>
               </div>
               <div className="flex gap-4">
                 <button onClick={() => setShowVehicleModal(false)} className="flex-1 text-slate-400 text-xs font-bold uppercase tracking-widest">Cancel</button>
                 <button onClick={() => {
                   setReport(prev => ({ ...prev, vehicles: [...(prev.vehicles || []), { ...vehicleForm, id: uuid() }] }));
                   setShowVehicleModal(false);
                   setVehicleForm({ plate: '', make: '', model: '', color: '', notes: '' });
                 }} className="flex-1 bg-blue-600 text-white py-4 rounded-2xl font-bold uppercase tracking-widest text-[10px]">Log Vehicle</button>
               </div>
            </motion.div>
          </div>
        )}

        {showSignaturePad && (
          <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
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
