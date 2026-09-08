/**
 * Orders repository — central transaction.
 * Handles snapshot preservation, centavo math, status workflow, order_number gen.
 */
import { getDatabase } from '../client';
import type { OrderRow, OrderStatus, PaymentStatus, PricingType } from '../types';
import { uuidv4 } from '@/utils/uuid';
import { nowIso } from '@/utils/dates';
import { calcBaseCost, calcBalance, calcTotal, derivePaymentStatus, formatPHP } from '@/utils/money';

export const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  RECEIVED: ['PROCESSING'],
  PROCESSING: ['READY'],
  READY: ['COMPLETED'],
  COMPLETED: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

function orderNumberForToday(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `CLN-${y}${m}${day}`;
}

async function generateOrderNumber(shopId: string | null, db: ReturnType<typeof getDatabase>): Promise<string> {
  const prefix = orderNumberForToday();
  // count today for this shop to generate sequence
  const row = await db.getFirstAsync<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM orders WHERE order_number LIKE ? AND (shop_id IS ? OR shop_id = ?);`,
    [`${prefix}-%`, shopId, shopId]
  );
  const next = (row?.cnt ?? 0) + 1;
  return `${prefix}-${String(next).padStart(4, '0')}`;
}

export interface CreateOrderInput {
  shop_id?: string | null;
  customer_id: string;
  customer_name_snapshot?: string;
  service_id: string;
  service_name: string;
  pricing_type: PricingType;
  unit_price_centavos: number;
  weight_block_grams?: number | null;
  weight_grams?: number | null;
  quantity?: number | null;
  additional_fee_centavos?: number;
  rush_fee_centavos?: number;
  is_rush?: boolean;
  amount_paid_centavos?: number;
  notes?: string | null;
  estimated_ready_at?: string | null;
}

export async function createOrder(input: CreateOrderInput): Promise<OrderRow> {
  const db = getDatabase();
  if (input.shop_id) {
    const { ensureShopExists } = await import('./shop');
    await ensureShopExists(input.shop_id);
  }
  const id = uuidv4();
  const now = nowIso();

  const additional = input.additional_fee_centavos ?? 0;
  const rush = input.rush_fee_centavos ?? 0;
  if (additional < 0 || rush < 0) throw new Error('Fees cannot be negative');
  const base = calcBaseCost({
    pricingType: input.pricing_type,
    unitPriceCentavos: input.unit_price_centavos,
    weightGrams: input.weight_grams,
    quantity: input.quantity,
    weightBlockGrams: input.weight_block_grams,
  });
  const total = calcTotal(base, additional, rush);
  const paid = input.amount_paid_centavos ?? 0;
  if (paid < 0) throw new Error('Payment cannot be negative');
  if (paid > total) throw new Error('Amount paid cannot exceed total');
  const balance = calcBalance(total, paid);
  const paymentStatus: PaymentStatus = derivePaymentStatus(total, paid);

  // Validation per pricing_type
  if (input.pricing_type === 'per_kg' && (!input.weight_grams || input.weight_grams <= 0)) {
    throw new Error('Weight (grams) required for per_kg service');
  }
  if (input.pricing_type === 'per_load' && (!input.weight_grams || input.weight_grams <= 0)) {
    throw new Error('Weight (grams) required for per_load service');
  }
  if (input.pricing_type === 'per_piece' && (!input.quantity || input.quantity <= 0)) {
    throw new Error('Quantity required for per_piece service');
  }

  // Wrap order + payment + history + customer bump in transaction for atomicity
  await db.withTransactionAsync(async () => {
    const orderNumber = await generateOrderNumber(input.shop_id ?? null, db as any);

    await db.runAsync(
      `INSERT INTO orders (
      id, shop_id, customer_id, service_id, order_number,
      pricing_type_snapshot, service_name_snapshot, unit_price_snapshot_centavos, weight_block_grams_snapshot, customer_name_snapshot,
      weight_grams, quantity, base_cost_centavos, additional_fee_centavos, rush_fee_centavos, is_rush,
      total_centavos, amount_paid_centavos, balance_centavos, payment_status, status, notes, estimated_ready_at,
      received_at, processing_at, ready_at, completed_at, created_at, updated_at, sync_status, last_synced_at, is_deleted
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', NULL, 0);`,
      [
        id,
        input.shop_id ?? null,
        input.customer_id,
        input.service_id,
        orderNumber,
        input.pricing_type,
        input.service_name,
        input.unit_price_centavos,
        input.weight_block_grams ?? null,
        input.customer_name_snapshot ?? null,
        input.weight_grams ?? null,
        input.quantity ?? null,
        base,
        additional,
        rush,
        input.is_rush ? 1 : 0,
        total,
        paid,
        balance,
        paymentStatus,
        'RECEIVED',
        input.notes ?? null,
        input.estimated_ready_at ?? null,
        now, // received_at
        null,
        null,
        null,
        now,
        now,
      ]
    );

    // status_history: RECEIVED
    const histId = uuidv4();
    await db.runAsync(
      `INSERT INTO status_history (id, order_id, from_status, to_status, changed_at, changed_by, sync_status, is_deleted)
     VALUES (?, ?, NULL, 'RECEIVED', ?, NULL, 'PENDING', 0);`,
      [histId, id, now]
    );

    // If paid > 0, create payment row
    if (paid > 0) {
      const payId = uuidv4();
      await db.runAsync(
        `INSERT INTO payments (id, order_id, shop_id, amount_centavos, method, created_at, updated_at, sync_status, last_synced_at, is_deleted)
       VALUES (?, ?, ?, ?, 'cash', ?, ?, 'PENDING', NULL, 0);`,
        [payId, id, input.shop_id ?? null, paid, now, now]
      );
    }

    // bump customer stats (transaction_count, last_visit)
    await db.runAsync(
      `UPDATE customers SET transaction_count = transaction_count + 1, last_visit_at=?, updated_at=?, sync_status='PENDING' WHERE id=?;`,
      [now, now, input.customer_id]
    );
  });

  const row = await db.getFirstAsync<OrderRow>('SELECT * FROM orders WHERE id=?;', [id]);
  if (!row) throw new Error('Failed to create order');
  return row;
}

