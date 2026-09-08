import { getDatabase } from '@/db/client';
import { nowIso } from '@/utils/dates';

export async function getLastSyncAt(shopId: string): Promise<string | null> {
  const db = getDatabase();
  const row = await db.getFirstAsync<{ last_sync_at: string | null }>('SELECT last_sync_at FROM sync_state WHERE shop_id=?;', [shopId]);
  return row?.last_sync_at ?? null;
}

export async function getLastSyncCursor(shopId: string): Promise<string | null> {
  const db = getDatabase();
  const row = await db.getFirstAsync<{ last_sync_cursor: string | null }>('SELECT last_sync_cursor FROM sync_state WHERE shop_id=?;', [shopId]);
  return row?.last_sync_cursor ?? null;
}

export async function setLastSync(shopId: string, cursor: string): Promise<void> {
  const db = getDatabase();
  const now = nowIso();
  await db.runAsync(
    `INSERT INTO sync_state (shop_id, last_sync_at, last_sync_cursor, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(shop_id) DO UPDATE SET last_sync_at=excluded.last_sync_at, last_sync_cursor=excluded.last_sync_cursor, updated_at=excluded.updated_at;`,
    [shopId, cursor, cursor, now]
  );
}

export async function clearSyncState(shopId: string): Promise<void> {
  const db = getDatabase();
  await db.runAsync('DELETE FROM sync_state WHERE shop_id=?;', [shopId]);
}
