import { getDatabase } from '@/db/client';
import { api } from '@/services/api';
import { nowIso } from '@/utils/dates';
import { getLastSyncCursor, setLastSync } from './cursor';

export interface PullResult {
  pulled: number;
  nextCursor: string | null;
}

export async function pullServerChanges(shopId: string, token: string): Promise<PullResult> {
  const db = getDatabase();
  const since = (await getLastSyncCursor(shopId)) ?? new Date(0).toISOString();
  const res = await api.syncPull(since, token);
  const data = (res as any).data ?? (res as any);
  const customers: any[] = data.customers ?? [];
  const services: any[] = data.services ?? [];
  const orders: any[] = data.orders ?? [];
  const payments: any[] = data.payments ?? [];
  const statusHistory: any[] = data.statusHistory ?? data.status_history ?? [];

  let pulled = 0;

  await db.withTransactionAsync(async () => {
    for (const c of customers) {
      if (c.shop_id !== shopId) continue;
      const existing = await db.getFirstAsync<any>('SELECT * FROM customers WHERE id=?;', [c.id]);
      if (existing) {
        if (new Date(c.updated_at).getTime() > new Date(existing.updated_at).getTime()) {
          await db.runAsync(
            `UPDATE customers SET name=?, contact_number=?, address=?, notes=?, updated_at=?, sync_status='SYNCED', last_synced_at=?, is_deleted=? WHERE id=?;`,
            [c.name, c.contact_number, c.address ?? null, c.notes ?? null, c.updated_at, nowIso(), c.is_deleted ? 1 : 0, c.id] as any
          );
          pulled++;
        } else {
          await db.runAsync(`UPDATE customers SET sync_status='SYNCED', last_synced_at=? WHERE id=?;`, [nowIso(), c.id] as any);
        }
      } else {
        await db.runAsync(
          `INSERT INTO customers (id, shop_id, name, contact_number, address, notes, first_transaction_at, last_visit_at, transaction_count, created_at, updated_at, sync_status, last_synced_at, is_deleted)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'SYNCED', ?, ?)
           ON CONFLICT(id) DO UPDATE SET name=excluded.name, contact_number=excluded.contact_number, address=excluded.address, notes=excluded.notes, updated_at=excluded.updated_at, sync_status='SYNCED', last_synced_at=excluded.last_synced_at, is_deleted=excluded.is_deleted;`,
          [c.id, c.shop_id, c.name, c.contact_number, c.address ?? null, c.notes ?? null, c.created_at ?? c.updated_at, c.updated_at, 0, c.created_at ?? c.updated_at, c.updated_at, nowIso(), c.is_deleted ? 1 : 0] as any
        );
        pulled++;
      }
    }

    for (const s of services) {
      if (s.shop_id !== shopId) continue;
      const existing = await db.getFirstAsync<any>('SELECT * FROM services WHERE id=?;', [s.id]);
      const pricingType = String(s.pricing_type ?? 'FIXED').toLowerCase();
      const unitPrice = Number(s.price_centavos ?? 0);
      const name = String(s.service_name ?? s.name ?? '').trim();
      if (existing) {
        if (new Date(s.updated_at).getTime() > new Date(existing.updated_at).getTime()) {
          await db.runAsync(
            `UPDATE services SET name=?, pricing_type=?, unit_price_centavos=?, description=?, weight_block_grams=?, is_active=?, updated_at=?, sync_status='SYNCED', last_synced_at=?, is_deleted=? WHERE id=?;`,
            [name, pricingType, unitPrice, s.description ?? null, s.weight_block_grams ?? null, s.is_active !== undefined ? (s.is_active ? 1 : 0) : 1, s.updated_at, nowIso(), s.is_deleted ? 1 : 0, s.id] as any
          );
          pulled++;
        } else {
          await db.runAsync(`UPDATE services SET sync_status='SYNCED', last_synced_at=? WHERE id=?;`, [nowIso(), s.id] as any);
        }
      } else {
        await db.runAsync(
          `INSERT INTO services (id, shop_id, name, pricing_type, unit_price_centavos, description, weight_block_grams, is_active, created_at, updated_at, sync_status, last_synced_at, is_deleted)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'SYNCED', ?, ?)
           ON CONFLICT(id) DO UPDATE SET name=excluded.name, pricing_type=excluded.pricing_type, unit_price_centavos=excluded.unit_price_centavos, description=excluded.description, weight_block_grams=excluded.weight_block_grams, is_active=excluded.is_active, updated_at=excluded.updated_at, sync_status='SYNCED', last_synced_at=excluded.last_synced_at, is_deleted=excluded.is_deleted;`,
          [s.id, s.shop_id, name, pricingType, unitPrice, s.description ?? null, s.weight_block_grams ?? null, s.is_active !== undefined ? (s.is_active ? 1 : 0) : 1, s.created_at ?? s.updated_at, s.updated_at, nowIso(), s.is_deleted ? 1 : 0] as any
        );
        pulled++;
      }
    }

    for (const o of orders) {
      if (o.shop_id !== shopId) continue;
      const existing = await db.getFirstAsync<any>('SELECT * FROM orders WHERE id=?;', [o.id]);
      if (existing) {
        if (new Date(o.updated_at).getTime() > new Date(existing.updated_at).getTime()) {
          await db.runAsync(
            `UPDATE orders SET status=?, payment_status=?, amount_paid_centavos=?, balance_centavos=?, notes=?, processing_at=?, ready_at=?, completed_at=?, updated_at=?, sync_status='SYNCED', last_synced_at=?, is_deleted=? WHERE id=?;`,
            [
              o.status ?? existing.status,
              o.payment_status ?? existing.payment_status,
              o.amount_paid_centavos ?? existing.amount_paid_centavos,
              o.balance_centavos ?? existing.balance_centavos,
              o.notes ?? existing.notes,
              o.processing_at ?? existing.processing_at,
              o.ready_at ?? existing.ready_at,
              o.completed_at ?? existing.completed_at,
              o.updated_at,
              nowIso(),
              o.is_deleted ? 1 : 0,
              o.id,
            ] as any
          );
          pulled++;
        } else {
          await db.runAsync(`UPDATE orders SET sync_status='SYNCED', last_synced_at=? WHERE id=?;`, [nowIso(), o.id] as any);
        }
      } else {
        try {
          await db.runAsync(
            `INSERT INTO orders (id, shop_id, customer_id, service_id, order_number, pricing_type_snapshot, service_name_snapshot, unit_price_snapshot_centavos, weight_block_grams_snapshot, customer_name_snapshot, weight_grams, quantity, base_cost_centavos, additional_fee_centavos, rush_fee_centavos, is_rush, total_centavos, amount_paid_centavos, balance_centavos, payment_status, status, notes, estimated_ready_at, received_at, processing_at, ready_at, completed_at, created_at, updated_at, sync_status, last_synced_at, is_deleted)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'SYNCED', ?, ?)
             ON CONFLICT(id) DO UPDATE SET status=excluded.status, payment_status=excluded.payment_status, amount_paid_centavos=excluded.amount_paid_centavos, balance_centavos=excluded.balance_centavos, notes=excluded.notes, processing_at=excluded.processing_at, ready_at=excluded.ready_at, completed_at=excluded.completed_at, updated_at=excluded.updated_at, sync_status='SYNCED', last_synced_at=excluded.last_synced_at, is_deleted=excluded.is_deleted;`,
            [
              o.id, o.shop_id, o.customer_id, o.service_id, o.order_number, String(o.pricing_type_snapshot ?? 'FIXED').toLowerCase(), o.service_name_snapshot, Number(o.unit_price_snapshot_centavos ?? 0), o.weight_block_snapshot_grams ?? o.weight_block_grams_snapshot ?? null, o.customer_name_snapshot ?? null, o.weight_grams ?? null, o.quantity ?? null, Number(o.base_amount_centavos ?? o.base_cost_centavos ?? 0), Number(o.additional_fee_centavos ?? 0), Number(o.rush_fee_centavos ?? 0), o.is_rush ? 1 : 0, Number(o.total_amount_centavos ?? o.total_centavos ?? 0), Number(o.amount_paid_centavos ?? 0), Number(o.balance_centavos ?? 0), String(o.payment_status ?? 'UNPAID').toUpperCase(), String(o.status ?? 'RECEIVED').toUpperCase(), o.notes ?? null, o.estimated_ready_at ?? null, o.received_at ?? o.created_at ?? nowIso(), o.processing_at ?? null, o.ready_at ?? null, o.completed_at ?? null, o.created_at ?? o.updated_at ?? nowIso(), o.updated_at ?? nowIso(), nowIso(), o.is_deleted ? 1 : 0,
            ] as any
          );
          pulled++;
        } catch (e) {
          console.warn('[Sync Pull] order insert failed', o.id, e);
        }
      }
    }

    for (const p of payments) {
      if (p.shop_id !== shopId) continue;
      const existing = await db.getFirstAsync<any>('SELECT id FROM payments WHERE id=?;', [p.id]);
      if (existing) {
        await db.runAsync(`UPDATE payments SET sync_status='SYNCED', last_synced_at=? WHERE id=?;`, [nowIso(), p.id] as any);
        continue;
      }
      const orderExists = await db.getFirstAsync<any>('SELECT id FROM orders WHERE id=?;', [p.order_id]);
      if (!orderExists) {
        console.warn('[Sync Pull] payment skipped, order not found', p.id, p.order_id);
        continue;
      }
      try {
        await db.runAsync(
          `INSERT INTO payments (id, order_id, shop_id, amount_centavos, method, reference, notes, created_at, updated_at, sync_status, last_synced_at, is_deleted)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'SYNCED', ?, ?)
           ON CONFLICT(id) DO NOTHING;`,
          [p.id, p.order_id, p.shop_id, Number(p.amount_centavos), String(p.method ?? 'cash').toLowerCase(), p.reference ?? null, p.notes ?? null, p.created_at ?? nowIso(), p.updated_at ?? p.created_at ?? nowIso(), nowIso(), p.is_deleted ? 1 : 0] as any
        );
        const sumRow = await db.getFirstAsync<{ total: number | null }>('SELECT COALESCE(SUM(amount_centavos),0) as total FROM payments WHERE order_id=? AND is_deleted=0;', [p.order_id]);
        const paid = sumRow?.total ?? 0;
        const order = await db.getFirstAsync<any>('SELECT total_centavos FROM orders WHERE id=?;', [p.order_id]);
        if (order) {
          const balance = Number(order.total_centavos) - paid;
          let paymentStatus: string = 'UNPAID';
          if (paid <= 0) paymentStatus = 'UNPAID';
          else if (paid >= Number(order.total_centavos)) paymentStatus = 'PAID';
          else paymentStatus = 'PARTIAL';
          await db.runAsync(`UPDATE orders SET amount_paid_centavos=?, balance_centavos=?, payment_status=?, updated_at=?, sync_status='SYNCED', last_synced_at=? WHERE id=?;`, [paid, balance, paymentStatus, nowIso(), nowIso(), p.order_id] as any);
        }
        pulled++;
      } catch (e) {
        console.warn('[Sync Pull] payment insert failed', p.id, e);
      }
    }

    for (const h of statusHistory) {
      const existing = await db.getFirstAsync<any>('SELECT id FROM status_history WHERE id=?;', [h.id]);
      if (existing) {
        await db.runAsync(`UPDATE status_history SET sync_status='SYNCED', last_synced_at=? WHERE id=?;`, [nowIso(), h.id] as any);
        continue;
      }
      const orderExists = await db.getFirstAsync<any>('SELECT id FROM orders WHERE id=?;', [h.order_id]);
      if (!orderExists) {
        console.warn('[Sync Pull] status history skipped, order not found', h.id);
        continue;
      }
      try {
        await db.runAsync(
          `INSERT INTO status_history (id, order_id, from_status, to_status, changed_at, changed_by, sync_status, last_synced_at, is_deleted)
           VALUES (?, ?, ?, ?, ?, ?, 'SYNCED', ?, ?)
           ON CONFLICT(id) DO NOTHING;`,
          [h.id, h.order_id, h.from_status ? String(h.from_status).toUpperCase() : null, String(h.to_status).toUpperCase(), h.changed_at ?? nowIso(), h.changed_by ?? null, nowIso(), h.is_deleted ? 1 : 0] as any
        );
        pulled++;
      } catch (e) {
        console.warn('[Sync Pull] status history insert failed', h.id, e);
      }
    }
  });

  const nextCursor = data.nextCursor ?? data.pulledAt ?? nowIso();
  await setLastSync(shopId, nextCursor);
  return { pulled, nextCursor };
}
