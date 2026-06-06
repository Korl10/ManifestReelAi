// ── Email verification helpers ──────────────────────────────────────
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';

const TOKEN_TTL_HOURS = 48;

/** Generate + persist a fresh verification token for a user. Returns the token. */
export async function issueVerificationToken(userId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex');
  const expiry = new Date(Date.now() + TOKEN_TTL_HOURS * 60 * 60 * 1000);
  await prisma.user.update({
    where: { id: userId },
    data: { verifyToken: token, verifyTokenExpiry: expiry },
  });
  return token;
}

/** Build the absolute verification URL for the current deployment. */
export function buildVerifyUrl(token: string): string {
  const base = (process.env.NEXTAUTH_URL || '').replace(/\/$/, '');
  return `${base}/api/auth/verify?token=${encodeURIComponent(token)}`;
}

/**
 * Send the verification email. Best-effort: logs and resolves even if the mail
 * API fails, so signup never hard-fails on a transient email error.
 */
export async function sendVerificationEmail(email: string, name: string | null, token: string): Promise<boolean> {
  const appUrl = process.env.NEXTAUTH_URL || '';
  let hostname = 'manifestreelai.com';
  try { hostname = new URL(appUrl).hostname; } catch {}
  const verifyUrl = buildVerifyUrl(token);
  const displayName = name || email.split('@')[0];

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1a1a1a;">
      <div style="text-align:center; padding: 8px 0 4px;">
        <h1 style="font-size: 22px; letter-spacing: 0.5px; margin: 0; color: #7B2FBE;">ManifestReel<span style="color:#D4AF37;">AI</span></h1>
      </div>
      <div style="background: #faf8ff; border: 1px solid #ece6f7; padding: 28px; border-radius: 12px; margin: 16px 0;">
        <h2 style="margin: 0 0 12px; font-size: 18px;">Confirm your email, ${displayName} ✨</h2>
        <p style="font-size: 14px; line-height: 1.6; margin: 0 0 20px;">
          You're one step away from creating your first manifestation reel. Tap the button below to verify your email and unlock free reel generation.
        </p>
        <div style="text-align:center; margin: 24px 0;">
          <a href="${verifyUrl}" style="display:inline-block; background:#7B2FBE; color:#ffffff; text-decoration:none; padding: 12px 28px; border-radius: 999px; font-weight:600; font-size:14px;">Verify my email</a>
        </div>
        <p style="font-size: 12px; color:#6b6b6b; line-height:1.6; margin: 12px 0 0;">
          This link expires in ${TOKEN_TTL_HOURS} hours. If the button doesn't work, copy and paste this URL into your browser:<br/>
          <a href="${verifyUrl}" style="color:#7B2FBE; word-break:break-all;">${verifyUrl}</a>
        </p>
      </div>
      <p style="font-size: 11px; color:#9a9a9a; text-align:center;">If you didn't create a ManifestReel AI account, you can safely ignore this email.</p>
    </div>`;

  try {
    const res = await fetch('https://apps.abacus.ai/api/sendNotificationEmail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deployment_token: process.env.ABACUSAI_API_KEY,
        app_id: process.env.WEB_APP_ID,
        notification_id: process.env.NOTIF_ID_EMAIL_VERIFICATION,
        subject: 'Verify your email to start creating reels',
        body: htmlBody,
        is_html: true,
        recipient_email: email,
        sender_email: `noreply@${hostname}`,
        sender_alias: 'ManifestReel AI',
      }),
    });
    const result = await res.json().catch(() => ({}));
    if (!result?.success && !result?.notification_disabled) {
      console.warn('[email-verify] send failed:', result?.message);
      return false;
    }
    return true;
  } catch (e) {
    console.warn('[email-verify] send error:', (e as any)?.message);
    return false;
  }
}
