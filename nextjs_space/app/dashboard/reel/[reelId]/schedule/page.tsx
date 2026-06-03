'use client';
import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Calendar, Download, Clock, ArrowLeft, Check, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

const PLATFORMS = [
  { id: 'tiktok', name: 'TikTok', color: '#FF0050' },
  { id: 'instagram', name: 'Instagram', color: '#E4405F' },
  { id: 'youtube', name: 'YouTube Shorts', color: '#FF0000' },
];

export default function SchedulePage() {
  const params = useParams();
  const router = useRouter();
  const reelId = params?.reelId as string;
  const [platform, setPlatform] = useState('tiktok');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [scheduling, setScheduling] = useState(false);
  const [scheduled, setScheduled] = useState(false);
  const [error, setError] = useState('');

  const handleSchedule = async () => {
    if (!date || !time) { toast.error('Please select both date and time'); return; }
    setScheduling(true);
    setError('');
    try {
      const scheduledAt = new Date(`${date}T${time}`);
      if (isNaN(scheduledAt.getTime())) { toast.error('Invalid date/time'); return; }
      if (scheduledAt <= new Date()) { toast.error('Scheduled time must be in the future'); return; }

      const res = await fetch('/api/social/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reelId, platform, scheduledAt: scheduledAt.toISOString() }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.error ?? 'Scheduling failed');
      }
      setScheduled(true);
      toast.success('Reel scheduled! Download and post at the scheduled time.');
    } catch (err: any) {
      setError(err?.message ?? 'Scheduling failed');
      toast.error(err?.message ?? 'Scheduling failed');
    }
    finally { setScheduling(false); }
  };

  return (
    <div className="max-w-lg mx-auto py-4">
      <div className="flex items-center gap-3 mb-8">
        <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-white/5 transition-colors">
          <ArrowLeft className="w-4 h-4 text-white/40" />
        </button>
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight">Schedule & Post</h1>
          <p className="text-xs text-white/40">Set a reminder to post your reel</p>
        </div>
      </div>

      {scheduled ? (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-12">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-emerald-400" />
          </div>
          <h2 className="font-display text-xl font-bold mb-2">Scheduled!</h2>
          <p className="text-sm text-white/50 mb-6">Download your reel and post it at the scheduled time.</p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => toast.success('Download started (demo mode)')} className="px-6 py-2.5 rounded-lg gold-gradient text-black font-semibold text-sm flex items-center gap-2">
              <Download className="w-4 h-4" /> Download Reel
            </button>
            <button onClick={() => router.push('/dashboard/library')} className="px-6 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm hover:bg-white/10 transition-all">
              My Library
            </button>
          </div>
        </motion.div>
      ) : (
        <div className="space-y-6">
          {/* Error */}
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-3">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <p className="text-xs text-red-300">{error}</p>
            </div>
          )}

          {/* Platform select */}
          <div>
            <label className="text-xs text-white/40 mb-3 block">Platform</label>
            <div className="grid grid-cols-3 gap-3">
              {PLATFORMS.map((p: any) => (
                <button
                  key={p.id}
                  onClick={() => setPlatform(p.id)}
                  className={`py-3 rounded-xl text-sm font-medium transition-all border ${
                    platform === p.id ? 'border-[#D4AF37]/30 bg-[#D4AF37]/5 text-[#D4AF37]' : 'border-white/5 bg-white/[0.02] text-white/50 hover:bg-white/5'
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-white/40 mb-2 block">Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-[#D4AF37]/50" />
            </div>
            <div>
              <label className="text-xs text-white/40 mb-2 block">Time</label>
              <input type="time" value={time} onChange={e => setTime(e.target.value)} className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-[#D4AF37]/50" />
            </div>
          </div>

          {/* Info box */}
          <div className="p-4 rounded-lg bg-[#D4AF37]/5 border border-[#D4AF37]/10">
            <p className="text-xs text-[#D4AF37]/80 leading-relaxed">
              <Clock className="w-3.5 h-3.5 inline mr-1.5" />
              Social accounts are not connected yet. We&apos;ll set a reminder and you can download the reel to post manually at the scheduled time.
            </p>
          </div>

          <div className="flex gap-3">
            <button onClick={handleSchedule} disabled={scheduling} className="flex-1 py-3 rounded-lg gold-gradient text-black font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-all disabled:opacity-50">
              {scheduling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
              {scheduling ? 'Scheduling...' : 'Set Schedule'}
            </button>
            <button onClick={() => toast.success('Download started (demo mode)')} className="flex-1 py-3 rounded-lg bg-white/5 border border-white/10 text-white font-medium text-sm flex items-center justify-center gap-2 hover:bg-white/10 transition-all">
              <Download className="w-4 h-4" /> Just Download
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
