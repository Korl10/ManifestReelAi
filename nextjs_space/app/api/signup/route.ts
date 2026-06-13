export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { issueVerificationToken, sendVerificationEmail } from '@/lib/email-verify';
import { consumeRateLimit, getClientIp } from '@/lib/rate-limit';

const DAY_MS = 24 * 60 * 60 * 1000;

export async function POST(request: Request) {
  try {
    // Anti-abuse: cap new signups per IP (3 per 24h) before touching the DB user table.
    const ip = getClientIp(request);
    if (ip) {
      const rl = await consumeRateLimit('signup', ip, 3, DAY_MS);
      if (!rl.allowed) {
        return NextResponse.json(
          { error: 'Too many accounts created from this network today. Please try again later.', code: 'rate_limited', retryAfterSec: rl.retryAfterSec },
          { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } },
        );
      }
    }

    const body = await request.json();
    const { email, password, name } = body ?? {};
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 });
    }
    const passwordHash = await bcrypt.hash(password, 12);

    // If the client indicates OTP was verified, confirm it server-side
    // and auto-set emailVerified so trial checkout can proceed.
    let emailVerifiedAt: Date | null = null;
    if (body.otpVerified) {
      const verifiedOtp = await prisma.emailOtp.findFirst({
        where: {
          email: email.toLowerCase().trim(),
          verified: true,
          expiresAt: { gt: new Date(Date.now() - 30 * 60 * 1000) }, // within 30 min
        },
        orderBy: { createdAt: 'desc' },
      });
      if (verifiedOtp) {
        emailVerifiedAt = new Date();
      }
    }

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name: name ?? email.split('@')[0],
        ...(emailVerifiedAt ? { emailVerified: emailVerifiedAt } : {}),
      },
    });
    // Create free subscription
    await prisma.subscription.create({ data: { userId: user.id, tier: 'free', status: 'active' } });
    // Create credit record
    await prisma.credit.create({ data: { userId: user.id, balance: 0 } });

    // Issue an email-verification token and send the verification email.
    // Free-tier generation is gated on a verified email (enforced server-side).
    let emailSent = false;
    try {
      const token = await issueVerificationToken(user.id);
      emailSent = await sendVerificationEmail(user.email, user.name, token);
    } catch (e) {
      console.warn('[signup] verification email step failed:', (e as any)?.message);
    }

    return NextResponse.json(
      { id: user.id, email: user.email, name: user.name, verificationEmailSent: emailSent, requiresVerification: true },
      { status: 201 },
    );
  } catch (err: any) {
    console.error('Signup error:', err);
    return NextResponse.json({ error: 'Failed to create account' }, { status: 500 });
  }
}
