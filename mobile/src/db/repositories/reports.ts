/**
 * Reports repository — read-only, offline-first, shop-scoped.
 * Aggregates from local SQLite without mutating business records.
 * Money in centavos, dates ISO8601 UTC, grouping via localtime for shop-local daily trend.
 */
import { getDatabase } from '../client';

export type DateRangeKey = 'today' | '7days' | 'month' | 'all' | 'custom';

export interface DateRange {
  key: DateRangeKey;
  fromIso: string | null;
  toIso: string | null;
  label: string;
}

export function getDateRange(key: DateRangeKey, customFrom?: string | null, customTo?: string | null): DateRange {
  const now = new Date();
  if (key === 'today') {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    return { key, fromIso: start.toISOString(), toIso: end.toISOString(), label: 'Today' };
  }
  if (key === '7days') {
    const start = new Date(now);
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    return { key, fromIso: start.toISOString(), toIso: end.toISOString(), label: 'Last 7 Days' };
  }
  if (key === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    return { key, fromIso: start.toISOString(), toIso: end.toISOString(), label: 'This Month' };
  }
  if (key === 'custom' && customFrom && customTo) {
    return { key, fromIso: new Date(customFrom).toISOString(), toIso: new Date(customTo).toISOString(), label: `${new Date(customFrom).toLocaleDateString()} - ${new Date(customTo).toLocaleDateString()}` };
  }
  return { key: 'all', fromIso: null, toIso: null, label: 'All Time' };
}

export interface ReportSummary {
  collections: number; // payments in range
  orderValue: number; // sum total for orders received in range
  outstandingBalance: number; // overall sum balance (shop total, not range) — also provide rangeOutstanding for orders in range?
  totalOrders: number; // orders received in range
  averageOrderValue: number; // orderValue / totalOrders (0 if none)
  orderStatuses: Record<string, number>; // RECEIVED|PROCESSING|READY|COMPLETED for orders in range (current status)
  paymentStatuses: Record<string, number>; // UNPAID|PARTIAL|PAID for orders in range
}

export async function getReportSummary(shopId: string | null, range: DateRange): Promise<ReportSummary> {
  const db = getDatabase();
  // Build order filter by received_at
  const orderWhere: string[] = ['is_deleted=0', '(shop_id IS ? OR shop_id = ?)'];
  const orderArgs: unknown[] = [shopId, shopId];
  if (range.fromIso) {
    orderWhere.push('received_at >= ?');
    orderArgs.push(range.fromIso);
  }
  if (range.toIso) {
    orderWhere.push('received_at <= ?');
    orderArgs.push(range.toIso);
  }
  const orderWhereSql = orderWhere.join(' AND ');

  // Order value + count for range
  const orderAgg = await db.getFirstAsync<{ total: number | null; cnt: number }>(
    `SELECT COALESCE(SUM(total_centavos),0) as total, COUNT(*) as cnt FROM orders WHERE ${orderWhereSql};`,
    orderArgs as any
  );
  const orderValue = orderAgg?.total ?? 0;
  const totalOrders = orderAgg?.cnt ?? 0;
  const averageOrderValue = totalOrders > 0 ? Math.round(orderValue / totalOrders) : 0;

  // Outstanding overall (not just range) — as per Payments spec: sum remaining balances for shop orders
  const outstandingRow = await db.getFirstAsync<{ total: number | null }>(
    `SELECT COALESCE(SUM(balance_centavos),0) as total FROM orders WHERE is_deleted=0 AND (shop_id IS ? OR shop_id = ?);`,
    [shopId, shopId] as any
  );
  const outstandingBalance = outstandingRow?.total ?? 0;

  // Collections for range: sum payments created_at in range
  const payWhere: string[] = ['is_deleted=0', '(shop_id IS ? OR shop_id = ?)'];
  const payArgs: unknown[] = [shopId, shopId];
  if (range.fromIso) {
    payWhere.push('created_at >= ?');
    payArgs.push(range.fromIso);
  }
  if (range.toIso) {
    payWhere.push('created_at <= ?');
    payArgs.push(range.toIso);
  }
  const payWhereSql = payWhere.join(' AND ');
  const payAgg = await db.getFirstAsync<{ total: number | null }>(
    `SELECT COALESCE(SUM(amount_centavos),0) as total FROM payments WHERE ${payWhereSql};`,
    payArgs as any
  );
  const collections = payAgg?.total ?? 0;

  // Order statuses for orders in range
  const statusRows = await db.getAllAsync<{ status: string; cnt: number }>(
    `SELECT status, COUNT(*) as cnt FROM orders WHERE ${orderWhereSql} GROUP BY status;`,
    orderArgs as any
  );
  const orderStatuses: Record<string, number> = { RECEIVED: 0, PROCESSING: 0, READY: 0, COMPLETED: 0 };
  for (const r of statusRows) orderStatuses[r.status] = r.cnt;

  // Payment statuses for orders in range
  const payStatusRows = await db.getAllAsync<{ payment_status: string; cnt: number }>(
    `SELECT payment_status, COUNT(*) as cnt FROM orders WHERE ${orderWhereSql} GROUP BY payment_status;`,
    orderArgs as any
  );
  const paymentStatuses: Record<string, number> = { UNPAID: 0, PARTIAL: 0, PAID: 0 };
  for (const r of payStatusRows) (paymentStatuses as any)[r.payment_status] = r.cnt;

  return { collections, orderValue, outstandingBalance, totalOrders, averageOrderValue, orderStatuses, paymentStatuses };
}

