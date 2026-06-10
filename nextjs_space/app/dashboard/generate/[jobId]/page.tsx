'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Check, Loader2, AlertCircle, Sparkles, ArrowLeft, RotateCcw } from 'lucide-react';
import Link from 'next/link';

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
  const [pollCount, setPollCount] = useState(0);
  const [retrying, setRetrying] = useState(false);
  const hasRedirected = useRef(false);

  // A motion/cinematic failure offers an engine-switch fallback.
  const isMotionFailure = /veo 3|congestion|couldn't be animated|motion render/i.test(error);

  const handleRetry = useCallback(async (mode: 'same' | 'switch_pro') => {
    if (!job?.reelId) return;
    setRetrying(true);
    try {
      const res = await fetch(`/api/reels/${job.reelId}/retry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? 'Could not start retry. Please try again.');
        setRetrying(false);
        return;
      }
      hasRedirected.current = true;
      router.replace(`/dashboard/generate/${data.jobId}`);
    } catch {
      setError('Could not start retry. Please check your connection.');
      setRetrying(false);
    }
  }, [job?.reelId, router]);

  const pollJob = useCallback(async () => {
    try {
      const res = await fetch(`/api/jobs/${jobId}`);
      if (!res.ok) {
        if (res.status === 404) { setError('Generation job not found.'); return; }
        throw new Error('Failed to load job status');
      }
      const data = await res.json();
      setJob(data);
      setPollCount(p => p + 1);
      if (data?.status === 'complete' && data?.reelId && !hasRedirected.current) {
        hasRedirected.current = true;
        setTimeout(() => router.replace(`/dashboard/reel/${data.reelId}`), 1200);
      }
      if (data?.status === 'failed') {
        setError(data?.errorMessage ?? 'Generation failed. Please try again.');
      }
    } catch {
      setError('Connection lost. Please check your network.');
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
        {job?.status === 'complete' ? (
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/10 mb-4">
            <Check className="w-8 h-8 text-emerald-400" />
          </div>
        ) : error ? (
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-500/10 mb-4">
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
        ) : (
          <motion.div animate={{ rotate: [0, 360] }} transition={{ duration: 3, repeat: Infinity, ease: 'linear' }} className="inline-block mb-4">
            <Sparkles className="w-10 h-10 text-[#D4AF37]" />
          </motion.div>
        )}
        <h1 className="font-display text-2xl font-bold tracking-tight mb-2">
          {job?.status === 'complete' ? 'Reel Ready! ✨' : error ? 'Generation Failed' : 'Creating Your Reel'}
        </h1>
        <p className="text-sm text-white/40">
          {job?.status === 'complete' ? 'Redirecting to preview...' : error ? '' : 'This usually takes about 30 seconds'}
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20">
          <div className="flex items-center gap-3 mb-3">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
            <p className="text-sm text-red-300">{error}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {job?.reelId && (
              <button
                onClick={() => handleRetry('same')}
                disabled={retrying}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#D4AF37]/15 text-xs text-[#D4AF37] hover:bg-[#D4AF37]/25 disabled:opacity-50"
              >
                {retrying ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                {isMotionFailure ? 'Retry on Veo 3' : 'Retry'}
              </button>
            )}
            {job?.reelId && isMotionFailure && (
              <button
                onClick={() => handleRetry('switch_pro')}
                disabled={retrying}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 text-xs text-white/70 hover:bg-white/10 disabled:opacity-50"
              >
                <Sparkles className="w-3 h-3" /> Switch to Kling 2.5 (Pro)
              </button>
            )}
            <Link href="/dashboard" className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 text-xs text-white/50 hover:bg-white/10">
              <ArrowLeft className="w-3 h-3" /> Try again later
            </Link>
          </div>
        </div>
      )}

      {/* Progress bar */}
      {!error && (
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
          {typeof job?.currentStep === 'string' && /queue/i.test(job.currentStep) && (
            <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-[#D4AF37]/10 border border-[#D4AF37]/20">
              <Loader2 className="w-3.5 h-3.5 text-[#D4AF37] animate-spin shrink-0" />
              <p className="text-xs text-[#D4AF37]/90">{job.currentStep}</p>
            </div>
          )}
        </div>
      )}

      {/* Steps */}
      <div className="space-y-3">
        {STEPS.map((step: any, i: number) => {
          const status = error && !job?.status ? 'pending' : getStepStatus(i);
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
