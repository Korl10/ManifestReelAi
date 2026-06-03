'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Check, Loader2, AlertCircle, Sparkles } from 'lucide-react';

const STEPS = [
  { key: 'script', label: 'Writing Script', emoji: '✍️' },
  { key: 'voice', label: 'Generating Voiceover', emoji: '🎙️' },
  { key: 'music', label: 'Creating Music', emoji: '🎵' },
  { key: 'visuals', label: 'Composing Visuals', emoji: '🎬' },
  { key: 'captions', label: 'Syncing Captions', emoji: '📝' },
  { key: 'rendering', label: 'Rendering Final Reel', emoji: '🎥' },
];

export default function GenerationProgressPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params?.jobId as string;
  const [job, setJob] = useState<any>(null);
  const [error, setError] = useState('');

  const pollJob = useCallback(async () => {
    try {
      const res = await fetch(`/api/jobs/${jobId}`);
      if (!res.ok) { setError('Failed to load job status'); return; }
      const data = await res.json();
      setJob(data);
      if (data?.status === 'complete' && data?.reelId) {
        setTimeout(() => router.replace(`/dashboard/reel/${data.reelId}`), 1000);
      }
      if (data?.status === 'failed') {
        setError(data?.errorMessage ?? 'Generation failed');
      }
    } catch {
      setError('Connection lost');
    }
  }, [jobId, router]);

  useEffect(() => {
    if (!jobId) return;
    pollJob();
    const interval = setInterval(pollJob, 2000);
    return () => clearInterval(interval);
  }, [jobId, pollJob]);

  const currentStepIndex = STEPS.findIndex((s: any) => s.key === (job?.currentStep ?? ''));
  const progress = job?.progressPct ?? 0;

  const getStepStatus = (index: number) => {
    if (job?.status === 'complete') return 'complete';
    if (index < currentStepIndex) return 'complete';
    if (index === currentStepIndex) return 'processing';
    return 'pending';
  };

  return (
    <div className="max-w-lg mx-auto py-8">
      <div className="text-center mb-10">
        <motion.div animate={{ rotate: [0, 360] }} transition={{ duration: 3, repeat: Infinity, ease: 'linear' }} className="inline-block mb-4">
          <Sparkles className="w-10 h-10 text-[#D4AF37]" />
        </motion.div>
        <h1 className="font-display text-2xl font-bold tracking-tight mb-2">Creating Your Reel</h1>
        <p className="text-sm text-white/40">This usually takes about 30 seconds</p>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {/* Progress bar */}
      <div className="mb-8">
        <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
          <motion.div
            className="h-full rounded-full gold-gradient"
            initial={{ width: '0%' }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
        <p className="text-xs text-white/30 mt-2 text-right">{progress}%</p>
      </div>

      {/* Steps */}
      <div className="space-y-3">
        {STEPS.map((step: any, i: number) => {
          const status = getStepStatus(i);
          return (
            <motion.div
              key={step.key}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${
                status === 'processing'
                  ? 'bg-[#D4AF37]/5 border-[#D4AF37]/20 gold-glow'
                  : status === 'complete'
                  ? 'bg-emerald-500/5 border-emerald-500/10'
                  : 'bg-white/[0.01] border-white/5'
              }`}
            >
              <span className="text-xl">{step.emoji}</span>
              <span className={`flex-1 text-sm font-medium ${
                status === 'processing' ? 'text-[#D4AF37]' : status === 'complete' ? 'text-emerald-400' : 'text-white/30'
              }`}>
                {step.label}
              </span>
              {status === 'complete' && <Check className="w-5 h-5 text-emerald-400" />}
              {status === 'processing' && <Loader2 className="w-5 h-5 text-[#D4AF37] animate-spin" />}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
