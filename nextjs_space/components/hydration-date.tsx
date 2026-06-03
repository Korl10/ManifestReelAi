'use client';
import { useState, useEffect } from 'react';

export function HydrationDate({ date, fallback }: { date: string | Date | null | undefined; fallback?: string }) {
  const [formatted, setFormatted] = useState(fallback ?? '');

  useEffect(() => {
    if (date) {
      try {
        setFormatted(new Date(date).toLocaleDateString());
      } catch {
        setFormatted(fallback ?? '');
      }
    }
  }, [date, fallback]);

  return <>{formatted}</>;
}

export function HydrationDateTime({ date, fallback }: { date: string | Date | null | undefined; fallback?: string }) {
  const [formatted, setFormatted] = useState(fallback ?? '');

  useEffect(() => {
    if (date) {
      try {
        setFormatted(new Date(date).toLocaleString());
      } catch {
        setFormatted(fallback ?? '');
      }
    }
  }, [date, fallback]);

  return <>{formatted}</>;
}