export async function getOrderById(id: string): Promise<OrderRow | null> {
  const db = getDatabase();
  return (await db.getFirstAsync<OrderRow>('SELECT * FROM orders WHERE id=? AND is_deleted=0;', [id])) ?? null;
}

export async function getOrderByNumber(orderNumber: string, shopId?: string | null): Promise<OrderRow | null> {
  const db = getDatabase();
  if (shopId) {
    return (
      (await db.getFirstAsync<OrderRow>('SELECT * FROM orders WHERE order_number=? AND shop_id=? AND is_deleted=0;', [
        orderNumber,
        shopId,
      ])) ?? null
    );
  }
  return (await db.getFirstAsync<OrderRow>('SELECT * FROM orders WHERE order_number=? AND is_deleted=0;', [orderNumber])) ?? null;
}

export async function listOrders(params?: {
  status?: OrderStatus;
  payment_status?: PaymentStatus;
  shop_id?: string | null;
  customer_id?: string;
  search?: string;
  limit?: number;
}): Promise<OrderRow[]> {
  const db = getDatabase();
  const clauses: string[] = ['is_deleted=0'];
  const args: unknown[] = [];

  if (params?.status) {
    clauses.push('status=?');
    args.push(params.status);
  }
  if (params?.payment_status) {
    clauses.push('payment_status=?');
    args.push(params.payment_status);
  }
  if (params?.shop_id !== undefined) {
    clauses.push('(shop_id IS ? OR shop_id = ?)');
    args.push(params.shop_id, params.shop_id);
  }
  if (params?.customer_id) {
    clauses.push('customer_id=?');
    args.push(params.customer_id);
  }
  if (params?.search) {
    const q = `%${params.search}%`;
    // search order_number, service, customer name, notes, and customer contact via subquery
    clauses.push(
      '(order_number LIKE ? OR service_name_snapshot LIKE ? OR customer_name_snapshot LIKE ? OR notes LIKE ? OR customer_id IN (SELECT id FROM customers WHERE contact_number LIKE ?))'
    );
    args.push(q, q, q, q, q);
  }
  const limit = params?.limit ?? 50;
  const where = clauses.join(' AND ');
  return await db.getAllAsync<OrderRow>(`SELECT * FROM orders WHERE ${where} ORDER BY received_at DESC LIMIT ?;`, [...args, limit] as any);
}

