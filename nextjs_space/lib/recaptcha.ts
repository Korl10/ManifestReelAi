/**
 * reCAPTCHA v3 — Server-side verification
 * ============================================================
 * Gated by ABUSE_GATE_RECAPTCHA env var.
 * When gate is OFF, verifyRecaptcha() returns a pass-through result.
 *
 * Scoring tiers (configured at callsite):
 *   < 0.3 → hard block
 *   0.3–0.5 → require OTP
 *   ≥ 0.5 → pass
 */

export interface RecaptchaResult {
  success: boolean;
  score: number;
  action: string;
  hostname: string;
  /** Raw error codes from Google (if any) */
  errorCodes?: string[];
}

const RECAPTCHA_SECRET = process.env.RECAPTCHA_SECRET_KEY || '';
const GATE_ON = (process.env.ABUSE_GATE_RECAPTCHA || 'off').toLowerCase() === 'on';

/** Whether the reCAPTCHA gate is currently active. */
export function isRecaptchaGateOn(): boolean {
  return GATE_ON && !!RECAPTCHA_SECRET;
}

/**
 * Verify a reCAPTCHA v3 token with Google.
 * If the gate is OFF, returns a synthetic pass (score=1.0).
 */
export async function verifyRecaptcha(token: string): Promise<RecaptchaResult> {
  if (!isRecaptchaGateOn()) {
    return { success: true, score: 1.0, action: 'passthrough', hostname: '' };
  }

  if (!token) {
    return { success: false, score: 0, action: '', hostname: '', errorCodes: ['missing-input-response'] };
  }

  try {
    const params = new URLSearchParams();
    params.append('secret', RECAPTCHA_SECRET);
    params.append('response', token);

    const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const data = await res.json();
    return {
      success: data.success === true,
      score: typeof data.score === 'number' ? data.score : 0,
      action: data.action || '',
      hostname: data.hostname || '',
      errorCodes: data['error-codes'],
    };
  } catch (err) {
    console.error('[recaptcha] Verification failed:', err);
    // On network error, fail open (allow) to avoid blocking legit users
    return { success: true, score: 0.5, action: 'error_fallback', hostname: '', errorCodes: ['network-error'] };
  }
}

/**
 * Interpret a reCAPTCHA score into a gate decision.
 */
export type RecaptchaDecision = 'block' | 'otp_required' | 'pass';

export function interpretRecaptchaScore(score: number): RecaptchaDecision {
  if (score < 0.3) return 'block';
  if (score < 0.5) return 'otp_required';
  return 'pass';
}
