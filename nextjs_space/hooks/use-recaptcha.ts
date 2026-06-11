'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || '';

/**
 * Client-side reCAPTCHA v3 hook.
 * Loads the reCAPTCHA script dynamically and provides executeRecaptcha().
 * Only loads when NEXT_PUBLIC_RECAPTCHA_SITE_KEY is set.
 */
export function useRecaptcha() {
  const [ready, setReady] = useState(false);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (!SITE_KEY || loadedRef.current) return;
    loadedRef.current = true;

    // Check if already loaded
    if (typeof window !== 'undefined' && (window as any).grecaptcha) {
      setReady(true);
      return;
    }

    const script = document.createElement('script');
    script.src = `https://www.google.com/recaptcha/api.js?render=${SITE_KEY}`;
    script.async = true;
    script.onload = () => {
      (window as any).grecaptcha.ready(() => setReady(true));
    };
    script.onerror = () => {
      console.warn('[recaptcha] Failed to load reCAPTCHA script');
    };
    document.head.appendChild(script);
  }, []);

  /**
   * Execute reCAPTCHA v3 for a given action.
   * Returns the token string, or null if not available.
   */
  const executeRecaptcha = useCallback(
    async (action: string): Promise<string | null> => {
      if (!SITE_KEY || !ready) return null;
      try {
        const token = await (window as any).grecaptcha.execute(SITE_KEY, { action });
        return token;
      } catch (err) {
        console.warn('[recaptcha] Execute failed:', err);
        return null;
      }
    },
    [ready],
  );

  return {
    ready: ready && !!SITE_KEY,
    executeRecaptcha,
    /** Whether reCAPTCHA is configured (site key present) */
    configured: !!SITE_KEY,
  };
}
