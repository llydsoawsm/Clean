import * as SecureStore from 'expo-secure-store';
import type { AuthShop, AuthUser } from '@/types/auth';

const KEY_TOKEN = 'clean_auth_token';
const KEY_USER = 'clean_auth_user';
const KEY_SHOP = 'clean_auth_shop';

export interface StoredSession {
  token: string;
  user: AuthUser;
  shop: AuthShop;
}

/**
 * Securely store token + user/shop.
 * Uses expo-secure-store (Expo Go compatible, backed by Keychain/Keystore).
 */
export async function setAuthSession(session: StoredSession): Promise<void> {
  await SecureStore.setItemAsync(KEY_TOKEN, session.token);
  await SecureStore.setItemAsync(KEY_USER, JSON.stringify(session.user));
  await SecureStore.setItemAsync(KEY_SHOP, JSON.stringify(session.shop));
}

export async function getAuthSession(): Promise<StoredSession | null> {
  const token = await SecureStore.getItemAsync(KEY_TOKEN);
  if (!token) return null;
  const userRaw = await SecureStore.getItemAsync(KEY_USER);
  const shopRaw = await SecureStore.getItemAsync(KEY_SHOP);
  if (!userRaw || !shopRaw) return null;
  try {
    const user = JSON.parse(userRaw) as AuthUser;
    const shop = JSON.parse(shopRaw) as AuthShop;
    if (!user?.id || !shop?.id) return null;
    return { token, user, shop };
  } catch {
    return null;
  }
}

export async function clearAuthSession(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY_TOKEN);
  await SecureStore.deleteItemAsync(KEY_USER);
  await SecureStore.deleteItemAsync(KEY_SHOP);
}

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(KEY_TOKEN);
}

/**
 * Decode JWT payload without verifying signature (client-side exp check only).
 * Returns null if malformed.
 */
export function decodeJwtPayload(token: string): { exp?: number; iat?: number; userId?: string; shopId?: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    // Use atob if available, otherwise manual decode (Hermes may not have atob/Buffer)
    let json: string;
    if (typeof globalThis.atob === 'function') {
      json = globalThis.atob(padded);
    } else {
      // Manual base64 decode
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
      let str = '';
      let i = 0;
      const sanitized = padded.replace(/[^A-Za-z0-9+/=]/g, '');
      while (i < sanitized.length) {
        const enc1 = chars.indexOf(sanitized.charAt(i++));
        const enc2 = chars.indexOf(sanitized.charAt(i++));
        const enc3 = chars.indexOf(sanitized.charAt(i++));
        const enc4 = chars.indexOf(sanitized.charAt(i++));
        const chr1 = (enc1 << 2) | (enc2 >> 4);
        const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
        const chr3 = ((enc3 & 3) << 6) | enc4;
        str += String.fromCharCode(chr1);
        if (enc3 !== 64) str += String.fromCharCode(chr2);
        if (enc4 !== 64) str += String.fromCharCode(chr3);
      }
      // Decode UTF-8
      try {
        json = decodeURIComponent(
          Array.from(str)
            .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
            .join('')
        );
      } catch {
        json = str;
      }
    }
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function isTokenExpired(token: string): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload?.exp) return false; // if no exp, treat as not expired
  const nowSec = Math.floor(Date.now() / 1000);
  // 30s leeway
  return payload.exp < nowSec - 30;
}
