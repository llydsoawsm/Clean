/**
 * UUID v4 generation for offline records.
 * Uses expo-crypto.randomUUID() when available, fallback to Math.random.
 * No native build required — works in Expo Go.
 */
import * as Crypto from 'expo-crypto';

export function uuidv4(): string {
  // expo-crypto.randomUUID() is available on SDK 53+ and is Expo Go compatible
  // Guard for web/test where Crypto may not have randomUUID
  try {
    const maybe = (Crypto as unknown as { randomUUID?: () => string }).randomUUID;
    if (typeof maybe === 'function') {
      return maybe.call(Crypto);
    }
  } catch {
    // fallthrough
  }
  // Fallback: RFC4122 v4 via Math.random (good enough for single-device MVP)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Validate UUID string shape (basic)
 */
export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
