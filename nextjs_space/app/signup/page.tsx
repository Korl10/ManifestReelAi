'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  Sparkles, ArrowRight, ArrowLeft, Check, Loader2,
  Mail, Lock, User, Shield, CreditCard, Zap, Crown,
  Star, ChevronRight, AlertTriangle, HelpCircle,
} from 'lucide-react';
import { useRecaptcha } from '@/hooks/use-recaptcha';
import { useDeviceFingerprint } from '@/hooks/use-device-fingerprint';
import { PLANS_V2, type PlanTierV2 } from '@/lib/pricing-v2';
import { TRIAL_REEL_CONFIG } from '@/lib/trial-constraints';

// ─── Constants ───────────────────────────────────────────────────────────────
const TIERS: PlanTierV2[] = ['starter', 'creator', 'pro', 'studio'];
const TIER_ICONS: Record<PlanTierV2, React.ReactNode> = {
  starter: <Zap className="w-5 h-5" />,
  creator: <Star className="w-5 h-5" />,
  pro: <Crown className="w-5 h-5" />,
  studio: <Sparkles className="w-5 h-5" />,
};

const STEPS = [
  { label: 'Plan', icon: CreditCard },
  { label: 'Account', icon: User },
  { label: 'Verify', icon: Mail },
  { label: 'Security', icon: Shield },
  { label: 'Checkout', icon: ArrowRight },
] as const;

