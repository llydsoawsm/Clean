/**
 * Payments repository — append-only, offline-first, Phase 7.
 */
import { getDatabase } from '../client';
import type { PaymentRow, PaymentStatus } from '../types';
import { uuidv4 } from '@/utils/uuid';
import { nowIso } from '@/utils/dates';
import { recalcOrderPayment } from './orders';

type PaymentMethodInput = string | undefined;

function normalizeMethod(input: PaymentMethodInput): string {
  const m = (input ?? 'CASH').trim().toUpperCase();
  if (['CASH', 'GCASH', 'OTHER'].includes(m)) return m.toLowerCase();
  return 'cash';
}

export function displayMethod(method: string | null | undefined): string {
  const m = (method ?? 'cash').toLowerCase();
  if (m === 'gcash') return 'GCash';
  if (m === 'other') return 'Other';
  if (m === 'cash') return 'Cash';
  return m ? m.charAt(0).toUpperCase() + m.slice(1) : 'Unknown';
}

export async function addPayment(params: {
  order_id: string;
  shop_id?: string | null;
  amount_centavos: number;
  method?: string;
  reference?: string | null;
  notes?: string | null;
}): Promise<PaymentRow> {
  if (params.amount_centavos <= 0) throw new Error('Amount must be >0');
  const db = getDatabase();
  const order = await db.getFirstAsync<{ total_centavos: number; balance_centavos: number; shop_id: string | null }>(
    'SELECT total_centavos, balance_centavos, shop_id FROM orders WHERE id=? AND is_deleted=0;',
    [params.order_id]
  );
  if (!order) throw new Error('Order not found');
  // shop scoping: if shop_id provided, verify order belongs to shop
  if (params.shop_id && order.shop_id && order.shop_id !== params.shop_id) {
    throw new Error('Order does not belong to this shop');
  }
  if (order.shop_id && params.shop_id && order.shop_id !== params.shop_id) {
    throw new Error('Order does not belong to this shop');
  }
  if (order.balance_centavos <= 0) throw new Error('This order is already fully paid.');
  if (params.amount_centavos > order.balance_centavos) {
    throw new Error(`Payment ₱${(params.amount_centavos / 100).toFixed(2)} exceeds balance ₱${(order.balance_centavos / 100).toFixed(2)}`);
  }

  const method = normalizeMethod(params.method);
  const reference = params.reference?.trim() ? params.reference.trim().slice(0, 100) : null;
  const notes = params.notes?.trim() ? params.notes.trim().slice(0, 500) : null;

  const id = uuidv4();
  const now = nowIso();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO payments (id, order_id, shop_id, amount_centavos, method, reference, notes, created_at, updated_at, sync_status, last_synced_at, is_deleted)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', NULL, 0);`,
      [id, params.order_id, params.shop_id ?? null, params.amount_centavos, method, reference, notes, now, now]
    );
    await recalcOrderPayment(params.order_id);
  });

  const row = await db.getFirstAsync<PaymentRow>('SELECT * FROM payments WHERE id=?;', [id]);
  if (!row) throw new Error('Failed to create payment');
  return row;
}

export async function listPaymentsByOrder(orderId: string): Promise<PaymentRow[]> {
  const db = getDatabase();
  return await db.getAllAsync<PaymentRow>('SELECT * FROM payments WHERE order_id=? AND is_deleted=0 ORDER BY created_at ASC;', [orderId]);
}

export async function getPaymentById(id: string): Promise<PaymentRow | null> {
  const db = getDatabase();
  return (await db.getFirstAsync<PaymentRow>('SELECT * FROM payments WHERE id=? AND is_deleted=0;', [id])) ?? null;
}

export async function getPaymentWithOrder(id: string): Promise<(PaymentRow & { order_number: string; customer_name: string | null }) | null> {
  const db = getDatabase();
  return (await db.getFirstAsync<any>(
    `SELECT p.*, o.order_number as order_number, o.customer_name_snapshot as customer_name
     FROM payments p JOIN orders o ON p.order_id = o.id
     WHERE p.id=? AND p.is_deleted=0;`,
    [id]
  )) ?? null;
}

export async function listPayments(params?: {
  shop_id?: string | null;
  status?: PaymentStatus; // filter by order payment_status
  search?: string;
  dateFilter?: 'today' | '7days' | 'month' | 'all';
  from?: string | null;
  to?: string | null;
  orderId?: string;
  limit?: number;
}): Promise<(PaymentRow & { order_number: string; customer_name: string | null; order_total: number; order_balance: number; order_payment_status: PaymentStatus })[]> {
  const db = getDatabase();
  const clauses: string[] = ['p.is_deleted=0'];
  const args: unknown[] = [];

  if (params?.shop_id !== undefined) {
    clauses.push('(p.shop_id IS ? OR p.shop_id = ?)');
    args.push(params.shop_id, params.shop_id);
  }
  if (params?.status) {
    clauses.push('o.payment_status=?');
    args.push(params.status);
  }
  if (params?.orderId) {
    clauses.push('p.order_id=?');
    args.push(params.orderId);
  }

  // Date filters: based on p.created_at
  let fromIso: string | null = params?.from ?? null;
  let toIso: string | null = params?.to ?? null;
  if (params?.dateFilter === 'today') {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    fromIso = start.toISOString();
    toIso = end.toISOString();
  } else if (params?.dateFilter === '7days') {
    const start = new Date();
    start.setDate(start.getDate() - 7);
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    fromIso = start.toISOString();
    toIso = end.toISOString();
  } else if (params?.dateFilter === 'month') {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    fromIso = start.toISOString();
    toIso = end.toISOString();
  }
  if (fromIso) {
    clauses.push('p.created_at >= ?');
    args.push(fromIso);
  }
  if (toIso) {
    clauses.push('p.created_at <= ?');
    args.push(toIso);
  }

  if (params?.search) {
    const q = `%${params.search}%`;
    clauses.push(`(o.order_number LIKE ? OR o.customer_name_snapshot LIKE ? OR p.reference LIKE ? OR p.notes LIKE ? OR p.order_id IN (SELECT id FROM orders WHERE customer_id IN (SELECT id FROM customers WHERE contact_number LIKE ?)))`);
    args.push(q, q, q, q, q);
  }

  const limit = params?.limit ?? 50;
  const where = clauses.join(' AND ');
  return await db.getAllAsync<any>(
    `SELECT p.*, o.order_number as order_number, o.customer_name_snapshot as customer_name, o.total_centavos as order_total, o.balance_centavos as order_balance, o.payment_status as order_payment_status
     FROM payments p JOIN orders o ON p.order_id = o.id
     WHERE ${where}
     ORDER BY p.created_at DESC LIMIT ?;`,
    [...args, limit] as any
  );
}

