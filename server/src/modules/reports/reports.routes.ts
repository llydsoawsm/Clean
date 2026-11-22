import { Router } from 'express';
import { database } from '../../database/knex';
import { authMiddleware, type AuthenticatedRequest } from '../../middleware/auth';
import {
  endOfDayIso,
  localDateKey,
  resolveTzOffsetMinutes,
  safeParseIso,
  sqliteOffsetModifier,
  startOfDayIso,
  startOfMonthIso,
} from '../../utils/timezone';

export const reportsRouter = Router();
reportsRouter.use(authMiddleware);

interface ParsedRange {
  fromIso: string | null;
  toIso: string | null;
  label: string;
  tzOffset: number;
  error?: string;
}

function parseRange(req: AuthenticatedRequest): ParsedRange {
  const tzOffset = resolveTzOffsetMinutes(req.query.tzOffset);
  const key = ((req.query.range as string) || (req.query.dateFilter as string) || '').toLowerCase();
  const fromQ = (req.query.from as string | undefined)?.trim();
  const toQ = (req.query.to as string | undefined)?.trim();
  const now = new Date();

  if (key === 'today') {
    return {
      fromIso: startOfDayIso(now, tzOffset),
      toIso: endOfDayIso(now, tzOffset),
      label: 'Today',
      tzOffset,
    };
  }
  if (key === '7days' || key === 'last7' || key === 'week') {
    const start = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
    return {
      fromIso: startOfDayIso(start, tzOffset),
      toIso: endOfDayIso(now, tzOffset),
      label: 'Last 7 Days',
      tzOffset,
    };
  }
  if (key === 'month' || key === 'thismonth') {
    return {
      fromIso: startOfMonthIso(now, tzOffset),
      toIso: endOfDayIso(now, tzOffset),
      label: 'This Month',
      tzOffset,
    };
  }
  if (fromQ || toQ) {
    const fromIso = fromQ ? safeParseIso(fromQ) : null;
    const toIso = toQ ? safeParseIso(toQ) : new Date().toISOString();
    if (fromQ && !fromIso) {
      return { fromIso: null, toIso: null, label: 'Invalid', tzOffset, error: 'Invalid "from" date' };
    }
    if (toQ && !toIso) {
      return { fromIso: null, toIso: null, label: 'Invalid', tzOffset, error: 'Invalid "to" date' };
    }
    return { fromIso, toIso, label: 'Custom', tzOffset };
  }
  return { fromIso: null, toIso: null, label: 'All Time', tzOffset };
}

// GET /api/v1/reports/summary?range=today|7days|month|all&from=&to=&tzOffset=480
reportsRouter.get('/summary', async (req: AuthenticatedRequest, res, next) => {
  try {
    const shopId = req.auth!.shopId;
    const range = parseRange(req);
    if (range.error) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: range.error } });
      return;
    }
    const { fromIso, toIso } = range;

    let orderQ = database('orders').where({ shop_id: shopId, is_deleted: 0 });
    if (fromIso) orderQ = orderQ.where('received_at', '>=', fromIso);
    if (toIso) orderQ = orderQ.where('received_at', '<=', toIso);
    const orderAgg = (await orderQ
      .clone()
      .select(database.raw('COALESCE(SUM(total_amount_centavos),0) as total'), database.raw('COUNT(*) as cnt'))
      .first()) as unknown as { total: number | string; cnt: number | string } | undefined;
    const orderValue = Number(orderAgg?.total ?? 0);
    const totalOrders = Number(orderAgg?.cnt ?? 0);
    const averageOrderValue = totalOrders > 0 ? Math.round(orderValue / totalOrders) : 0;

    const outstandingRow = (await database('orders')
      .where({ shop_id: shopId, is_deleted: 0 })
      .sum('balance_centavos as total')
      .first()) as unknown as { total: number | string | null } | undefined;
    const outstandingBalance = Number(outstandingRow?.total ?? 0);

    let payQ = database('payments').where({ shop_id: shopId, is_deleted: 0 });
    if (fromIso) payQ = payQ.where('created_at', '>=', fromIso);
    if (toIso) payQ = payQ.where('created_at', '<=', toIso);
    const payAgg = (await payQ.clone().sum('amount_centavos as total').first()) as unknown as { total: number | string | null } | undefined;
    const collections = Number(payAgg?.total ?? 0);

    const statusRows = await orderQ.clone().select('status').count('id as c').groupBy('status');
    const orderStatuses: Record<string, number> = { RECEIVED: 0, PROCESSING: 0, READY: 0, COMPLETED: 0 };
    for (const r of statusRows as unknown as { status: string; c: number | string }[]) orderStatuses[r.status] = Number(r.c);

    const payStatusRows = await orderQ.clone().select('payment_status').count('id as c').groupBy('payment_status');
    const paymentStatuses: Record<string, number> = { UNPAID: 0, PARTIAL: 0, PAID: 0 };
    for (const r of payStatusRows as unknown as { payment_status: string; c: number | string }[]) paymentStatuses[r.payment_status] = Number(r.c);

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
    const range = parseRange(req);
    if (range.error) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: range.error } });
      return;
    }
    const { fromIso, toIso } = range;
    const limit = Math.min(20, Math.max(1, parseInt((req.query.limit as string) ?? '5', 10) || 5));
    let q = database('orders').where({ shop_id: shopId, is_deleted: 0 });
    if (fromIso) q = q.where('received_at', '>=', fromIso);
    if (toIso) q = q.where('received_at', '<=', toIso);
    const rows = await q
      .clone()
      .select('service_name_snapshot as service_name')
      .count('id as order_count')
      .sum('total_amount_centavos as order_value')
      .groupBy('service_name_snapshot')
      .orderBy('order_count', 'desc')
      .limit(limit);
    res.json({
      success: true,
      data: {
        services: rows.map((r: any) => ({
          service_name: r.service_name,
          order_count: Number(r.order_count),
          order_value: Number(r.order_value),
        })),
      },
    });
  } catch (e) {
    next(e);
  }
});

