import { Router } from 'express';
import { database } from '../../database/knex';
import { authMiddleware, type AuthenticatedRequest } from '../../middleware/auth';

export const reportsRouter = Router();
reportsRouter.use(authMiddleware);

function parseRange(req: AuthenticatedRequest): { fromIso: string | null; toIso: string | null; label: string } {
  const key = ((req.query.range as string) || (req.query.dateFilter as string) || '').toLowerCase();
  const fromQ = (req.query.from as string | undefined)?.trim();
  const toQ = (req.query.to as string | undefined)?.trim();
  const now = new Date();
  if (key === 'today') {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    return { fromIso: start.toISOString(), toIso: end.toISOString(), label: 'Today' };
  }
  if (key === '7days' || key === 'last7' || key === 'week') {
    const start = new Date(now);
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    return { fromIso: start.toISOString(), toIso: end.toISOString(), label: 'Last 7 Days' };
  }
  if (key === 'month' || key === 'thismonth') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    return { fromIso: start.toISOString(), toIso: end.toISOString(), label: 'This Month' };
  }
  if (fromQ && toQ) {
    return { fromIso: new Date(fromQ).toISOString(), toIso: new Date(toQ).toISOString(), label: `${new Date(fromQ).toLocaleDateString()} - ${new Date(toQ).toLocaleDateString()}` };
  }
  if (fromQ) return { fromIso: new Date(fromQ).toISOString(), toIso: new Date().toISOString(), label: 'Custom' };
  return { fromIso: null, toIso: null, label: 'All Time' };
}

// GET /api/v1/reports/summary?range=today|7days|month|all&from=&to=
reportsRouter.get('/summary', async (req: AuthenticatedRequest, res, next) => {
  try {
    const shopId = req.auth!.shopId;
    const { fromIso, toIso } = parseRange(req);

    // Order value + counts filtered by received_at
    let orderQ = database('orders').where({ shop_id: shopId, is_deleted: 0 });
    if (fromIso) orderQ = orderQ.where('received_at', '>=', fromIso);
    if (toIso) orderQ = orderQ.where('received_at', '<=', toIso);
    const orderAgg = (await orderQ.clone().select(database.raw('COALESCE(SUM(total_amount_centavos),0) as total'), database.raw('COUNT(*) as cnt')).first()) as unknown as { total: number | string; cnt: number | string } | undefined;
    const orderValue = Number(orderAgg?.total ?? 0);
    const totalOrders = Number(orderAgg?.cnt ?? 0);
    const averageOrderValue = totalOrders > 0 ? Math.round(orderValue / totalOrders) : 0;

    // Outstanding overall (not just range)
    const outstandingRow = (await database('orders').where({ shop_id: shopId, is_deleted: 0 }).sum('balance_centavos as total').first()) as unknown as { total: number | string | null } | undefined;
    const outstandingBalance = Number(outstandingRow?.total ?? 0);

    // Collections for range: payments created_at
    let payQ = database('payments').where({ shop_id: shopId, is_deleted: 0 });
    if (fromIso) payQ = payQ.where('created_at', '>=', fromIso);
    if (toIso) payQ = payQ.where('created_at', '<=', toIso);
    const payAgg = (await payQ.clone().sum('amount_centavos as total').first()) as unknown as { total: number | string | null } | undefined;
    const collections = Number(payAgg?.total ?? 0);

    // Order statuses for range
    let statusQ = database('orders').where({ shop_id: shopId, is_deleted: 0 });
    if (fromIso) statusQ = statusQ.where('received_at', '>=', fromIso);
    if (toIso) statusQ = statusQ.where('received_at', '<=', toIso);
    const statusRows = await statusQ.clone().select('status').count('id as c').groupBy('status');
    const orderStatuses: Record<string, number> = { RECEIVED: 0, PROCESSING: 0, READY: 0, COMPLETED: 0 };
    for (const r of statusRows as unknown as { status: string; c: number | string }[]) orderStatuses[r.status] = Number(r.c);

    // Payment statuses for range
    const payStatusRows = await statusQ.clone().select('payment_status').count('id as c').groupBy('payment_status');
    const paymentStatuses: Record<string, number> = { UNPAID: 0, PARTIAL: 0, PAID: 0 };
    for (const r of payStatusRows as unknown as { payment_status: string; c: number | string }[]) (paymentStatuses as any)[r.payment_status] = Number(r.c);

    res.json({
      success: true,
      data: { orderValue, collections, outstandingBalance, totalOrders, averageOrderValue, orderStatuses, paymentStatuses, fromIso, toIso },
    });
  } catch (e) {
    next(e);
  }
});

// GET /api/v1/reports/services?range=&from=&to=&limit=5
reportsRouter.get('/services', async (req: AuthenticatedRequest, res, next) => {
  try {
    const shopId = req.auth!.shopId;
    const { fromIso, toIso } = parseRange(req);
    const limit = Math.min(20, Math.max(1, parseInt((req.query.limit as string) ?? '5', 10) || 5));
    let q = database('orders').where({ shop_id: shopId, is_deleted: 0 });
    if (fromIso) q = q.where('received_at', '>=', fromIso);
    if (toIso) q = q.where('received_at', '<=', toIso);
    const rows = await q.clone().select('service_name_snapshot as service_name').count('id as order_count').sum('total_amount_centavos as order_value').groupBy('service_name_snapshot').orderBy('order_count', 'desc').limit(limit);
    res.json({ success: true, data: { services: rows.map((r: any) => ({ service_name: r.service_name, order_count: Number(r.order_count), order_value: Number(r.order_value) })) } });
  } catch (e) {
    next(e);
  }
});

