'use client';

import { useState, useEffect, useRef } from 'react';

/**
 * Client-side device fingerprint using open-source FingerprintJS.
 * Returns the visitor ID (raw fingerprint) which gets hashed server-side
 * with an app-specific salt before storage.
 */
export function useDeviceFingerprint() {
  const [fingerprint, setFingerprint] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    async function init() {
      try {
        const FingerprintJS = await import('@fingerprintjs/fingerprintjs');
        const fp = await FingerprintJS.load();
        const result = await fp.get();
        setFingerprint(result.visitorId);
      } catch (err) {
        console.warn('[device-fp] FingerprintJS init failed:', (err as any)?.message);
        setFingerprint(null);
      } finally {
        setLoading(false);
      }
    }

    init();
  }, []);

  return { fingerprint, loading };
}