export async function getOrderCounts(shopId: string | null): Promise<Record<string, number>> {
  const db = getDatabase();
  const rows = await db.getAllAsync<{ status: string; cnt: number }>(
    `SELECT status, COUNT(*) as cnt FROM orders WHERE is_deleted=0 AND (shop_id IS ? OR shop_id = ?) GROUP BY status;`,
    [shopId, shopId] as any
  );
  const counts: Record<string, number> = { ALL: 0, RECEIVED: 0, PROCESSING: 0, READY: 0, COMPLETED: 0 };
  for (const r of rows) {
    counts[r.status] = r.cnt;
    counts.ALL += r.cnt;
  }
  return counts;
}

export async function updateOrderStatus(id: string, toStatus: OrderStatus, changedBy?: string | null): Promise<OrderRow> {
  const db = getDatabase();
  const order = await getOrderById(id);
  if (!order) throw new Error('Order not found');
  if (!canTransition(order.status, toStatus)) {
    throw new Error(`Invalid transition ${order.status} -> ${toStatus}`);
  }
  const now = nowIso();
  const fields: string[] = ['status=?', 'updated_at=?', "sync_status='PENDING'"];
  const values: unknown[] = [toStatus, now];

  if (toStatus === 'PROCESSING' && !order.processing_at) {
    fields.push('processing_at=?');
    values.push(now);
  }
  if (toStatus === 'READY') {
    fields.push('ready_at=?');
    values.push(now);
  }
  if (toStatus === 'COMPLETED') {
    if (order.balance_centavos > 0) {
      throw new Error(`Cannot complete: balance ${formatPHP(order.balance_centavos)} remains. Please settle before completing.`);
    }
    fields.push('completed_at=?');
    values.push(now);
  }
  // if revert READY->PROCESSING, clear ready? keep history; don't clear.

  values.push(id);
  await db.withTransactionAsync(async () => {
    await db.runAsync(`UPDATE orders SET ${fields.join(', ')} WHERE id=?;`, values as any);
    const histId = uuidv4();
    await db.runAsync(
      `INSERT INTO status_history (id, order_id, from_status, to_status, changed_at, changed_by, sync_status, is_deleted)
       VALUES (?, ?, ?, ?, ?, ?, 'PENDING', 0);`,
      [histId, id, order.status, toStatus, now, changedBy ?? null]
    );
  });

  const updated = await getOrderById(id);
  if (!updated) throw new Error('Status update failed');
  return updated;
}

/**
 * Recalculate paid/balance after payment insert.
 * Call inside payment creation.
 */
export async function recalcOrderPayment(orderId: string): Promise<OrderRow> {
  const db = getDatabase();
  const sumRow = await db.getFirstAsync<{ total: number }>('SELECT COALESCE(SUM(amount_centavos),0) as total FROM payments WHERE order_id=? AND is_deleted=0;', [orderId]);
  const paid = sumRow?.total ?? 0;
  const order = await getOrderById(orderId);
  if (!order) throw new Error('Order not found for recalc');
  const balance = calcBalance(order.total_centavos, paid);
  const status: PaymentStatus = derivePaymentStatus(order.total_centavos, paid);
  const now = nowIso();
  await db.runAsync(`UPDATE orders SET amount_paid_centavos=?, balance_centavos=?, payment_status=?, updated_at=?, sync_status='PENDING' WHERE id=?;`, [
    paid,
    balance,
    status,
    now,
    orderId,
  ]);
  const updated = await getOrderById(orderId);
  if (!updated) throw new Error('Recalc failed');
  return updated;
}

export async function getPendingOrders(): Promise<OrderRow[]> {
  const db = getDatabase();
  return await db.getAllAsync<OrderRow>(`SELECT * FROM orders WHERE sync_status IN ('PENDING','FAILED');`);
}

export async function deleteOrder(id: string): Promise<void> {
  const db = getDatabase();
  const order = await getOrderById(id);
  if (!order) throw new Error('Order not found');
  // Preserve financial integrity: allow delete only if balance is 0 or status is RECEIVED/COMPLETED with caution
  // For safety, soft-delete via is_deleted; sync will handle tombstone
  const now = nowIso();
  await db.runAsync(`UPDATE orders SET is_deleted=1, updated_at=?, sync_status='PENDING' WHERE id=?;`, [now, id]);
}
