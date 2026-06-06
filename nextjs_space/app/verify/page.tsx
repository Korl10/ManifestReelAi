'use client';
import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Sparkles, CheckCircle2, XCircle, Clock, Loader2, Mail, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

const COPY: Record<string, { icon: 'ok' | 'err' | 'clock'; title: string; body: string }> = {
  success: { icon: 'ok', title: 'Email verified ✨', body: "You're all set. Your free reels are unlocked — head to your dashboard and create your first manifestation reel." },
  expired: { icon: 'clock', title: 'Link expired', body: 'That verification link has expired. Sign in and request a fresh one below.' },
  invalid: { icon: 'err', title: 'Link not valid', body: "This verification link is invalid or has already been used. If you've already verified, just sign in." },
  error: { icon: 'err', title: 'Something went wrong', body: 'We hit a snag verifying your email. Please try the link again or request a new one.' },
};

function VerifyInner() {
  const params = useSearchParams();
  const status = params?.get('status') || 'invalid';
  const info = COPY[status] ?? COPY.invalid;
  const [resending, setResending] = useState(false);

  const resend = async () => {
    setResending(true);
    try {
      const res = await fetch('/api/auth/resend-verification', { method: 'POST' });
      if (res.status === 401) {
        toast.error('Please sign in first, then request a new link.');
      } else {
        const data = await res.json().catch(() => ({}));
        if (data?.alreadyVerified) toast.success('Your email is already verified — you can sign in.');
        else if (data?.sent) toast.success('A fresh verification email is on its way.');
        else toast.error('Could not send the email right now. Try again shortly.');
      }
    } catch {
      toast.error('Could not send the email right now. Try again shortly.');
    } finally {
      setResending(false);
    }
  };

  const Icon = info.icon === 'ok' ? CheckCircle2 : info.icon === 'clock' ? Clock : XCircle;
  const iconColor = info.icon === 'ok' ? 'text-emerald-400' : info.icon === 'clock' ? 'text-[#D4AF37]' : 'text-red-400';

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="relative w-full max-w-md">
      <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-8 text-center">
        <Link href="/" className="inline-flex items-center gap-2 mb-6">
          <Sparkles className="w-7 h-7 text-[#D4AF37]" />
          <span className="font-display text-xl font-bold">ManifestReel<span className="text-[#D4AF37]"> AI</span></span>
        </Link>
        <div className="flex justify-center mb-4"><Icon className={`w-14 h-14 ${iconColor}`} /></div>
        <h1 className="font-display text-2xl font-bold tracking-tight mb-2">{info.title}</h1>
        <p className="text-sm text-white/50 mb-7 leading-relaxed">{info.body}</p>

        {status === 'success' ? (
          <Link href="/dashboard" className="w-full py-3 rounded-lg gold-gradient text-black font-bold text-sm hover:opacity-90 transition-all flex items-center justify-center gap-2">
            <ArrowRight className="w-4 h-4" /> Go to dashboard
          </Link>
        ) : (
          <div className="space-y-3">
            <button onClick={resend} disabled={resending} className="w-full py-3 rounded-lg gold-gradient text-black font-bold text-sm hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              {resending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Mail className="w-4 h-4" /> Resend verification email</>}
            </button>
            <Link href="/login" className="block w-full py-3 rounded-lg bg-white/5 border border-white/10 text-white font-semibold text-sm hover:bg-white/10 transition-all">
              Back to sign in
            </Link>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default function VerifyPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-[#7B2FBE]/8 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/3 w-72 h-72 bg-[#D4AF37]/6 rounded-full blur-[100px]" />
      </div>
      <Suspense fallback={<Loader2 className="w-6 h-6 animate-spin text-white/40" />}>
        <VerifyInner />
      </Suspense>
    </div>
  );
}
