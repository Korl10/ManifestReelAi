/**
 * SMTP Mailer — Nodemailer transport with Abacus API fallback
 * ============================================================
 * Primary: Namecheap Private Email SMTP (mail.privateemail.com:465)
 * Fallback: Abacus AI sendNotificationEmail API (when SMTP_PASS not set)
 *
 * FROM / REPLY-TO mapping per email type:
 *   hello@   → welcome, trial reminder
 *   noreply@ → OTP, payment failed, cancellation, email verification, dispute
 *   admin@   → dispute TO recipient (replaces granatk@seznam.cz)
 */

import nodemailer from 'nodemailer';

// ── Types ────────────────────────────────────────────────────────
export type EmailType =
  | 'welcome'
  | 'trial_reminder'
  | 'payment_failed'
  | 'cancellation'
  | 'email_verification'
  | 'email_otp'
  | 'dispute_alert';

export interface SendMailParams {
  emailType: EmailType;
  to: string;
  subject: string;
  html: string;
  /** Plain-text alternative (multipart/alternative) — improves spam score */
  text?: string;
  /** Abacus notification ID — used only when falling back to Abacus API */
  notificationId?: string;
}

// ── FROM / REPLY-TO mapping ──────────────────────────────────────
// NOTE: Namecheap Private Email only allows sending from the authenticated
// mailbox (SMTP_USER). All emails use noreply@ as FROM, with support@ as
// REPLY-TO so user replies go to the right inbox.
const FROM_MAP: Record<EmailType, { fromLocal: string; replyToLocal: string }> = {
  welcome:            { fromLocal: 'noreply', replyToLocal: 'support' },
  trial_reminder:     { fromLocal: 'noreply', replyToLocal: 'support' },
  payment_failed:     { fromLocal: 'noreply', replyToLocal: 'support' },
  cancellation:       { fromLocal: 'noreply', replyToLocal: 'support' },
  email_verification: { fromLocal: 'noreply', replyToLocal: 'support' },
  email_otp:          { fromLocal: 'noreply', replyToLocal: 'support' },
  dispute_alert:      { fromLocal: 'noreply', replyToLocal: 'support' },
};

const DOMAIN = 'manifestreelai.com';
const SENDER_ALIAS = 'ManifestReel AI';

function getFrom(emailType: EmailType): string {
  const local = FROM_MAP[emailType]?.fromLocal || 'noreply';
  return `"${SENDER_ALIAS}" <${local}@${DOMAIN}>`;
}

function getReplyTo(emailType: EmailType): string {
  const local = FROM_MAP[emailType]?.replyToLocal || 'support';
  return `${local}@${DOMAIN}`;
}

/** Admin email for dispute alerts and abuse notifications */
export function getAdminEmail(): string {
  return process.env.ADMIN_EMAIL || `admin@${DOMAIN}`;
}

// ── SMTP transport (singleton) ───────────────────────────────────
let _transport: nodemailer.Transporter | null = null;

function isSmtpConfigured(): boolean {
  return !!(
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS &&
    process.env.SMTP_PASS !== 'PLACEHOLDER_PASTE_REAL_PASSWORD'
  );
}

function getTransport(): nodemailer.Transporter {
  if (_transport) return _transport;
  _transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'mail.privateemail.com',
    port: parseInt(process.env.SMTP_PORT || '465', 10),
    secure: process.env.SMTP_SECURE !== 'false', // default true for port 465
    auth: {
      user: process.env.SMTP_USER || `noreply@${DOMAIN}`,
      pass: process.env.SMTP_PASS || '',
    },
    tls: { rejectUnauthorized: true },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
  return _transport;
}

// ── Send via SMTP ────────────────────────────────────────────────
async function sendViaSmtp(params: SendMailParams): Promise<boolean> {
  const transport = getTransport();
  try {
    const unsubUrl = `${(process.env.NEXTAUTH_URL || `https://${DOMAIN}`).replace(/\/$/, '')}/dashboard/settings`;
    const info = await transport.sendMail({
      from: getFrom(params.emailType),
      to: params.to,
      replyTo: getReplyTo(params.emailType),
      subject: params.subject,
      html: params.html,
      ...(params.text ? { text: params.text } : {}),
      headers: {
        'List-Unsubscribe': `<${unsubUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    });
    console.log(`[smtp-mailer] ✓ Sent via SMTP (${params.emailType}): messageId=${info.messageId}`);
    return true;
  } catch (err) {
    console.error(`[smtp-mailer] SMTP send failed (${params.emailType}):`, (err as Error).message);
    // Reset transport on connection errors so next call creates fresh one
    _transport = null;
    return false;
  }
}

// ── Fallback: Abacus notification API ────────────────────────────
function getHostname(): string {
  const appUrl = process.env.NEXTAUTH_URL || '';
  try { return new URL(appUrl).hostname; } catch { return DOMAIN; }
}

async function sendViaAbacusApi(params: SendMailParams): Promise<boolean> {
  if (!params.notificationId) {
    console.warn('[smtp-mailer] No notificationId for Abacus fallback, skipping');
    return false;
  }
  const hostname = getHostname();
  try {
    const res = await fetch('https://apps.abacus.ai/api/sendNotificationEmail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deployment_token: process.env.ABACUSAI_API_KEY,
        app_id: process.env.WEB_APP_ID,
        notification_id: params.notificationId,
        subject: params.subject,
        body: params.html,
        is_html: true,
        recipient_email: params.to,
        sender_email: `noreply@${hostname}`,
        sender_alias: SENDER_ALIAS,
      }),
    });
    const result = await res.json().catch(() => ({}));
    if (!(result as any)?.success && !(result as any)?.notification_disabled) {
      console.warn('[smtp-mailer] Abacus API fallback failed:', (result as any)?.message);
      return false;
    }
    console.log(`[smtp-mailer] ✓ Sent via Abacus API fallback (${params.emailType})`);
    return true;
  } catch (e) {
    console.warn('[smtp-mailer] Abacus API fallback error:', (e as Error).message);
    return false;
  }
}

// ── Public API: try SMTP first, fall back to Abacus ──────────────
export async function sendMail(params: SendMailParams): Promise<boolean> {
  // Try SMTP first when configured
  if (isSmtpConfigured()) {
    const ok = await sendViaSmtp(params);
    if (ok) return true;
    // SMTP failed — try Abacus fallback
    console.warn(`[smtp-mailer] SMTP failed for ${params.emailType}, trying Abacus fallback…`);
  }
  // Fallback (or SMTP not configured)
  return sendViaAbacusApi(params);
}
