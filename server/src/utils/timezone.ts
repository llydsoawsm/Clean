import { config } from '../config/env';

/**
 * Resolve timezone offset in minutes (east of UTC, e.g., +480 for Asia/Manila UTC+8).
 * Accepts optional query/header override, falls back to config.defaultTzOffsetMinutes.
 */
export function resolveTzOffsetMinutes(raw?: unknown): number {
  if (typeof raw === 'string' && raw.trim() !== '') {
    const n = Number(raw.trim());
    if (Number.isInteger(n) && n >= -720 && n <= 840) return n;
  }
  return config.defaultTzOffsetMinutes;
}

/**
 * Returns UTC ISO string for 00:00:00.000 of the given date in the target timezone offset.
 */
export function startOfDayIso(date: Date, tzOffsetMinutes: number): string {
  const offsetMs = tzOffsetMinutes * 60_000;
  const shifted = new Date(date.getTime() + offsetMs);
  const startShiftedUtc = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate(), 0, 0, 0, 0);
  return new Date(startShiftedUtc - offsetMs).toISOString();
}

/**
 * Returns UTC ISO string for 23:59:59.999 of the given date in the target timezone offset.
 */
export function endOfDayIso(date: Date, tzOffsetMinutes: number): string {
  const offsetMs = tzOffsetMinutes * 60_000;
  const shifted = new Date(date.getTime() + offsetMs);
  const endShiftedUtc = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate(), 23, 59, 59, 999);
  return new Date(endShiftedUtc - offsetMs).toISOString();
}

/**
 * Returns UTC ISO string for 00:00:00.000 on the 1st day of the current month in the target timezone offset.
 */
export function startOfMonthIso(date: Date, tzOffsetMinutes: number): string {
  const offsetMs = tzOffsetMinutes * 60_000;
  const shifted = new Date(date.getTime() + offsetMs);
  const startShiftedUtc = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), 1, 0, 0, 0, 0);
  return new Date(startShiftedUtc - offsetMs).toISOString();
}

/**
 * Formats a UTC Date as YYYY-MM-DD in the target timezone offset.
 */
export function localDateKey(date: Date, tzOffsetMinutes: number): string {
  const shifted = new Date(date.getTime() + tzOffsetMinutes * 60_000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const d = String(shifted.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * SQLite modifier string for shifting a UTC timestamp into the target timezone offset,
 * e.g. '+480 minutes' or '-300 minutes'.
 */
export function sqliteOffsetModifier(tzOffsetMinutes: number): string {
  const sign = tzOffsetMinutes >= 0 ? '+' : '';
  return `${sign}${tzOffsetMinutes} minutes`;
}

/**
 * Parse an ISO / date string safely; returns null if invalid.
 */
export function safeParseIso(raw: string): string | null {
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

