/**
 * Date helpers — always store ISO8601 UTC (TEXT), display local.
 */
export function nowIso(): string {
  return new Date().toISOString();
}

export function toLocalString(iso: string | null): string {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  const now = Date.now();
  return Math.floor((now - then) / (1000 * 60 * 60 * 24));
}

export function readyAgingLabel(readyAt: string | null): string {
  const d = daysSince(readyAt);
  if (d == null) return '';
  if (d <= 0) return 'Ready today';
  if (d === 1) return 'Ready for 1 day';
  return `Ready for ${d} days`;
}

export function isLongWaiting(readyAt: string | null): boolean {
  const d = daysSince(readyAt);
  return d != null && d >= 2;
}

export function formatDate(iso: string | null, opts?: { withTime?: boolean }): string {
  if (!iso) return '-';
  try {
    const d = new Date(iso);
    const date = d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
    if (opts?.withTime === false) return date;
    const time = d.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
    return `${date} • ${time}`;
  } catch {
    return iso;
  }
}
