/**
 * Hook to initialize Clean local DB on mount.
 * Idempotent, safe for offline.
 */
import { useEffect, useState } from 'react';
import { initDatabase } from '@/db/client';

export type DbInitState = { status: 'loading' } | { status: 'ready' } | { status: 'error'; message: string };

export function useDbInit(): DbInitState {
  const [state, setState] = useState<DbInitState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await initDatabase();
        if (!cancelled) setState({ status: 'ready' });
      } catch (e) {
        if (!cancelled) setState({ status: 'error', message: e instanceof Error ? e.message : String(e) });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
