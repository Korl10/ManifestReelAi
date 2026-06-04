'use client';
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mic, Square, Upload, Loader2, Play, Pause, Check } from 'lucide-react';
import { toast } from 'sonner';

type NewVoice = { id: string; name: string; source: string; audio: string };

export function AddVoiceModal({
  open,
  onClose,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  onAdded: (v: NewVoice) => void;
}) {
  const [name, setName] = useState('');
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [source, setSource] = useState<'record' | 'upload'>('record');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);
  const previewRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!open) {
      // reset on close
      stopTimer();
      setName(''); setRecording(false); setSeconds(0); setBlob(null);
      setFileName(''); setSaving(false); setPreviewing(false); setSource('record');
      if (blobUrl) { URL.revokeObjectURL(blobUrl); setBlobUrl(null); }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const stopTimer = () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const b = new Blob(chunksRef.current, { type: 'audio/webm' });
        setBlob(b);
        if (blobUrl) URL.revokeObjectURL(blobUrl);
        setBlobUrl(URL.createObjectURL(b));
        stream.getTracks().forEach((t) => t.stop());
      };
      mediaRecorderRef.current = mr;
      mr.start();
      setRecording(true);
      setSeconds(0);
      setBlob(null);
      timerRef.current = setInterval(() => {
        setSeconds((s) => {
          if (s >= 29) { stopRecording(); return 30; }
          return s + 1;
        });
      }, 1000);
    } catch {
      toast.error('Microphone access denied. Please allow mic access or upload a file instead.');
    }
  };

  const stopRecording = () => {
    stopTimer();
    setRecording(false);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith('audio/')) { toast.error('Please choose an audio file.'); return; }
    if (f.size > 25 * 1024 * 1024) { toast.error('File too large (max 25MB).'); return; }
    setBlob(f);
    setFileName(f.name);
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    setBlobUrl(URL.createObjectURL(f));
    if (!name) setName(f.name.replace(/\.[^.]+$/, '').slice(0, 40));
  };

  const togglePreview = () => {
    const el = previewRef.current;
    if (!el) return;
    if (previewing) { el.pause(); setPreviewing(false); }
    else { el.currentTime = 0; el.play().catch(() => {}); setPreviewing(true); }
  };

  const handleSave = async () => {
    if (!blob) { toast.error('Record or upload a voice sample first.'); return; }
    if (!name.trim()) { toast.error('Give your voice a name.'); return; }
    setSaving(true);
    try {
      const ext = source === 'record' ? 'webm' : (fileName.split('.').pop() || 'mp3');
      const contentType = blob.type || (source === 'record' ? 'audio/webm' : 'audio/mpeg');
      const uploadName = `${name.trim().replace(/[^a-zA-Z0-9._-]/g, '_')}-${Date.now()}.${ext}`;

      // 1) get presigned URL
      const presignRes = await fetch('/api/voices/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: uploadName, contentType }),
      });
      const presign = await presignRes.json();
      if (!presignRes.ok) throw new Error(presign?.error || 'Failed to get upload URL');

      // 2) upload directly to cloud storage (public file => must send content-disposition)
      const putRes = await fetch(presign.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': contentType, 'Content-Disposition': 'attachment' },
        body: blob,
      });
      if (!putRes.ok) throw new Error('Upload failed');

      // 3) save record
      const saveRes = await fetch('/api/voices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), cloud_storage_path: presign.cloud_storage_path, durationSec: source === 'record' ? seconds : undefined, source }),
      });
      const saved = await saveRes.json();
      if (!saveRes.ok) throw new Error(saved?.error || 'Failed to save voice');

      toast.success('Your voice was added! \u2728');
      onAdded(saved);
      onClose();
    } catch (err: any) {
      toast.error(err?.message || 'Could not save your voice. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md rounded-2xl bg-[#121212] border border-white/10 p-6 shadow-2xl"
          >
            <button onClick={onClose} className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
            <h3 className="font-display text-xl font-bold mb-1">Add Your Own <span className="text-[#D4AF37]">Voice</span></h3>
            <p className="text-sm text-white/50 mb-5">Record or upload a sample to narrate your reels in your unique voice.</p>

            {/* Mode toggle */}
            <div className="flex gap-2 mb-5">
              <button onClick={() => setSource('record')} className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 ${source === 'record' ? 'gold-gradient text-black' : 'bg-white/5 text-white/60 border border-white/10'}`}><Mic className="w-4 h-4" /> Record</button>
              <button onClick={() => setSource('upload')} className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 ${source === 'upload' ? 'gold-gradient text-black' : 'bg-white/5 text-white/60 border border-white/10'}`}><Upload className="w-4 h-4" /> Upload</button>
            </div>

            {/* Record mode */}
            {source === 'record' && (
              <div className="flex flex-col items-center gap-3 mb-5">
                {!recording ? (
                  <button onClick={startRecording} className="w-20 h-20 rounded-full bg-[#7B2FBE]/20 border-2 border-[#7B2FBE] flex items-center justify-center hover:bg-[#7B2FBE]/30 transition-all">
                    <Mic className="w-8 h-8 text-[#A855F7]" />
                  </button>
                ) : (
                  <button onClick={stopRecording} className="w-20 h-20 rounded-full bg-red-500/20 border-2 border-red-500 flex items-center justify-center animate-pulse">
                    <Square className="w-7 h-7 text-red-400" fill="currentColor" />
                  </button>
                )}
                <p className="text-sm text-white/60">{recording ? `Recording... ${seconds}s / 30s` : blob ? 'Recorded \u2713 Tap mic to redo' : 'Tap to start recording'}</p>
              </div>
            )}

            {/* Upload mode */}
            {source === 'upload' && (
              <label className="flex flex-col items-center gap-2 mb-5 p-6 rounded-xl border-2 border-dashed border-white/15 hover:border-[#D4AF37]/50 transition-all cursor-pointer">
                <Upload className="w-7 h-7 text-white/40" />
                <span className="text-sm text-white/60">{fileName || 'Click to choose an audio file'}</span>
                <span className="text-[11px] text-white/30">MP3, WAV, M4A \u2014 max 25MB</span>
                <input type="file" accept="audio/*" onChange={handleFile} className="hidden" />
              </label>
            )}

            {/* Preview */}
            {blobUrl && (
              <div className="flex items-center gap-3 mb-4 p-3 rounded-xl bg-white/5 border border-white/10">
                <button onClick={togglePreview} className="w-10 h-10 rounded-full gold-gradient flex items-center justify-center shrink-0">
                  {previewing ? <Pause className="w-4 h-4 text-black" /> : <Play className="w-4 h-4 text-black ml-0.5" />}
                </button>
                <span className="text-sm text-white/70">Preview your sample</span>
                <audio ref={previewRef} src={blobUrl} onEnded={() => setPreviewing(false)} className="hidden" />
              </div>
            )}

            {/* Name */}
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name this voice (e.g. My Voice)"
              maxLength={40}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-[#D4AF37]/50 text-sm mb-4"
            />

            <button
              onClick={handleSave}
              disabled={saving || !blob || !name.trim()}
              className="w-full py-3 rounded-xl gold-gradient text-black font-bold text-sm hover:opacity-90 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : <><Check className="w-4 h-4" /> Save Voice</>}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
