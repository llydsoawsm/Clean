import { api } from '@/services/api';
import { getLastSyncCursor } from './cursor';
import { pushPending } from './push';
import { pullServerChanges } from './pull';
import { getPendingBreakdown } from './push';
import { getDatabase } from '@/db/client';
import { nowIso } from '@/utils/dates';

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'failed' | 'offline';

export interface SyncResult {
  status: SyncStatus;
  pushed: number;
  pulled: number;
  pendingAfter: number;
  error?: string;
  at: string;
}

let isSyncing = false;
let lastResult: SyncResult | null = null;

export function getLastSyncResult(): SyncResult | null {
  return lastResult;
}

export function isSyncInProgress(): boolean {
  return isSyncing;
}

// Exponential backoff helper: 2s, 5s, 15s for 3 retries
export async function withRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (i < retries - 1) {
        const delay = i === 0 ? 2000 : i === 1 ? 5000 : 15000;
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastErr;
}

export async function checkApiReachable(): Promise<boolean> {
  try {
    await api.getHealth();
    return true;
  } catch {
    return false;
  }
}

export async function runSync(shopId: string, token: string): Promise<SyncResult> {
  if (isSyncing) {
    return { status: 'syncing', pushed: 0, pulled: 0, pendingAfter: await getPendingBreakdown(shopId).then((b) => b.total), at: nowIso() };
  }
  isSyncing = true;
  try {
    const reachable = await checkApiReachable();
    if (!reachable) {
      const pendingAfter = await getPendingBreakdown(shopId).then((b) => b.total);
      lastResult = { status: 'offline', pushed: 0, pulled: 0, pendingAfter, error: 'API unreachable', at: nowIso() };
      return lastResult;
    }

    // Push first (customers→services→orders→payments→status)
    const pushRes = await withRetry(() => pushPending(shopId, token), 3).catch((e) => {
      throw new Error(e instanceof Error ? e.message : String(e));
    });

    // Pull after push
    const pullRes = await withRetry(() => pullServerChanges(shopId, token), 3).catch((e) => {
      // Pull failure should not revert push success
      throw e;
    });

    const pendingAfter = await getPendingBreakdown(shopId).then((b) => b.total);
    lastResult = {
      status: pendingAfter > 0 ? 'failed' : 'synced',
      pushed: pushRes.synced,
      pulled: pullRes.pulled,
      pendingAfter,
      at: nowIso(),
    };
    // Log to sync_logs
    try {
      const db = getDatabase();
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      await db.runAsync(`INSERT INTO sync_logs (id, entity, entity_id, action, error, created_at) VALUES (?, ?, ?, ?, ?, ?);`, [
        id,
        'sync',
        shopId,
        `push:${pushRes.synced} pull:${pullRes.pulled} pending:${pendingAfter}`,
        null,
        nowIso(),
      ] as any);
    } catch {}
    return lastResult;
  } catch (e) {
    const pendingAfter = await getPendingBreakdown(shopId).then((b) => b.total).catch(() => 0);
    lastResult = {
      status: 'failed',
      pushed: 0,
      pulled: 0,
      pendingAfter,
      error: e instanceof Error ? e.message : String(e),
      at: nowIso(),
    };
    try {
      const db = getDatabase();
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      await db.runAsync(`INSERT INTO sync_logs (id, entity, entity_id, action, error, created_at) VALUES (?, ?, ?, ?, ?, ?);`, [
        id,
        'sync',
        shopId,
        'failed',
        lastResult.error,
        nowIso(),
      ] as any);
    } catch {}
    return lastResult;
  } finally {
    isSyncing = false;
  }
}

export async function getPendingCount(shopId: string): Promise<number> {
  const b = await getPendingBreakdown(shopId);
  return b.total;
}

export async function getSyncStatus(shopId: string): Promise<{ status: SyncStatus; pending: number; lastSyncAt: string | null }> {
  const pending = await getPendingBreakdown(shopId).then((b) => b.total);
  const lastSyncAt = await getLastSyncCursor(shopId);
  let status: SyncStatus = 'idle';
  if (isSyncing) status = 'syncing';
  else if (pending > 0) status = 'failed'; // will be retried
  else if (lastSyncAt) status = 'synced';
  else status = 'idle';
  // If lastResult indicates offline/failed, reflect
  if (lastResult?.status === 'offline') status = 'offline';
  else if (lastResult?.status === 'failed' && pending > 0) status = 'failed';
  else if (lastResult?.status === 'synced' && pending === 0) status = 'synced';
  return { status, pending, lastSyncAt };
}