// GET /api/v1/reports/customers?range=&from=&to=&limit=5
reportsRouter.get('/customers', async (req: AuthenticatedRequest, res, next) => {
  try {
    const shopId = req.auth!.shopId;
    const { fromIso, toIso } = parseRange(req);
    const limit = Math.min(20, Math.max(1, parseInt((req.query.limit as string) ?? '5', 10) || 5));
    let q = database('orders').where({ shop_id: shopId, is_deleted: 0 });
    if (fromIso) q = q.where('received_at', '>=', fromIso);
    if (toIso) q = q.where('received_at', '<=', toIso);
    const rows = await q.clone().select('customer_id', 'customer_name_snapshot as customer_name').count('id as order_count').sum('total_amount_centavos as order_value').groupBy('customer_id', 'customer_name_snapshot').orderBy('order_count', 'desc').limit(limit);
    res.json({ success: true, data: { customers: rows.map((r: any) => ({ customer_id: r.customer_id, customer_name: r.customer_name, order_count: Number(r.order_count), order_value: Number(r.order_value) })) } });
  } catch (e) {
    next(e);
  }
});

// GET /api/v1/reports/trends?range=&from=&to=
// Returns daily collections + order count for range (localtime grouping)
reportsRouter.get('/trends', async (req: AuthenticatedRequest, res, next) => {
  try {
    const shopId = req.auth!.shopId;
    const { fromIso, toIso } = parseRange(req);
    let from = fromIso ? new Date(fromIso) : null;
    let to = toIso ? new Date(toIso) : new Date();
    if (!from) {
      from = new Date(to);
      from.setDate(from.getDate() - 13);
      from.setHours(0, 0, 0, 0);
    }
    to = new Date(to);
    to.setHours(23, 59, 59, 999);
    const fromStr = from.toISOString();
    const toStr = to.toISOString();

    const payRows = await database('payments')
      .where({ shop_id: shopId, is_deleted: 0 })
      .where('created_at', '>=', fromStr)
      .where('created_at', '<=', toStr)
      .select(database.raw("DATE(created_at, 'localtime') as d"), database.raw('COALESCE(SUM(amount_centavos),0) as total'))
      .groupByRaw("DATE(created_at, 'localtime')")
      .orderBy('d');

    const orderRows = await database('orders')
      .where({ shop_id: shopId, is_deleted: 0 })
      .where('received_at', '>=', fromStr)
      .where('received_at', '<=', toStr)
      .select(database.raw("DATE(received_at, 'localtime') as d"), database.raw('COUNT(*) as cnt'), database.raw('COALESCE(SUM(total_amount_centavos),0) as total'))
      .groupByRaw("DATE(received_at, 'localtime')")
      .orderBy('d');

    const payMap = new Map<string, number>();
    for (const r of payRows as unknown as { d: string; total: number | string }[]) payMap.set(r.d, Number(r.total));
    const orderMap = new Map<string, { cnt: number; total: number }>();
    for (const r of orderRows as unknown as { d: string; cnt: number | string; total: number | string }[]) orderMap.set(r.d, { cnt: Number(r.cnt), total: Number(r.total) });

    const result: { date: string; collections: number; orderCount: number; orderValue: number }[] = [];
    const cur = new Date(from);
    cur.setHours(0, 0, 0, 0);
    const end = new Date(to);
    end.setHours(0, 0, 0, 0);
    while (cur <= end) {
      const localKey = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`;
      result.push({
        date: localKey,
        collections: payMap.get(localKey) ?? 0,
        orderCount: orderMap.get(localKey)?.cnt ?? 0,
        orderValue: orderMap.get(localKey)?.total ?? 0,
      });
      cur.setDate(cur.getDate() + 1);
    }

    res.json({ success: true, data: { trends: result, fromIso: fromStr, toIso: toStr } });
  } catch (e) {
    next(e);
  }
});

// GET /api/v1/reports/payment-methods?range=&from=&to=
reportsRouter.get('/payment-methods', async (req: AuthenticatedRequest, res, next) => {
  try {
    const shopId = req.auth!.shopId;
    const { fromIso, toIso } = parseRange(req);
    let q = database('payments').where({ shop_id: shopId, is_deleted: 0 });
    if (fromIso) q = q.where('created_at', '>=', fromIso);
    if (toIso) q = q.where('created_at', '<=', toIso);
    const rows = await q.clone().select(database.raw('LOWER(method) as method')).sum('amount_centavos as total').count('id as count').groupByRaw('LOWER(method)');
    res.json({ success: true, data: { methods: rows.map((r: any) => ({ method: r.method || 'unknown', total: Number(r.total), count: Number(r.count) })) } });
  } catch (e) {
    next(e);
  }
});
