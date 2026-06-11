'use client';

/**
 * INTERNAL Phase 5B trial flow staging page.
 * Tests the full trial signup flow:
 *   1. Email input → OTP send → OTP verify (or magic link)
 *   2. Device fingerprint capture
 *   3. Trial gate check
 *   4. Trial reel constraints display
 *   5. Simulated reel generation with constraints
 */

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mail, Key, Smartphone, Shield, CheckCircle, XCircle, Loader2,
  ArrowRight, RefreshCw, Lock, Zap, Film,
} from 'lucide-react';
import { toast } from 'sonner';
import { useDeviceFingerprint } from '@/hooks/use-device-fingerprint';
import { TRIAL_REEL_CONFIG } from '@/lib/trial-constraints';

type Step = 'email' | 'otp' | 'gates' | 'constraints' | 'done';

export default function TrialFlowStaging() {
  const searchParams = useSearchParams();
  const prefilledEmail = searchParams?.get('email') || '';
  const preVerified = searchParams?.get('verified') === 'true';

  const [step, setStep] = useState<Step>(preVerified ? 'gates' : 'email');
  const [email, setEmail] = useState(prefilledEmail);
  const [otpMethod, setOtpMethod] = useState<'code' | 'magic'>('code');
  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailVerified, setEmailVerified] = useState(preVerified);
  const [gateResult, setGateResult] = useState<any>(null);
  const { fingerprint: deviceFp, loading: fpLoading } = useDeviceFingerprint();

  // Send OTP
  const handleSendOtp = async () => {
    if (!email.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/trial/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to send code');
        return;
      }
      toast.success('Verification code sent to your email!');
      setStep('otp');
    } catch {
      toast.error('Network error');
    } finally {
      setLoading(false);
    }
  };

  // Verify OTP code
  const handleVerifyCode = async () => {
    if (!otpCode.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/trial/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), code: otpCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Invalid code');
        return;
      }
      setEmailVerified(true);
      toast.success('Email verified!');
      setStep('gates');
    } catch {
      toast.error('Network error');
    } finally {
      setLoading(false);
    }
  };

  // Check all trial gates
  const handleCheckGates = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/trial/check-gates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          deviceFingerprint: deviceFp || undefined,
        }),
      });
      const data = await res.json();
      setGateResult(data);
      if (data.allowed) {
        toast.success('All gates passed!');
        setStep('constraints');
      } else {
        toast.error(data.message || `Blocked by: ${data.blockedBy}`);
      }
    } catch {
      toast.error('Network error');
    } finally {
      setLoading(false);
    }
  };

  const cfg = TRIAL_REEL_CONFIG;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-6 md:p-10">
      <div className="max-w-2xl mx-auto space-y-8">
        <header>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="w-6 h-6 text-[#D4AF37]" />
            Phase 5B — Trial Flow Staging
          </h1>
          <p className="text-sm text-white/50 mt-1">
            End-to-end trial signup with anti-abuse gates. Internal testing only.
          </p>
        </header>

        {/* Progress bar */}
        <div className="flex items-center gap-2">
          {(['email', 'otp', 'gates', 'constraints', 'done'] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                step === s ? 'bg-[#D4AF37] text-black' : 
                (['email', 'otp', 'gates', 'constraints', 'done'].indexOf(step) > i) ? 'bg-green-500/20 text-green-400' : 'bg-white/5 text-white/30'
              }`}>
                {(['email', 'otp', 'gates', 'constraints', 'done'].indexOf(step) > i) ? '✓' : i + 1}
              </div>
              {i < 4 && <div className="w-8 h-0.5 bg-white/10" />}
            </div>
          ))}
        </div>

        {/* Device FP status */}
        <div className="flex items-center gap-2 text-xs">
          <Smartphone className="w-4 h-4 text-white/40" />
          <span className="text-white/40">Device FP:</span>
          {fpLoading ? (
            <Loader2 className="w-3 h-3 animate-spin text-white/30" />
          ) : deviceFp ? (
            <span className="font-mono text-white/60">{deviceFp.slice(0, 16)}…</span>
          ) : (
            <span className="text-red-400">Failed</span>
          )}
        </div>

        <AnimatePresence mode="wait">
          {/* Step 1: Email */}
          {step === 'email' && (
            <motion.div
              key="email"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-4"
            >
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Mail className="w-5 h-5 text-[#D4AF37]" />
                Step 1: Enter your email
              </h2>
              <p className="text-sm text-white/50">We'll send a 6-digit code + magic link to verify.</p>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-[#D4AF37]/50"
                onKeyDown={(e) => e.key === 'Enter' && handleSendOtp()}
              />
              <button
                onClick={handleSendOtp}
                disabled={loading || !email.trim()}
                className="w-full flex items-center justify-center gap-2 bg-[#D4AF37] hover:bg-[#C4A030] text-black font-semibold py-3 rounded-lg transition-colors disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                Send verification code
              </button>
            </motion.div>
          )}

          {/* Step 2: OTP verification */}
          {step === 'otp' && (
            <motion.div
              key="otp"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-4"
            >
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Key className="w-5 h-5 text-[#D4AF37]" />
                Step 2: Verify your email
              </h2>
              <p className="text-sm text-white/50">Code sent to <span className="text-white">{email}</span></p>

              {/* Method toggle */}
              <div className="flex gap-2">
                <button
                  onClick={() => setOtpMethod('code')}
                  className={`flex-1 py-2 rounded-lg text-sm transition-colors ${otpMethod === 'code' ? 'bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/30' : 'bg-white/5 text-white/50 border border-white/10'}`}
                >
                  Enter code
                </button>
                <button
                  onClick={() => setOtpMethod('magic')}
                  className={`flex-1 py-2 rounded-lg text-sm transition-colors ${otpMethod === 'magic' ? 'bg-[#7B2FBE]/20 text-[#A855F7] border border-[#7B2FBE]/30' : 'bg-white/5 text-white/50 border border-white/10'}`}
                >
                  Magic link (check email)
                </button>
              </div>

              {otpMethod === 'code' ? (
                <>
                  <input
                    type="text"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    maxLength={6}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white text-center text-2xl tracking-[0.5em] font-mono placeholder:text-white/20 focus:outline-none focus:border-[#D4AF37]/50"
                    onKeyDown={(e) => e.key === 'Enter' && handleVerifyCode()}
                  />
                  <button
                    onClick={handleVerifyCode}
                    disabled={loading || otpCode.length !== 6}
                    className="w-full flex items-center justify-center gap-2 bg-[#D4AF37] hover:bg-[#C4A030] text-black font-semibold py-3 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                    Verify code
                  </button>
                </>
              ) : (
                <div className="text-center py-4">
                  <p className="text-white/50 text-sm">Click the magic link in your email to verify automatically.</p>
                  <p className="text-white/30 text-xs mt-2">The page will redirect once verified.</p>
                </div>
              )}

              <div className="flex items-center justify-between">
                <button
                  onClick={() => setStep('email')}
                  className="text-white/40 hover:text-white text-sm"
                >← Change email</button>
                <button
                  onClick={handleSendOtp}
                  disabled={loading}
                  className="text-white/40 hover:text-[#D4AF37] text-sm flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" /> Resend code
                </button>
              </div>
            </motion.div>
          )}

          {/* Step 3: Gate check */}
          {step === 'gates' && (
            <motion.div
              key="gates"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-4"
            >
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Shield className="w-5 h-5 text-[#D4AF37]" />
                Step 3: Anti-abuse gate check
              </h2>

              <div className="space-y-2">
                {[
                  { label: 'Email verified', ok: emailVerified, icon: Mail },
                  { label: 'Device fingerprint', ok: !!deviceFp, icon: Smartphone },
                  { label: 'Not disposable email', ok: emailVerified, icon: Shield },
                ].map((gate) => (
                  <div key={gate.label} className="flex items-center gap-3 bg-white/[0.02] rounded-lg px-3 py-2">
                    <gate.icon className="w-4 h-4 text-white/40" />
                    <span className="text-sm flex-1">{gate.label}</span>
                    {gate.ok ? (
                      <CheckCircle className="w-4 h-4 text-green-400" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-400" />
                    )}
                  </div>
                ))}
              </div>

              {gateResult && !gateResult.allowed && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                  <p className="text-red-400 text-sm font-medium">🚫 Blocked: {gateResult.blockedBy}</p>
                  <p className="text-red-400/70 text-xs mt-1">{gateResult.message}</p>
                </div>
              )}

              <button
                onClick={handleCheckGates}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-[#D4AF37] hover:bg-[#C4A030] text-black font-semibold py-3 rounded-lg transition-colors disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                Run gate check
              </button>
            </motion.div>
          )}

          {/* Step 4: Trial constraints */}
          {step === 'constraints' && (
            <motion.div
              key="constraints"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-4"
            >
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Film className="w-5 h-5 text-[#D4AF37]" />
                Step 4: Trial reel constraints
              </h2>
              <p className="text-sm text-white/50">Your trial reel will be created with these immutable settings:</p>

              <div className="space-y-2">
                {[
                  { label: 'Duration', value: `${cfg.durationSeconds}s`, locked: true },
                  { label: 'Resolution', value: cfg.resolution, locked: true },
                  { label: 'Quality', value: cfg.qualityTier, locked: true },
                  { label: 'Watermark', value: 'Burned into video', locked: true },
                  { label: 'Music', value: 'Auto-matched curated only', locked: true },
                  { label: 'Craft presets', value: 'Disabled', locked: true },
                  { label: 'Advanced subtitles', value: 'Disabled', locked: true },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between bg-white/[0.02] rounded-lg px-3 py-2">
                    <span className="text-sm text-white/60">{item.label}</span>
                    <span className="flex items-center gap-1 text-sm">
                      {item.locked && <Lock className="w-3 h-3 text-[#D4AF37]" />}
                      <span className="text-white font-medium">{item.value}</span>
                    </span>
                  </div>
                ))}
              </div>

              <div className="bg-[#D4AF37]/10 border border-[#D4AF37]/20 rounded-lg p-3">
                <p className="text-[#D4AF37] text-sm font-medium">✨ Upgrade to remove the watermark</p>
                <p className="text-[#D4AF37]/70 text-xs mt-1">
                  When you subscribe, your trial reel will be automatically re-rendered without the watermark.
                </p>
              </div>

              <button
                onClick={() => {
                  setStep('done');
                  toast.success('Trial flow complete! In production, this would redirect to Stripe checkout.');
                }}
                className="w-full flex items-center justify-center gap-2 bg-[#7B2FBE] hover:bg-[#6B25AE] text-white font-semibold py-3 rounded-lg transition-colors"
              >
                <Zap className="w-4 h-4" />
                Start 3-day free trial (simulated)
              </button>
            </motion.div>
          )}

          {/* Step 5: Done */}
          {step === 'done' && (
            <motion.div
              key="done"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-green-500/5 border border-green-500/20 rounded-xl p-6 space-y-4 text-center"
            >
              <CheckCircle className="w-12 h-12 text-green-400 mx-auto" />
              <h2 className="text-lg font-semibold">Trial flow complete!</h2>
              <p className="text-sm text-white/50">
                In production, the user would now be directed to Stripe checkout for their
                3-day free trial. The trial lock has been verified and the reel will be generated
                with the constraints above.
              </p>
              <div className="bg-white/5 rounded-lg p-4 text-left text-xs space-y-1">
                <p className="text-white/40">Debug info:</p>
                <p>Email: <span className="text-white font-mono">{email}</span></p>
                <p>Email verified: <span className="text-green-400">{emailVerified ? 'Yes' : 'No'}</span></p>
                <p>Device FP: <span className="text-white/60 font-mono">{deviceFp?.slice(0, 16) || 'N/A'}…</span></p>
                <p>Gate result: <span className="text-green-400">{gateResult?.allowed ? 'PASSED' : gateResult?.blockedBy || 'N/A'}</span></p>
              </div>
              <button
                onClick={() => {
                  setStep('email');
                  setEmail('');
                  setOtpCode('');
                  setEmailVerified(false);
                  setGateResult(null);
                }}
                className="text-white/40 hover:text-white text-sm"
              >
                ← Reset and test again
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
