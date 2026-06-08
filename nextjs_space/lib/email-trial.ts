// ── Trial lifecycle emails ──────────────────────────────────────────
// Best-effort sends: log and resolve even when the mail API errors so webhook
// processing never fails because of a transient email issue.

/**
 * Notify a user that their free trial is ending soon and a charge is imminent.
 * Triggered by Stripe's `customer.subscription.trial_will_end` webhook.
 */
export async function sendTrialEndingEmail(email: string, name: string | null, tier: string): Promise<boolean> {
  const appUrl = process.env.NEXTAUTH_URL || '';
  let hostname = 'manifestreelai.com';
  try { hostname = new URL(appUrl).hostname; } catch {}
  const displayName = name || email.split('@')[0];
  const billingUrl = `${appUrl.replace(/\/$/, '')}/dashboard/settings`;
  const planName = tier.charAt(0).toUpperCase() + tier.slice(1);

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1a1a1a;">
      <div style="text-align:center; padding: 8px 0 4px;">
        <h1 style="font-size: 22px; letter-spacing: 0.5px; margin: 0; color: #7B2FBE;">ManifestReel<span style="color:#D4AF37;">AI</span></h1>
      </div>
      <div style="background: #faf8ff; border: 1px solid #ece6f7; padding: 28px; border-radius: 12px; margin: 16px 0;">
        <h2 style="margin: 0 0 12px; font-size: 18px;">Your free trial ends in 24 hours, ${displayName} ⏳</h2>
        <p style="font-size: 14px; line-height: 1.6; margin: 0 0 16px;">
          Heads up — your ManifestReel AI <strong>${planName}</strong> free trial is wrapping up. In about 24 hours
          your subscription will begin and your card will be charged so you can keep creating reels without interruption.
        </p>
        <p style="font-size: 14px; line-height: 1.6; margin: 0 0 20px;">
          Love it? You don't need to do anything — your ${planName} plan continues automatically. Not ready yet?
          You can cancel anytime before the trial ends and you won't be charged.
        </p>
        <div style="text-align:center; margin: 24px 0;">
          <a href="${billingUrl}" style="display:inline-block; background:#7B2FBE; color:#ffffff; text-decoration:none; padding: 12px 28px; border-radius: 999px; font-weight:600; font-size:14px;">Manage my subscription</a>
        </div>
      </div>
      <p style="font-size: 11px; color:#9a9a9a; text-align:center;">You're receiving this because you started a free trial on ManifestReel AI.</p>
    </div>`;

  try {
    const res = await fetch('https://apps.abacus.ai/api/sendNotificationEmail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deployment_token: process.env.ABACUSAI_API_KEY,
        app_id: process.env.WEB_APP_ID,
        notification_id: process.env.NOTIF_ID_TRIAL_ENDING_SOON,
        subject: 'Your ManifestReel AI free trial ends in 24 hours',
        body: htmlBody,
        is_html: true,
        recipient_email: email,
        sender_email: `noreply@${hostname}`,
        sender_alias: 'ManifestReel AI',
      }),
    });
    const result = await res.json().catch(() => ({}));
    if (!result?.success && !result?.notification_disabled) {
      console.warn('[email-trial] send failed:', result?.message);
      return false;
    }
    return true;
  } catch (e) {
    console.warn('[email-trial] send error:', (e as any)?.message);
    return false;
  }
}