type BillingCycle = 'monthly' | 'annual';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatPrice(cents: number) {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

function cn(...classes: (string | false | undefined | null)[]) {
  return classes.filter(Boolean).join(' ');
}

// ─── Main Component ─────────────────────────────────────────────────────────
export default function SignupPage() {
  const [step, setStep] = useState(0);
  const [billing, setBilling] = useState<BillingCycle>('monthly');
  const [selectedTier, setSelectedTier] = useState<PlanTierV2>('creator');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [gateStatus, setGateStatus] = useState<'checking' | 'passed' | 'blocked' | null>(null);
  const [blockMessage, setBlockMessage] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [accountCreated, setAccountCreated] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const { executeRecaptcha, ready: recaptchaReady } = useRecaptcha();
  const { fingerprint, loading: fpLoading } = useDeviceFingerprint();
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  // ─── Step 1 → 2: Pick plan ─────────────────────────────────────────────────
  const handlePlanNext = () => {
    setStep(1);
  };

  // ─── Step 2: Create account + send OTP ──────────────────────────────────────
  const handleAccountSubmit = async () => {
    if (!name.trim()) { toast.error('Please enter your name'); return; }
    if (!email.trim()) { toast.error('Please enter your email'); return; }
    if (password.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    if (password !== confirmPassword) { toast.error('Passwords do not match'); return; }

    setLoading(true);
    try {
      // Send OTP first (validates email domain, checks trial lock)
      const otpRes = await fetch('/api/trial/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.toLowerCase().trim() }),
      });
      const otpData = await otpRes.json();

      if (!otpRes.ok) {
        toast.error(otpData.error || 'Failed to send verification code');
        setLoading(false);
        return;
      }

      setOtpSent(true);
      setResendCooldown(60);
      toast.success('Verification code sent to your email!');
      setStep(2);
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ─── Resend OTP ────────────────────────────────────────────────────────────
  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setLoading(true);
    try {
      const res = await fetch('/api/trial/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.toLowerCase().trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to resend code');
      } else {
        setResendCooldown(60);
        toast.success('New verification code sent!');
      }
    } catch {
      toast.error('Failed to resend code');
    } finally {
      setLoading(false);
    }
  };

  // ─── Step 3: Verify OTP ────────────────────────────────────────────────────
  const handleVerifyOtp = async () => {
    if (otpCode.length !== 6) { toast.error('Please enter the 6-digit code'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/trial/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.toLowerCase().trim(), code: otpCode }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Invalid verification code');
        setLoading(false);
        return;
      }

      setOtpVerified(true);
      toast.success('Email verified!');
      // Automatically proceed to security gates
      setStep(3);
      // Auto-run gate check
      setTimeout(() => runGateCheck(), 300);
    } catch {
      toast.error('Verification failed');
    } finally {
      setLoading(false);
    }
  };

  // ─── Step 4: Security gates (reCAPTCHA + device FP + IP) ──────────────────
  const runGateCheck = useCallback(async () => {
    setGateStatus('checking');
    try {
      // Collect reCAPTCHA token
      let recaptchaToken: string | null = null;
      if (recaptchaReady) {
        recaptchaToken = await executeRecaptcha('trial_signup');
      }

      const res = await fetch('/api/trial/check-gates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.toLowerCase().trim(),
          deviceFingerprint: fingerprint || undefined,
          recaptchaToken: recaptchaToken || undefined,
        }),
      });
      const data = await res.json();

      if (data.allowed) {
        setGateStatus('passed');
        toast.success('Security check passed!');
        // Auto-proceed to account creation + checkout
        setTimeout(() => handleCreateAccountAndCheckout(), 500);
      } else {
        setGateStatus('blocked');
        setBlockMessage(
          data.message ||
          'Your trial request was flagged by our security system. Please contact support@manifestreel.ai for assistance.'
        );
      }
    } catch {
      setGateStatus('blocked');
      setBlockMessage('Security verification failed. Please try again or contact support@manifestreel.ai.');
    }
  }, [email, fingerprint, recaptchaReady, executeRecaptcha]);

  // ─── Step 5: Create account → sign in → Stripe checkout ───────────────────
  const handleCreateAccountAndCheckout = async () => {
    setStep(4);
    setLoading(true);
    try {
      // 1. Create the user account
      if (!accountCreated) {
        const signupRes = await fetch('/api/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: email.toLowerCase().trim(),
            password,
            name: name.trim(),
            otpVerified: true,
          }),
        });
        const signupData = await signupRes.json();

        if (!signupRes.ok) {
          // 409 = already exists, try to sign in anyway
          if (signupRes.status !== 409) {
            toast.error(signupData.error || 'Failed to create account');
            setLoading(false);
            return;
          }
        }
        setAccountCreated(true);
      }

      // 2. Auto sign-in
      const signInRes = await signIn('credentials', {
        email: email.toLowerCase().trim(),
        password,
        redirect: false,
      });

      if (signInRes?.error) {
        toast.error('Failed to sign in. Please try logging in manually.');
        setLoading(false);
        return;
      }

      // 3. Create Stripe checkout session with trial
      const checkoutRes = await fetch('/api/payments/create-checkout-v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'subscription',
          tier: selectedTier,
          billing,
          trial: true,
        }),
      });
      const checkoutData = await checkoutRes.json();

      if (!checkoutRes.ok) {
        toast.error(checkoutData.error || 'Failed to create checkout session');
        setLoading(false);
        return;
      }

      if (checkoutData.url) {
        // Redirect to Stripe Checkout
        window.location.href = checkoutData.url;
      } else {
        toast.error('No checkout URL returned');
        setLoading(false);
      }
    } catch {
      toast.error('Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  // ─── OTP digit-by-digit input handler ──────────────────────────────────────
  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) value = value.slice(-1);
    if (value && !/^[0-9]$/.test(value)) return;
    const digits = otpCode.split('');
    while (digits.length < 6) digits.push('');
    digits[index] = value;
    const newCode = digits.join('');
    setOtpCode(newCode);
    // Auto-focus next
    if (value && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otpCode[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    setOtpCode(pasted);
    const nextFocus = Math.min(pasted.length, 5);
    otpInputRefs.current[nextFocus]?.focus();
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-start p-4 pt-8 md:pt-12">
      {/* Background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-[#7B2FBE]/8 rounded-full blur-[150px]" />
        <div className="absolute bottom-1/3 right-1/4 w-[400px] h-[400px] bg-[#D4AF37]/6 rounded-full blur-[120px]" />
      </div>

      {/* Logo */}
      <Link href="/" className="inline-flex items-center gap-2 mb-8 relative z-10">
        <Sparkles className="w-7 h-7 text-[#D4AF37]" />
        <span className="font-display text-xl font-bold">ManifestReel<span className="text-[#D4AF37]"> AI</span></span>
      </Link>

      {/* Progress indicator */}
      <div className="flex items-center gap-2 mb-8 relative z-10">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const isActive = i === step;
          const isDone = i < step;
          return (
            <React.Fragment key={s.label}>
              {i > 0 && (
                <div className={cn(
                  'w-8 h-px transition-colors duration-300',
                  isDone ? 'bg-[#D4AF37]' : 'bg-white/10'
                )} />
              )}
              <div className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-300',
                isActive && 'bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/30',
                isDone && 'bg-[#D4AF37]/10 text-[#D4AF37]/70',
                !isActive && !isDone && 'text-white/30'
              )}>
                {isDone ? <Check className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">{s.label}</span>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* Main content */}
      <div className="relative z-10 w-full max-w-4xl">
        <AnimatePresence mode="wait">
          {/* ═══ STEP 0: Plan Picker ═══ */}
          {step === 0 && (
            <motion.div
              key="plan"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.25 }}
            >
              <div className="text-center mb-8">
                <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight mb-3">
                  Start your <span className="text-[#D4AF37]">free 3-day trial</span>
                </h1>
                <p className="text-white/50 text-sm md:text-base max-w-lg mx-auto">
                  Choose a plan to try free for 3 days. No charge until your trial ends.
                  Cancel anytime.
                </p>
              </div>

              {/* Billing toggle */}
              <div className="flex items-center justify-center gap-3 mb-8">
                <button
                  onClick={() => setBilling('monthly')}
                  className={cn(
                    'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                    billing === 'monthly'
                      ? 'bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/30'
                      : 'text-white/40 hover:text-white/60'
                  )}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setBilling('annual')}
                  className={cn(
                    'px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2',
                    billing === 'annual'
                      ? 'bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/30'
                      : 'text-white/40 hover:text-white/60'
                  )}
                >
                  Annual
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-400 font-bold">SAVE 40%</span>
                </button>
              </div>

              {/* Plan cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {TIERS.map(tier => {
                  const plan = PLANS_V2[tier];
                  const price = billing === 'annual' ? plan.annualPerMonthCents : plan.monthlyCents;
                  const isSelected = selectedTier === tier;
                  const isHighlighted = plan.highlight;
                  return (
                    <button
                      key={tier}
                      onClick={() => setSelectedTier(tier)}
                      className={cn(
                        'relative p-5 rounded-xl border transition-all duration-200 text-left group',
                        isSelected
                          ? 'border-[#D4AF37] bg-[#D4AF37]/5 ring-1 ring-[#D4AF37]/30'
                          : 'border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]',
                      )}
                    >
                      {isHighlighted && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[10px] font-bold bg-[#D4AF37] text-black">
                          MOST POPULAR
                        </div>
                      )}
                      {/* Selection indicator */}
                      <div className={cn(
                        'absolute top-4 right-4 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all',
                        isSelected
                          ? 'border-[#D4AF37] bg-[#D4AF37]'
                          : 'border-white/20'
                      )}>
                        {isSelected && <Check className="w-3 h-3 text-black" />}
                      </div>

                      <div className={cn(
                        'inline-flex p-2 rounded-lg mb-3',
                        isSelected ? 'bg-[#D4AF37]/20 text-[#D4AF37]' : 'bg-white/5 text-white/40'
                      )}>
                        {TIER_ICONS[tier]}
                      </div>

                      <h3 className="font-display font-bold text-lg mb-1">{plan.name}</h3>
                      <div className="flex items-baseline gap-1 mb-4">
                        <span className="text-2xl font-bold text-[#D4AF37]">{formatPrice(price)}</span>
                        <span className="text-xs text-white/40">/mo</span>
                      </div>

                      <ul className="space-y-2">
                        {plan.features.map((f, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-white/60">
                            <Check className="w-3.5 h-3.5 text-[#D4AF37]/60 mt-0.5 flex-shrink-0" />
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>
                    </button>
                  );
                })}
              </div>

              {/* Trial info */}
              <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4 mb-6">
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-[#D4AF37] flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium mb-1">3-day free trial on every plan</p>
                    <p className="text-xs text-white/40">
                      Your card will be collected to start the trial but won't be charged until day 4.
                      During the trial you can create a watermarked 5-second preview reel at 720p.
                      Cancel anytime before the trial ends — no charge.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-center">
                <button
                  onClick={handlePlanNext}
                  className="px-8 py-3 rounded-xl gold-gradient text-black font-bold text-sm hover:opacity-90 transition-all flex items-center gap-2"
                >
                  Continue with {PLANS_V2[selectedTier].name}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}

          {/* ═══ STEP 1: Account Details ═══ */}
          {step === 1 && (
            <motion.div
              key="account"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.25 }}
              className="max-w-md mx-auto"
            >
              <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-8">
                <div className="text-center mb-6">
                  <h2 className="font-display text-2xl font-bold mb-2">Create your account</h2>
                  <p className="text-sm text-white/50">
                    {PLANS_V2[selectedTier].name} plan • {billing === 'annual' ? 'Annual' : 'Monthly'} billing
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                    <input
                      type="text"
                      placeholder="Full name"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-[#D4AF37]/50 transition-colors text-sm"
                    />
                  </div>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                    <input
                      type="email"
                      placeholder="Email address"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-[#D4AF37]/50 transition-colors text-sm"
                    />
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                    <input
                      type="password"
                      placeholder="Password (min 8 characters)"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-[#D4AF37]/50 transition-colors text-sm"
                    />
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                    <input
                      type="password"
                      placeholder="Confirm password"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-[#D4AF37]/50 transition-colors text-sm"
                    />
                  </div>

                  <button
                    onClick={handleAccountSubmit}
                    disabled={loading}
                    className="w-full py-3 rounded-lg gold-gradient text-black font-bold text-sm hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        Verify Email
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>

                <div className="flex items-center justify-between mt-6">
                  <button
                    onClick={() => setStep(0)}
                    className="text-sm text-white/40 hover:text-white/60 flex items-center gap-1 transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Back
                  </button>
                  <p className="text-xs text-white/30">
                    Already have an account?{' '}
                    <Link href="/login" className="text-[#D4AF37] hover:underline">Sign in</Link>
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* ═══ STEP 2: OTP Verification ═══ */}
          {step === 2 && (
            <motion.div
              key="otp"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.25 }}
              className="max-w-md mx-auto"
            >
              <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-8">
                <div className="text-center mb-6">
                  <div className="inline-flex p-3 rounded-full bg-[#D4AF37]/10 mb-4">
                    <Mail className="w-6 h-6 text-[#D4AF37]" />
                  </div>
                  <h2 className="font-display text-2xl font-bold mb-2">Check your email</h2>
                  <p className="text-sm text-white/50">
                    We sent a 6-digit code to{' '}
                    <span className="text-white/70 font-medium">{email}</span>
                  </p>
                </div>

                {/* OTP input */}
                <div className="flex items-center justify-center gap-2 mb-6">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <input
                      key={i}
                      ref={el => { otpInputRefs.current[i] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={otpCode[i] || ''}
                      onChange={e => handleOtpChange(i, e.target.value)}
                      onKeyDown={e => handleOtpKeyDown(i, e)}
                      onPaste={i === 0 ? handleOtpPaste : undefined}
                      className="w-11 h-13 text-center text-xl font-bold rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-[#D4AF37]/50 transition-colors"
                    />
                  ))}
                </div>

                <button
                  onClick={handleVerifyOtp}
                  disabled={loading || otpCode.length !== 6}
                  className="w-full py-3 rounded-lg gold-gradient text-black font-bold text-sm hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      Verify Code
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <div className="text-center mt-4">
                  <button
                    onClick={handleResendOtp}
                    disabled={resendCooldown > 0 || loading}
                    className="text-xs text-white/40 hover:text-[#D4AF37] disabled:hover:text-white/40 transition-colors"
                  >
                    {resendCooldown > 0
                      ? `Resend code in ${resendCooldown}s`
                      : 'Resend verification code'
                    }
                  </button>
                </div>

                <div className="flex items-center justify-start mt-6">
                  <button
                    onClick={() => setStep(1)}
                    className="text-sm text-white/40 hover:text-white/60 flex items-center gap-1 transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Back
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ═══ STEP 3: Security Check ═══ */}
          {step === 3 && (
            <motion.div
              key="security"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.25 }}
              className="max-w-md mx-auto"
            >
              <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-8">
                <div className="text-center mb-6">
                  <div className="inline-flex p-3 rounded-full bg-[#7B2FBE]/10 mb-4">
                    <Shield className="w-6 h-6 text-[#7B2FBE]" />
                  </div>
                  <h2 className="font-display text-2xl font-bold mb-2">Security verification</h2>
                  <p className="text-sm text-white/50">Running automated security checks…</p>
                </div>

                {gateStatus === 'checking' && (
                  <div className="flex flex-col items-center gap-4 py-8">
                    <Loader2 className="w-8 h-8 text-[#D4AF37] animate-spin" />
                    <div className="space-y-2 text-center">
                      <p className="text-sm text-white/60">Verifying your identity…</p>
                      <p className="text-xs text-white/30">This usually takes a few seconds</p>
                    </div>
                  </div>
                )}

                {gateStatus === 'passed' && (
                  <div className="flex flex-col items-center gap-4 py-8">
                    <div className="inline-flex p-3 rounded-full bg-green-500/10">
                      <Check className="w-8 h-8 text-green-400" />
                    </div>
                    <div className="space-y-2 text-center">
                      <p className="text-sm font-medium text-green-400">All checks passed!</p>
                      <p className="text-xs text-white/40">Setting up your account and redirecting to checkout…</p>
                    </div>
                    <Loader2 className="w-5 h-5 text-[#D4AF37] animate-spin mt-2" />
                  </div>
                )}

                {gateStatus === 'blocked' && (
                  <div className="py-6">
                    <div className="flex flex-col items-center gap-4 mb-6">
                      <div className="inline-flex p-3 rounded-full bg-red-500/10">
                        <AlertTriangle className="w-8 h-8 text-red-400" />
                      </div>
                      <p className="text-sm text-red-400 font-medium text-center">Trial not available</p>
                    </div>
                    <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-4 mb-6">
                      <p className="text-sm text-white/60 text-center">{blockMessage}</p>
                    </div>
                    <div className="text-center">
                      <a
                        href="mailto:support@manifestreel.ai"
                        className="inline-flex items-center gap-2 text-sm text-[#D4AF37] hover:underline"
                      >
                        <HelpCircle className="w-4 h-4" />
                        Contact Support
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ═══ STEP 4: Checkout Redirect ═══ */}
          {step === 4 && (
            <motion.div
              key="checkout"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.25 }}
              className="max-w-md mx-auto"
            >
              <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-8">
                <div className="flex flex-col items-center gap-4 py-8">
                  <Loader2 className="w-10 h-10 text-[#D4AF37] animate-spin" />
                  <div className="space-y-2 text-center">
                    <h2 className="font-display text-xl font-bold">Setting up your trial</h2>
                    <p className="text-sm text-white/50">
                      Creating your account and preparing Stripe checkout…
                    </p>
                    <p className="text-xs text-white/30 mt-2">
                      You'll be redirected to Stripe to enter your card details.
                      You won't be charged until your 3-day trial ends.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="relative z-10 mt-auto pt-8 pb-4 text-center">
        <p className="text-xs text-white/20">
          By creating an account, you agree to our terms of service.
        </p>
      </div>
    </div>
  );
}
