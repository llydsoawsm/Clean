import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { runSync, checkApiReachable } from './engine';

export function useSyncOnForeground() {
  const { state } = useAuth();
  const shopId = state.status === 'authenticated' ? state.session.shop.id : null;
  const token = state.status === 'authenticated' ? state.session.token : null;
  const lastSyncRef = useRef<number>(0);

  useEffect(() => {
    if (!shopId || !token) return;

    const handler = async (next: AppStateStatus) => {
      if (next === 'active') {
        const now = Date.now();
        // throttle: at most once per 30s
        if (now - lastSyncRef.current < 30000) return;
        lastSyncRef.current = now;
        try {
          const reachable = await checkApiReachable();
          if (reachable) {
            await runSync(shopId, token);
          }
        } catch {}
      }
    };

    const sub = AppState.addEventListener('change', handler);
    // Also run once on mount if online
    (async () => {
      try {
        const reachable = await checkApiReachable();
        if (reachable) await runSync(shopId, token);
      } catch {}
    })();
    return () => sub.remove();
  }, [shopId, token]);
}
