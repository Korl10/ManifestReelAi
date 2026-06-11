/**
 * Disposable / throwaway email domain blocker.
 * ============================================================
 * Gate 1 anti-abuse: blocks signup/trial from known disposable email providers.
 *
 * Strategy:
 *   1. Hardcoded TOP_100 list → always available (zero latency).
 *   2. DB-backed BlockedDomain table → admin can add/remove via /admin/abuse.
 *   3. (Phase 5D) Weekly cron refreshes the full list from GitHub.
 *
 * Trusted providers (Gmail, Outlook, iCloud, etc.) are ALWAYS allowed,
 * including subdomain variants like googlemail.com.
 */

import { prisma } from '@/lib/prisma';

// ── Always-allowed domains (never block these) ──────────────────────
const TRUSTED_DOMAINS = new Set([
  'gmail.com', 'googlemail.com',
  'outlook.com', 'hotmail.com', 'live.com', 'msn.com',
  'icloud.com', 'me.com', 'mac.com',
  'yahoo.com', 'yahoo.co.uk', 'yahoo.co.jp',
  'protonmail.com', 'proton.me', 'pm.me',
  'aol.com', 'zoho.com', 'yandex.com', 'mail.com',
  'seznam.cz', 'email.cz', 'post.cz',
  'fastmail.com', 'tutanota.com', 'tuta.io',
]);

// ── Top 100 disposable domains (always-on fallback) ─────────────────
const TOP_100: string[] = [
  'mailinator.com','guerrillamail.com','guerrillamail.de','tempmail.com',
  'throwaway.email','temp-mail.org','fakeinbox.com','sharklasers.com',
  'guerrillamailblock.com','grr.la','dispostable.com','yopmail.com',
  'trashmail.com','trashmail.me','trashmail.net','mailnesia.com',
  'maildrop.cc','discard.email','mailcatch.com','tempail.com',
  'tempr.email','einrot.com','harakirimail.com','jetable.org',
  'meltmail.com','spamfree24.org','spaml.com','uggsrock.com',
  'mytemp.email','mailforspam.com','safetymail.info','binkmail.com',
  'spamgourmet.com','incognitomail.org','mailexpire.com','tempinbox.com',
  'getnada.com','emailondeck.com','33mail.com','mailsac.com',
  'mohmal.com','burnermail.io','tempmailo.com','tmail.ws',
  'crazymailing.com','armyspy.com','cuvox.de','dayrep.com',
  'einrot.de','fleckens.hu','gustr.com','jourrapide.com',
  'rhyta.com','superrito.com','teleworm.us','extremail.ru',
  'mintemail.com','emailfake.com','fakemail.net','10minutemail.com',
  '10minutemail.co.za','boun.cr','filzmail.com','haltospam.com',
  'kurzepost.de','objectmail.com','proxymail.eu','punkass.com',
  'rcpt.at','reallymymail.com','recode.me','recursor.net',
  'regbypass.com','s0ny.net','safetypost.de','spambox.us',
  'spamcero.com','spamex.com','spamherelots.com','speed.1s.fr',
  'suremail.info','tempemail.co.za','tempemail.net','tempinbox.co.uk',
  'thankyou2010.com','thisisnotmyrealemail.com','trash-mail.at',
  'trashymail.com','trashymail.net','twinmail.de','tyldd.com',
  'uggsrock.com','veryrealemail.com','viditag.com','vomoto.com',
  'whatpaas.com','wuzupmail.net','xagloo.com','xemaps.com',
  'xents.com','xjoi.com','xoxy.net','yapped.net','yolanda.dev',
  'zehnminutenmail.de','zoemail.org',
];

const TOP_100_SET = new Set(TOP_100);

/** Check if a domain is disposable (returns true → should be blocked). */
export async function isDisposableDomain(email: string): Promise<boolean> {
  const domain = email.split('@').pop()?.toLowerCase().trim();
  if (!domain) return true; // malformed → block

  // Trusted providers are NEVER blocked
  if (TRUSTED_DOMAINS.has(domain)) return false;

  // Hardcoded top-100 check (instant)
  if (TOP_100_SET.has(domain)) return true;

  // DB check (admin-managed + weekly cron-imported)
  try {
    const blocked = await prisma.blockedDomain.findUnique({ where: { domain } });
    if (blocked) return true;
  } catch (err) {
    console.warn('[disposable-domains] DB check failed (non-fatal):', (err as any)?.message);
  }

  return false;
}

/** Get all trusted domains (for admin display). */
export function getTrustedDomains(): string[] {
  return Array.from(TRUSTED_DOMAINS);
}

/** Get the hardcoded top-100 list (for admin display). */
export function getHardcodedBlocklist(): string[] {
  return TOP_100;
}
