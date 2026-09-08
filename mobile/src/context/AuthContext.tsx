import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '@/services/api';
import {
  getAuthSession,
  setAuthSession,
  clearAuthSession,
  isTokenExpired,
  type StoredSession,
} from '@/store/authStorage';
import { initDatabase } from '@/db/client';
import { upsertShop } from '@/db/repositories/shop';
import type { AuthShop, AuthUser } from '@/types/auth';

export type AuthState =
  | { status: 'loading' }
  | { status: 'authenticated'; session: StoredSession }
  | { status: 'unauthenticated'; reason?: string };

interface AuthContextValue {
  state: AuthState;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { shopName: string; ownerName: string; email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshShop: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  // Restore cached session on mount (offline-capable)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Ensure local DB ready first (for shop cache)
        await initDatabase().catch(() => {});

        const cached = await getAuthSession();
        if (!cached) {
          if (!cancelled) setState({ status: 'unauthenticated' });
          return;
        }

        // If token expired, clear and require online login
        if (isTokenExpired(cached.token)) {
          if (!cancelled) setState({ status: 'unauthenticated', reason: 'Session expired, please log in online' });
          return;
        }

        // Valid cached session — allow offline open
        if (!cancelled) setState({ status: 'authenticated', session: cached });

        // Ensure local shops table contains the cached shop for FK integrity (offline-first)
        // This must happen even when offline, before any customer/service/order creation
        await upsertShop({
          id: cached.shop.id,
          name: cached.shop.name,
          owner_name: cached.shop.owner_name,
          contact_number: cached.shop.contact_number,
          address: cached.shop.address,
          currency: cached.shop.currency,
          rush_fee_centavos: cached.shop.rush_fee_centavos,
        }).catch(() => {});

        // Optional background refresh (non-blocking) - update if server has newer shop data
        try {
          const fresh = await api.getShopMe(cached.token);
          const updatedShop = fresh.data.shop;
          if (updatedShop.id !== cached.shop.id || updatedShop.name !== cached.shop.name) {
            await setAuthSession({ ...cached, shop: updatedShop });
            if (!cancelled) setState({ status: 'authenticated', session: { ...cached, shop: updatedShop } });
          }
          await upsertShop({
            id: updatedShop.id,
            name: updatedShop.name,
            owner_name: updatedShop.owner_name,
            contact_number: updatedShop.contact_number,
            address: updatedShop.address,
            currency: updatedShop.currency,
            rush_fee_centavos: updatedShop.rush_fee_centavos,
          }).catch(() => {});
        } catch {
          // offline or server down — keep cached session (already upserted above)
        }
      } catch (e) {
        if (!cancelled) setState({ status: 'unauthenticated', reason: e instanceof Error ? e.message : String(e) });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const persistSession = useCallback(async (session: StoredSession) => {
    await setAuthSession(session);
    try {
      await initDatabase();
      await upsertShop({
        id: session.shop.id,
        name: session.shop.name,
        owner_name: session.shop.owner_name,
        contact_number: session.shop.contact_number,
        address: session.shop.address,
        currency: session.shop.currency,
        rush_fee_centavos: session.shop.rush_fee_centavos,
      });
    } catch {}
    setState({ status: 'authenticated', session });
    // Trigger background sync after login/register (non-blocking, respects offline)
    try {
      const { runSync } = await import('@/sync/engine');
      runSync(session.shop.id, session.token).catch(() => {});
    } catch {}
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      // Must be online; api will throw if offline
      const res = await api.login({ email: email.trim().toLowerCase(), password });
      await persistSession({ token: res.data.token, user: res.data.user, shop: res.data.shop });
    },
    [persistSession]
  );

  const register = useCallback(
    async (data: { shopName: string; ownerName: string; email: string; password: string }) => {
      const res = await api.register({
        shopName: data.shopName.trim(),
        ownerName: data.ownerName.trim(),
        email: data.email.trim().toLowerCase(),
        password: data.password,
      });
      await persistSession({ token: res.data.token, user: res.data.user, shop: res.data.shop });
    },
    [persistSession]
  );

  const logout = useCallback(async () => {
    await clearAuthSession();
    // Important: do NOT delete laundry data (customers/services/orders/payments)
    setState({ status: 'unauthenticated' });
  }, []);

  const refreshShop = useCallback(async () => {
    if (state.status !== 'authenticated') return;
    const fresh = await api.getShopMe(state.session.token);
    const updated = { ...state.session, shop: fresh.data.shop };
    await setAuthSession(updated);
    setState({ status: 'authenticated', session: updated });
  }, [state]);

  const value = useMemo<AuthContextValue>(
    () => ({
      state,
      login,
      register,
      logout,
      refreshShop,
    }),
    [state, login, register, logout, refreshShop]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function useAuthSession(): StoredSession | null {
  const { state } = useAuth();
  return state.status === 'authenticated' ? state.session : null;
}
