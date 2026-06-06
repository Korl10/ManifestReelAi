export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { issueVerificationToken, sendVerificationEmail } from '@/lib/email-verify';

export async function POST(request: Request) {
  try {
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
    const user = await prisma.user.create({
      data: { email, passwordHash, name: name ?? email.split('@')[0] },
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