export async function getPendingPayments(): Promise<PaymentRow[]> {
  const db = getDatabase();
  return await db.getAllAsync<PaymentRow>(`SELECT * FROM payments WHERE sync_status IN ('PENDING','FAILED') AND is_deleted=0;`);
}

// Summary helpers

export async function getOutstandingBalance(shopId: string | null): Promise<number> {
  const db = getDatabase();
  const row = await db.getFirstAsync<{ total: number | null }>(
    `SELECT COALESCE(SUM(balance_centavos),0) as total FROM orders WHERE is_deleted=0 AND (shop_id IS ? OR shop_id = ?);`,
    [shopId, shopId] as any
  );
  return row?.total ?? 0;
}

export async function getDailyCollections(shopId: string | null, date?: Date): Promise<number> {
  const d = date ?? new Date();
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  const end = new Date(d);
  end.setHours(23, 59, 59, 999);
  const db = getDatabase();
  const row = await db.getFirstAsync<{ total: number | null }>(
    `SELECT COALESCE(SUM(amount_centavos),0) as total FROM payments WHERE is_deleted=0 AND (shop_id IS ? OR shop_id = ?) AND created_at >= ? AND created_at <= ?;`,
    [shopId, shopId, start.toISOString(), end.toISOString()] as any
  );
  return row?.total ?? 0;
}

export async function getCollectionsForRange(shopId: string | null, fromIso: string, toIso: string): Promise<number> {
  const db = getDatabase();
  const row = await db.getFirstAsync<{ total: number | null }>(
    `SELECT COALESCE(SUM(amount_centavos),0) as total FROM payments WHERE is_deleted=0 AND (shop_id IS ? OR shop_id = ?) AND created_at >= ? AND created_at <= ?;`,
    [shopId, shopId, fromIso, toIso] as any
  );
  return row?.total ?? 0;
}

export async function getPaymentSummary(shopId: string | null): Promise<{
  collectedToday: number;
  collectedThisWeek: number;
  collectedThisMonth: number;
  outstandingBalance: number;
  unpaidOrders: number;
  partialOrders: number;
  paidOrders: number;
}> {
  const db = getDatabase();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 7);
  weekStart.setHours(0, 0, 0, 0);
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [today, week, month, outstanding] = await Promise.all([
    getCollectionsForRange(shopId, todayStart.toISOString(), todayEnd.toISOString()),
    getCollectionsForRange(shopId, weekStart.toISOString(), todayEnd.toISOString()),
    getCollectionsForRange(shopId, monthStart.toISOString(), todayEnd.toISOString()),
    getOutstandingBalance(shopId),
  ]);

  const statusRows = await db.getAllAsync<{ payment_status: PaymentStatus; cnt: number }>(
    `SELECT payment_status, COUNT(*) as cnt FROM orders WHERE is_deleted=0 AND (shop_id IS ? OR shop_id = ?) GROUP BY payment_status;`,
    [shopId, shopId] as any
  );
  const counts: Record<string, number> = { UNPAID: 0, PARTIAL: 0, PAID: 0 };
  for (const r of statusRows) counts[r.payment_status] = r.cnt;

  return {
    collectedToday: today,
    collectedThisWeek: week,
    collectedThisMonth: month,
    outstandingBalance: outstanding,
    unpaidOrders: counts.UNPAID ?? 0,
    partialOrders: counts.PARTIAL ?? 0,
    paidOrders: counts.PAID ?? 0,
  };
}

// For order balance list (orders with balance)
export async function listOrdersWithBalance(params?: {
  shop_id?: string | null;
  payment_status?: PaymentStatus;
  search?: string;
  limit?: number;
}): Promise<import('../types').OrderRow[]> {
  const db = getDatabase();
  const clauses: string[] = ['is_deleted=0', 'balance_centavos > 0'];
  const args: unknown[] = [];
  if (params?.shop_id !== undefined) {
    clauses.push('(shop_id IS ? OR shop_id = ?)');
    args.push(params.shop_id, params.shop_id);
  }
  if (params?.payment_status) {
    clauses.push('payment_status=?');
    args.push(params.payment_status);
  }
  if (params?.search) {
    const q = `%${params.search}%`;
    clauses.push('(order_number LIKE ? OR customer_name_snapshot LIKE ? OR notes LIKE ? OR customer_id IN (SELECT id FROM customers WHERE contact_number LIKE ?))');
    args.push(q, q, q, q);
  }
  const limit = params?.limit ?? 50;
  const where = clauses.join(' AND ');
  return await db.getAllAsync<any>(`SELECT * FROM orders WHERE ${where} ORDER BY balance_centavos DESC LIMIT ?;`, [...args, limit] as any);
}
