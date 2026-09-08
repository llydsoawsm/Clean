import { getDatabase } from '@/db/client';
import { api } from '@/services/api';
import { nowIso } from '@/utils/dates';

interface PushResult {
  synced: number;
  failed: number;
  results: Record<string, any[]>;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function collectPending(shopId: string): Promise<{
  customers: any[];
  services: any[];
  orders: any[];
  payments: any[];
  statusHistory: any[];
}> {
  const db = getDatabase();
  const customers = await db.getAllAsync<any>(`SELECT * FROM customers WHERE shop_id=? AND sync_status IN ('PENDING','FAILED');`, [shopId]);
  const services = await db.getAllAsync<any>(`SELECT * FROM services WHERE shop_id=? AND sync_status IN ('PENDING','FAILED');`, [shopId]);
  const orders = await db.getAllAsync<any>(`SELECT * FROM orders WHERE shop_id=? AND sync_status IN ('PENDING','FAILED');`, [shopId]);
  const payments = await db.getAllAsync<any>(`SELECT * FROM payments WHERE shop_id=? AND sync_status IN ('PENDING','FAILED');`, [shopId]);
  const statusHistory = await db.getAllAsync<any>(
    `SELECT h.* FROM status_history h JOIN orders o ON h.order_id = o.id WHERE o.shop_id=? AND h.sync_status IN ('PENDING','FAILED');`,
    [shopId]
  );
  return { customers, services, orders, payments, statusHistory };
}

export async function getPendingCount(shopId: string): Promise<number> {
  const { customers, services, orders, payments, statusHistory } = await collectPending(shopId);
  return customers.length + services.length + orders.length + payments.length + statusHistory.length;
}

export async function getPendingBreakdown(shopId: string): Promise<Record<string, number>> {
  const { customers, services, orders, payments, statusHistory } = await collectPending(shopId);
  return {
    customers: customers.length,
    services: services.length,
    orders: orders.length,
    payments: payments.length,
    statusHistory: statusHistory.length,
    total: customers.length + services.length + orders.length + payments.length + statusHistory.length,
  };
}

export async function pushPending(shopId: string, token: string, batchSize = 50): Promise<PushResult> {
  const pending = await collectPending(shopId);
  const total = pending.customers.length + pending.services.length + pending.orders.length + pending.payments.length + pending.statusHistory.length;
  if (total === 0) return { synced: 0, failed: 0, results: { customers: [], services: [], orders: [], payments: [], statusHistory: [] } };

  // Mark as SYNCING to avoid stuck PENDING, but handle crash by resetting SYNCING to PENDING on next run
  const db = getDatabase();
  const allIds = {
    customers: pending.customers.map((c) => c.id),
    services: pending.services.map((s) => s.id),
    orders: pending.orders.map((o) => o.id),
    payments: pending.payments.map((p) => p.id),
    statusHistory: pending.statusHistory.map((h) => h.id),
  };
  // Set to SYNCING
  const markSyncing = async (table: string, ids: string[]) => {
    if (ids.length === 0) return;
    const placeholders = ids.map(() => '?').join(',');
    await db.runAsync(`UPDATE ${table} SET sync_status='SYNCING' WHERE id IN (${placeholders});`, ids as any);
  };
  await markSyncing('customers', allIds.customers);
  await markSyncing('services', allIds.services);
  await markSyncing('orders', allIds.orders);
  await markSyncing('payments', allIds.payments);
  await markSyncing('status_history', allIds.statusHistory);

  let synced = 0;
  let failed = 0;
  const allResults: Record<string, any[]> = { customers: [], services: [], orders: [], payments: [], statusHistory: [] };

  // Dependency order: customers → services → orders → payments → statusHistory
  // Batch per entity type
  const batches = [
    { key: 'customers', data: pending.customers },
    { key: 'services', data: pending.services },
    { key: 'orders', data: pending.orders },
    { key: 'payments', data: pending.payments },
    { key: 'statusHistory', data: pending.statusHistory },
  ] as const;

  for (const batch of batches) {
    if (batch.data.length === 0) continue;
    const chunks = chunk(batch.data, batchSize);
    for (const c of chunks) {
      try {
        const payload: Record<string, any[]> = {};
        // Map to expected server keys
        if (batch.key === 'customers') payload.customers = c.map((x) => ({
          id: x.id, shop_id: x.shop_id, name: x.name, contact_number: x.contact_number, address: x.address, notes: x.notes, created_at: x.created_at, updated_at: x.updated_at, is_deleted: x.is_deleted,
        }));
        if (batch.key === 'services') payload.services = c.map((x) => ({
          id: x.id, shop_id: x.shop_id, service_name: x.name, pricing_type: x.pricing_type, price_centavos: x.unit_price_centavos, description: x.description, weight_block_grams: x.weight_block_grams, is_active: x.is_active, created_at: x.created_at, updated_at: x.updated_at, is_deleted: x.is_deleted,
        }));
        if (batch.key === 'orders') payload.orders = c.map((x) => ({
          id: x.id, shop_id: x.shop_id, customer_id: x.customer_id, service_id: x.service_id, order_number: x.order_number, service_name_snapshot: x.service_name_snapshot, pricing_type_snapshot: x.pricing_type_snapshot, unit_price_snapshot_centavos: x.unit_price_snapshot_centavos, weight_block_snapshot_grams: x.weight_block_grams_snapshot, customer_name_snapshot: x.customer_name_snapshot, weight_grams: x.weight_grams, quantity: x.quantity, base_amount_centavos: x.base_cost_centavos, additional_fee_centavos: x.additional_fee_centavos, rush_fee_centavos: x.rush_fee_centavos, is_rush: x.is_rush, total_amount_centavos: x.total_centavos, amount_paid_centavos: x.amount_paid_centavos, balance_centavos: x.balance_centavos, payment_status: x.payment_status, status: x.status, notes: x.notes, received_at: x.received_at, processing_at: x.processing_at, ready_at: x.ready_at, completed_at: x.completed_at, created_at: x.created_at, updated_at: x.updated_at, is_deleted: x.is_deleted,
        }));
        if (batch.key === 'payments') payload.payments = c.map((x) => ({
          id: x.id, shop_id: x.shop_id, order_id: x.order_id, amount_centavos: x.amount_centavos, method: x.method, reference: x.reference, notes: x.notes, created_at: x.created_at, updated_at: x.updated_at, is_deleted: x.is_deleted,
        }));
        if (batch.key === 'statusHistory') payload.statusHistory = c.map((x) => ({
          id: x.id, order_id: x.order_id, from_status: x.from_status, to_status: x.to_status, changed_at: x.changed_at, changed_by: x.changed_by,
        }));

        const res = await api.syncPush(payload as any, token);
        const results = (res as any).data?.results ?? (res as any).results ?? {};
        // results is per-entity array
        for (const k of ['customers', 'services', 'orders', 'payments', 'statusHistory'] as const) {
          const arr = (results[k] ?? []) as any[];
          for (const r of arr) {
            allResults[k].push(r);
            const id = r.id;
            const table = k === 'statusHistory' ? 'status_history' : k;
            if (r.status === 'synced') {
              synced++;
              await db.runAsync(`UPDATE ${table} SET sync_status='SYNCED', last_synced_at=? WHERE id=?;`, [nowIso(), id] as any);
            } else {
              failed++;
              await db.runAsync(`UPDATE ${table} SET sync_status='FAILED' WHERE id=?;`, [id] as any);
            }
          }
          // If server didn't return for some ids in chunk, mark as FAILED for safety? But we expect all returned
          // For missing, we will keep as SYNCING -> will be reset to PENDING on next sync start
        }
      } catch (e) {
        // Network or server error for this chunk: mark all in chunk as FAILED for retry
        const errMsg = e instanceof Error ? e.message : String(e);
        for (const item of c) {
          failed++;
          allResults[batch.key].push({ id: item.id, status: 'failed', error: errMsg });
          const table = batch.key === 'statusHistory' ? 'status_history' : batch.key;
          await getDatabase().runAsync(`UPDATE ${table} SET sync_status='FAILED' WHERE id=?;`, [item.id] as any);
        }
      }
    }
  }

  // Reset any remaining SYNCING (crash case) back to PENDING for next retry? But we already marked FAILED for failed chunks. For successful chunks, they are SYNCED.
  // Any leftover SYNCING (e.g., if push partially failed and we didn't update) should be reset to PENDING
  await db.runAsync(`UPDATE customers SET sync_status='PENDING' WHERE shop_id=? AND sync_status='SYNCING';`, [shopId] as any);
  await db.runAsync(`UPDATE services SET sync_status='PENDING' WHERE shop_id=? AND sync_status='SYNCING';`, [shopId] as any);
  await db.runAsync(`UPDATE orders SET sync_status='PENDING' WHERE shop_id=? AND sync_status='SYNCING';`, [shopId] as any);
  await db.runAsync(`UPDATE payments SET sync_status='PENDING' WHERE shop_id=? AND sync_status='SYNCING';`, [shopId] as any);
  await db.runAsync(`UPDATE status_history SET sync_status='PENDING' WHERE sync_status='SYNCING' AND order_id IN (SELECT id FROM orders WHERE shop_id=?);`, [shopId] as any);

  return { synced, failed, results: allResults };
}