export async function getTopServices(shopId: string | null, range: DateRange, limit = 5): Promise<{ service_name: string; order_count: number; order_value: number }[]> {
  const db = getDatabase();
  const where: string[] = ['is_deleted=0', '(shop_id IS ? OR shop_id = ?)'];
  const args: unknown[] = [shopId, shopId];
  if (range.fromIso) {
    where.push('received_at >= ?');
    args.push(range.fromIso);
  }
  if (range.toIso) {
    where.push('received_at <= ?');
    args.push(range.toIso);
  }
  const whereSql = where.join(' AND ');
  return await db.getAllAsync<any>(
    `SELECT service_name_snapshot as service_name, COUNT(*) as order_count, COALESCE(SUM(total_centavos),0) as order_value
     FROM orders WHERE ${whereSql}
     GROUP BY service_name_snapshot
     ORDER BY order_count DESC LIMIT ?;`,
    [...args, limit] as any
  );
}

export async function getTopCustomers(shopId: string | null, range: DateRange, limit = 5): Promise<{ customer_id: string; customer_name: string; order_count: number; order_value: number }[]> {
  const db = getDatabase();
  const where: string[] = ['o.is_deleted=0', '(o.shop_id IS ? OR o.shop_id = ?)'];
  const args: unknown[] = [shopId, shopId];
  if (range.fromIso) {
    where.push('o.received_at >= ?');
    args.push(range.fromIso);
  }
  if (range.toIso) {
    where.push('o.received_at <= ?');
    args.push(range.toIso);
  }
  const whereSql = where.join(' AND ');
  return await db.getAllAsync<any>(
    `SELECT o.customer_id, o.customer_name_snapshot as customer_name, COUNT(*) as order_count, COALESCE(SUM(o.total_centavos),0) as order_value
     FROM orders o WHERE ${whereSql}
     GROUP BY o.customer_id, o.customer_name_snapshot
     ORDER BY order_count DESC LIMIT ?;`,
    [...args, limit] as any
  );
}

export async function getPaymentMethodBreakdown(shopId: string | null, range: DateRange): Promise<{ method: string; total: number; count: number }[]> {
  const db = getDatabase();
  const where: string[] = ['is_deleted=0', '(shop_id IS ? OR shop_id = ?)'];
  const args: unknown[] = [shopId, shopId];
  if (range.fromIso) {
    where.push('created_at >= ?');
    args.push(range.fromIso);
  }
  if (range.toIso) {
    where.push('created_at <= ?');
    args.push(range.toIso);
  }
  const whereSql = where.join(' AND ');
  const rows = await db.getAllAsync<any>(
    `SELECT LOWER(method) as method, COALESCE(SUM(amount_centavos),0) as total, COUNT(*) as count
     FROM payments WHERE ${whereSql}
     GROUP BY LOWER(method);`,
    args as any
  );
  // Normalize legacy/unknown
  return rows.map((r: any) => ({
    method: r.method || 'unknown',
    total: r.total,
    count: r.count,
  }));
}

// Daily trend: collections per day + order count per day for range
export async function getDailyTrends(shopId: string | null, range: DateRange): Promise<{ date: string; collections: number; orderCount: number; orderValue: number }[]> {
  const db = getDatabase();
  // If all time, limit to last 14 days for readability
  let from = range.fromIso ? new Date(range.fromIso) : null;
  let to = range.toIso ? new Date(range.toIso) : new Date();
  if (!from) {
    from = new Date(to);
    from.setDate(from.getDate() - 13);
    from.setHours(0, 0, 0, 0);
  }
  to = new Date(to);
  to.setHours(23, 59, 59, 999);

  // Use localtime grouping: DATE(created_at, 'localtime') for shop-local
  const payWhere: string[] = ['is_deleted=0', '(shop_id IS ? OR shop_id = ?)'];
  const payArgs: unknown[] = [shopId, shopId, from.toISOString(), to.toISOString()];
  const payRows = await db.getAllAsync<{ d: string; total: number }>(
    `SELECT DATE(created_at, 'localtime') as d, COALESCE(SUM(amount_centavos),0) as total
     FROM payments WHERE is_deleted=0 AND (shop_id IS ? OR shop_id = ?) AND created_at >= ? AND created_at <= ?
     GROUP BY DATE(created_at, 'localtime')
     ORDER BY d;`,
    payArgs as any
  );
  const orderRows = await db.getAllAsync<{ d: string; cnt: number; total: number }>(
    `SELECT DATE(received_at, 'localtime') as d, COUNT(*) as cnt, COALESCE(SUM(total_centavos),0) as total
     FROM orders WHERE is_deleted=0 AND (shop_id IS ? OR shop_id = ?) AND received_at >= ? AND received_at <= ?
     GROUP BY DATE(received_at, 'localtime')
     ORDER BY d;`,
    [shopId, shopId, from.toISOString(), to.toISOString()] as any
  );

  const payMap = new Map<string, number>();
  for (const r of payRows) payMap.set(r.d, r.total);
  const orderMap = new Map<string, { cnt: number; total: number }>();
  for (const r of orderRows) orderMap.set(r.d, { cnt: r.cnt, total: r.total });

  // Build date array from from to to inclusive
  const result: { date: string; collections: number; orderCount: number; orderValue: number }[] = [];
  const cur = new Date(from);
  cur.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(0, 0, 0, 0);
  while (cur <= end) {
    const isoDate = cur.toISOString().slice(0, 10); // YYYY-MM-DD
    // Need local date key: use same localtime logic as SQLite DATE(..., 'localtime')
    // For JS, compute local date string via local
    const localKey = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`;
    result.push({
      date: localKey,
      collections: payMap.get(localKey) ?? 0,
      orderCount: orderMap.get(localKey)?.cnt ?? 0,
      orderValue: orderMap.get(localKey)?.total ?? 0,
    });
    cur.setDate(cur.getDate() + 1);
  }
  return result;
}
