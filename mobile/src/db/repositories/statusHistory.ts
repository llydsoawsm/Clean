/**
 * Status history repository
 */
import { getDatabase } from '../client';
import type { StatusHistoryRow, OrderStatus } from '../types';
import { uuidv4 } from '@/utils/uuid';
import { nowIso } from '@/utils/dates';

export async function listStatusHistory(orderId: string): Promise<StatusHistoryRow[]> {
  const db = getDatabase();
  return await db.getAllAsync<StatusHistoryRow>('SELECT * FROM status_history WHERE order_id=? AND is_deleted=0 ORDER BY changed_at ASC;', [orderId]);
}

export async function addStatusHistory(params: {
  order_id: string;
  from_status: OrderStatus | null;
  to_status: OrderStatus;
  changed_by?: string | null;
}): Promise<StatusHistoryRow> {
  const db = getDatabase();
  const id = uuidv4();
  const now = nowIso();
  await db.runAsync(
    `INSERT INTO status_history (id, order_id, from_status, to_status, changed_at, changed_by, sync_status, is_deleted)
     VALUES (?, ?, ?, ?, ?, ?, 'PENDING', 0);`,
    [id, params.order_id, params.from_status, params.to_status, now, params.changed_by ?? null]
  );
  const row = await db.getFirstAsync<StatusHistoryRow>('SELECT * FROM status_history WHERE id=?;', [id]);
  if (!row) throw new Error('Failed to insert status history');
  return row;
}