// GET /api/v1/reports/customers?range=&from=&to=&limit=5
reportsRouter.get('/customers', async (req: AuthenticatedRequest, res, next) => {
  try {
    const shopId = req.auth!.shopId;
    const range = parseRange(req);
    if (range.error) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: range.error } });
      return;
    }
    const { fromIso, toIso } = range;
    const limit = Math.min(20, Math.max(1, parseInt((req.query.limit as string) ?? '5', 10) || 5));
    let q = database('orders').where({ shop_id: shopId, is_deleted: 0 });
    if (fromIso) q = q.where('received_at', '>=', fromIso);
    if (toIso) q = q.where('received_at', '<=', toIso);
    const rows = await q
      .clone()
      .select('customer_id', 'customer_name_snapshot as customer_name')
      .count('id as order_count')
      .sum('total_amount_centavos as order_value')
      .groupBy('customer_id', 'customer_name_snapshot')
      .orderBy('order_count', 'desc')
      .limit(limit);
    res.json({
      success: true,
      data: {
        customers: rows.map((r: any) => ({
          customer_id: r.customer_id,
          customer_name: r.customer_name,
          order_count: Number(r.order_count),
          order_value: Number(r.order_value),
        })),
      },
    });
  } catch (e) {
    next(e);
  }
});

// GET /api/v1/reports/trends?range=&from=&to=&tzOffset=480
reportsRouter.get('/trends', async (req: AuthenticatedRequest, res, next) => {
  try {
    const shopId = req.auth!.shopId;
    const range = parseRange(req);
    if (range.error) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: range.error } });
      return;
    }
    const { tzOffset } = range;
    const now = new Date();
    const toDate = range.toIso ? new Date(range.toIso) : now;
    const fromDate = range.fromIso ? new Date(range.fromIso) : new Date(toDate.getTime() - 13 * 24 * 60 * 60 * 1000);

    const fromStr = startOfDayIso(fromDate, tzOffset);
    const toStr = endOfDayIso(toDate, tzOffset);
    const tzModifier = sqliteOffsetModifier(tzOffset);

    const payRows = await database('payments')
      .where({ shop_id: shopId, is_deleted: 0 })
      .where('created_at', '>=', fromStr)
      .where('created_at', '<=', toStr)
      .select(database.raw('DATE(created_at, ?) as d', [tzModifier]), database.raw('COALESCE(SUM(amount_centavos),0) as total'))
      .groupByRaw('DATE(created_at, ?)', [tzModifier])
      .orderBy('d');

    const orderRows = await database('orders')
      .where({ shop_id: shopId, is_deleted: 0 })
      .where('received_at', '>=', fromStr)
      .where('received_at', '<=', toStr)
      .select(
        database.raw('DATE(received_at, ?) as d', [tzModifier]),
        database.raw('COUNT(*) as cnt'),
        database.raw('COALESCE(SUM(total_amount_centavos),0) as total')
      )
      .groupByRaw('DATE(received_at, ?)', [tzModifier])
      .orderBy('d');

    const payMap = new Map<string, number>();
    for (const r of payRows as unknown as { d: string; total: number | string }[]) payMap.set(r.d, Number(r.total));
    const orderMap = new Map<string, { cnt: number; total: number }>();
    for (const r of orderRows as unknown as { d: string; cnt: number | string; total: number | string }[]) {
      orderMap.set(r.d, { cnt: Number(r.cnt), total: Number(r.total) });
    }

    const result: { date: string; collections: number; orderCount: number; orderValue: number }[] = [];
    let curMs = new Date(fromStr).getTime();
    const endMs = new Date(toStr).getTime();
    while (curMs <= endMs && result.length < 366) {
      const key = localDateKey(new Date(curMs), tzOffset);
      result.push({
        date: key,
        collections: payMap.get(key) ?? 0,
        orderCount: orderMap.get(key)?.cnt ?? 0,
        orderValue: orderMap.get(key)?.total ?? 0,
      });
      curMs += 24 * 60 * 60 * 1000;
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
    const range = parseRange(req);
    if (range.error) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: range.error } });
      return;
    }
    const { fromIso, toIso } = range;
    let q = database('payments').where({ shop_id: shopId, is_deleted: 0 });
    if (fromIso) q = q.where('created_at', '>=', fromIso);
    if (toIso) q = q.where('created_at', '<=', toIso);
    const rows = await q
      .clone()
      .select(database.raw('LOWER(method) as method'))
      .sum('amount_centavos as total')
      .count('id as count')
      .groupByRaw('LOWER(method)');
    res.json({
      success: true,
      data: {
        methods: rows.map((r: any) => ({
          method: r.method || 'unknown',
          total: Number(r.total),
          count: Number(r.count),
        })),
      },
    });
  } catch (e) {
    next(e);
  }
});
