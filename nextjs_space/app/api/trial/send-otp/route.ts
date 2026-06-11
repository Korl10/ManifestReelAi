export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createOtp, getLatestOtp } from '@/lib/otp';
import { isDisposableDomain } from '@/lib/disposable-domains';
import { prisma } from '@/lib/prisma';
import { sendMail } from '@/lib/smtp-mailer';

/**
 * POST /api/trial/send-otp
 * Body: { email: string }
 *
 * Sends a 6-digit OTP code + magic link to the user's email.
 * Gate 1: blocks disposable emails before sending.
 */
export async function POST(request: Request) {
  try {
    const { email } = await request.json();
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Gate 1a: Disposable domain block
    const disposable = await isDisposableDomain(normalizedEmail);
    if (disposable) {
      return NextResponse.json({
        error: 'Please use a permanent email address (Gmail, Outlook, iCloud, etc.).',
        code: 'DISPOSABLE_EMAIL',
      }, { status: 400 });
    }

    // Check if email already has a trial lock
    const existingLock = await prisma.trialLock.findUnique({
      where: { email: normalizedEmail },
    });
    if (existingLock && !existingLock.supportOverride) {
      return NextResponse.json({
        error: 'This email has already been used for a free trial. Please subscribe to continue.',
        code: 'ALREADY_TRIALED',
      }, { status: 400 });
    }

    // Create OTP
    const result = await createOtp(normalizedEmail);
    if (!result.success) {
      return NextResponse.json({
        error: result.error,
        retryAfterSec: result.retryAfterSec,
        code: 'RATE_LIMITED',
      }, { status: 429 });
    }

    // Fetch the OTP record to get code + magic token for the email
    const otpRecord = await getLatestOtp(normalizedEmail);
    if (!otpRecord) {
      return NextResponse.json({ error: 'Failed to create verification code' }, { status: 500 });
    }

    // Send the email
    const appUrl = (process.env.NEXTAUTH_URL || '').replace(/\/$/, '');
    const magicUrl = `${appUrl}/api/trial/verify-magic?token=${encodeURIComponent(otpRecord.magicToken || '')}`;
    const displayCode = otpRecord.code;

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1a1a1a;">
        <div style="text-align:center; padding: 8px 0 4px;">
          <h1 style="font-size: 22px; letter-spacing: 0.5px; margin: 0; color: #7B2FBE;">ManifestReel<span style="color:#D4AF37;">AI</span></h1>
        </div>
        <div style="background: #faf8ff; border: 1px solid #ece6f7; padding: 28px; border-radius: 12px; margin: 16px 0;">
          <h2 style="margin: 0 0 12px; font-size: 18px;">Your verification code ✨</h2>
          <p style="font-size: 14px; line-height: 1.6; margin: 0 0 20px;">
            Enter this code to verify your email and start your free trial:
          </p>
          <div style="text-align:center; margin: 24px 0;">
            <div style="display:inline-block; background:#7B2FBE; color:#ffffff; padding: 16px 32px; border-radius: 12px; font-size: 28px; font-weight: 700; letter-spacing: 8px; font-family: monospace;">
              ${displayCode}
            </div>
          </div>
          <p style="font-size: 13px; color:#6b6b6b; line-height:1.6; margin: 16px 0 0; text-align:center;">
            This code expires in 10 minutes.
          </p>
          <hr style="border: none; border-top: 1px solid #ece6f7; margin: 24px 0;" />
          <p style="font-size: 13px; color:#6b6b6b; line-height:1.6; margin: 0; text-align:center;">
            Or click the magic link below to verify instantly:
          </p>
          <div style="text-align:center; margin: 16px 0 0;">
            <a href="${magicUrl}" style="display:inline-block; background:#D4AF37; color:#1a1a1a; text-decoration:none; padding: 10px 24px; border-radius: 999px; font-weight:600; font-size:13px;">Verify via magic link</a>
          </div>
        </div>
        <p style="font-size: 11px; color:#9a9a9a; text-align:center;">If you didn't request this, you can safely ignore this email.</p>
      </div>`;

    try {
      await sendMail({
        emailType: 'email_otp',
        to: normalizedEmail,
        subject: `${displayCode} — Your ManifestReel AI verification code`,
        html: htmlBody,
        notificationId: process.env.NOTIF_ID_EMAIL_OTP_VERIFICATION || '',
      });
    } catch (emailErr) {
      console.warn('[send-otp] Email send failed (non-fatal):', (emailErr as any)?.message);
    }

    return NextResponse.json({ success: true, message: 'Verification code sent to your email.' });
  } catch (err) {
    console.error('[send-otp] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
