/**
 * Subscription lifecycle emails
 * ============================================================
 * Uses SMTP mailer (Namecheap Private Email) with Abacus API fallback.
 * Best-effort sends: log and resolve even when the mail API errors.
 */

import { sendMail, getAdminEmail } from '@/lib/smtp-mailer';

function getAppUrl(): string {
  return (process.env.NEXTAUTH_URL || '').replace(/\/$/, '');
}

function wrap(innerHtml: string): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1a1a1a;">
      <div style="text-align:center; padding: 8px 0 4px;">
        <h1 style="font-size: 22px; letter-spacing: 0.5px; margin: 0; color: #7B2FBE;">ManifestReel<span style="color:#D4AF37;">AI</span></h1>
      </div>
      <div style="background: #faf8ff; border: 1px solid #ece6f7; padding: 28px; border-radius: 12px; margin: 16px 0;">
        ${innerHtml}
      </div>
      <p style="font-size: 11px; color:#9a9a9a; text-align:center;">You're receiving this because you have a ManifestReel AI account.</p>
    </div>`;
}

/** Welcome email after trial → paid conversion. */
export async function sendWelcomeEmail(email: string, name: string | null, planName: string, credits: number): Promise<boolean> {
  const displayName = name || email.split('@')[0];
  const dashUrl = `${getAppUrl()}/dashboard`;
  return sendMail({
    emailType: 'welcome',
    to: email,
    subject: `Welcome to ${planName}, ${displayName}! 🌟`,
    html: wrap(`
      <h2 style="margin: 0 0 12px; font-size: 18px;">You're officially a ${planName} member! 🎉</h2>
      <p style="font-size: 14px; line-height: 1.6; margin: 0 0 16px;">
        Your ${credits.toLocaleString()} monthly credits are loaded and ready to go.
        Your trial reel watermark has been removed — it's now yours, clean and beautiful.
      </p>
      <div style="text-align:center; margin: 24px 0;">
        <a href="${dashUrl}" style="display:inline-block; background:#7B2FBE; color:#ffffff; text-decoration:none; padding: 12px 28px; border-radius: 999px; font-weight:600; font-size:14px;">Start creating</a>
      </div>
    `),
    notificationId: process.env.NOTIF_ID_SUBSCRIPTION_WELCOME || '',
  });
}

/** Payment failed notification. */
export async function sendPaymentFailedEmail(email: string, name: string | null): Promise<boolean> {
  const displayName = name || email.split('@')[0];
  const settingsUrl = `${getAppUrl()}/dashboard/settings`;
  return sendMail({
    emailType: 'payment_failed',
    to: email,
    subject: 'Action needed: payment failed for your ManifestReel AI subscription',
    html: wrap(`
      <h2 style="margin: 0 0 12px; font-size: 18px;">Payment issue, ${displayName} ⚠️</h2>
      <p style="font-size: 14px; line-height: 1.6; margin: 0 0 16px;">
        We couldn't process your subscription payment. Your account has a 3-day grace period —
        please update your payment method to keep creating reels without interruption.
      </p>
      <div style="text-align:center; margin: 24px 0;">
        <a href="${settingsUrl}" style="display:inline-block; background:#D4AF37; color:#1a1a1a; text-decoration:none; padding: 12px 28px; border-radius: 999px; font-weight:600; font-size:14px;">Update payment method</a>
      </div>
    `),
    notificationId: process.env.NOTIF_ID_PAYMENT_FAILED || '',
  });
}

/** Subscription cancelled email. */
export async function sendCancellationEmail(email: string, name: string | null, planName: string): Promise<boolean> {
  const displayName = name || email.split('@')[0];
  const appUrl = getAppUrl();
  return sendMail({
    emailType: 'cancellation',
    to: email,
    subject: `We're sorry to see you go, ${displayName}`,
    html: wrap(`
      <h2 style="margin: 0 0 12px; font-size: 18px;">Your ${planName} plan has been cancelled</h2>
      <p style="font-size: 14px; line-height: 1.6; margin: 0 0 16px;">
        We're sad to see you go, ${displayName}. Your existing reels will remain accessible,
        and you can re-subscribe anytime to pick up where you left off.
      </p>
      <p style="font-size: 14px; line-height: 1.6; margin: 0 0 20px;">
        If there's anything we could have done better, we'd love to hear from you.
      </p>
      <div style="text-align:center; margin: 24px 0;">
        <a href="${appUrl}" style="display:inline-block; background:#7B2FBE; color:#ffffff; text-decoration:none; padding: 12px 28px; border-radius: 999px; font-weight:600; font-size:14px;">Come back anytime</a>
      </div>
    `),
    notificationId: process.env.NOTIF_ID_SUBSCRIPTION_CANCELLED || '',
  });
}

/** Dispute alert to admin. */
export async function sendDisputeAlertEmail(userEmail: string, amount: number, disputeId: string): Promise<boolean> {
  return sendMail({
    emailType: 'dispute_alert',
    to: getAdminEmail(),
    subject: `⚠️ Dispute opened: $${(amount / 100).toFixed(2)} from ${userEmail}`,
    html: wrap(`
      <h2 style="margin: 0 0 12px; font-size: 18px;">Charge Dispute Opened ⚠️</h2>
      <p style="font-size: 14px; line-height: 1.6; margin: 0 0 8px;"><strong>User:</strong> ${userEmail}</p>
      <p style="font-size: 14px; line-height: 1.6; margin: 0 0 8px;"><strong>Amount:</strong> $${(amount / 100).toFixed(2)}</p>
      <p style="font-size: 14px; line-height: 1.6; margin: 0 0 8px;"><strong>Dispute ID:</strong> ${disputeId}</p>
      <p style="font-size: 14px; line-height: 1.6; margin: 16px 0 0;">
        The user's account has been automatically suspended. Their card fingerprint has been permanently blocked.
        Review in the <a href="${getAppUrl()}/admin/abuse" style="color:#7B2FBE;">Abuse Dashboard</a>.
      </p>
    `),
    notificationId: process.env.NOTIF_ID_DISPUTE_ALERT || '',
  });
}
