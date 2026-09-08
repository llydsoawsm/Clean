import { Router } from 'express';
import { database } from '../../database/knex';
import { authMiddleware, type AuthenticatedRequest } from '../../middleware/auth';

export const paymentsRouter = Router();
paymentsRouter.use(authMiddleware);

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

// GET /api/v1/payments?status=UNPAID|PARTIAL|PAID&from=ISO&to=ISO&orderId=&search=&limit=50&dateFilter=today|7days|month|all
paymentsRouter.get('/', async (req: AuthenticatedRequest, res, next) => {
  try {
    const shopId = req.auth!.shopId;
    const status = (req.query.status as string | undefined)?.trim().toUpperCase();
    const from = (req.query.from as string | undefined)?.trim();
    const to = (req.query.to as string | undefined)?.trim();
    const orderId = (req.query.orderId as string | undefined)?.trim();
    const search = (req.query.search as string | undefined)?.trim();
    const dateFilter = (req.query.dateFilter as string | undefined)?.trim().toLowerCase();
    const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) ?? '50', 10) || 50));

    let q = database('payments')
      .join('orders', 'payments.order_id', 'orders.id')
      .where('payments.shop_id', shopId)
      .where('payments.is_deleted', 0)
      .where('orders.is_deleted', 0)
      .select(
        'payments.*',
        'orders.order_number as order_number',
        'orders.customer_name_snapshot as customer_name',
        'orders.total_amount_centavos as order_total',
        'orders.balance_centavos as order_balance',
        'orders.payment_status as order_payment_status'
      );

    if (status && ['UNPAID', 'PARTIAL', 'PAID'].includes(status)) {
      q = q.where('orders.payment_status', status);
    }
    if (orderId) {
      q = q.where('payments.order_id', orderId);
    }
    // Date filters
    let fromDate: string | null = null;
    let toDate: string | null = null;
    if (from) fromDate = new Date(from).toISOString();
    if (to) toDate = new Date(to).toISOString();
    // dateFilter helpers
    if (dateFilter === 'today') {
      fromDate = startOfDay(new Date()).toISOString();
      toDate = endOfDay(new Date()).toISOString();
    } else if (dateFilter === '7days') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      fromDate = startOfDay(d).toISOString();
      toDate = endOfDay(new Date()).toISOString();
    } else if (dateFilter === 'month') {
      const now = new Date();
      fromDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      toDate = endOfDay(now).toISOString();
    }
    if (fromDate) q = q.where('payments.created_at', '>=', fromDate);
    if (toDate) q = q.where('payments.created_at', '<=', toDate);

    if (search) {
      const like = `%${search}%`;
      q = q.where(function () {
        this.where('orders.order_number', 'like', like)
          .orWhere('orders.customer_name_snapshot', 'like', like)
          .orWhere('payments.reference', 'like', like)
          .orWhere('payments.notes', 'like', like)
          .orWhereIn(
            'payments.order_id',
            database('orders')
              .select('id')
              .where('shop_id', shopId)
              .whereIn(
                'customer_id',
                database('customers').select('id').where('shop_id', shopId).where('contact_number', 'like', like)
              )
          );
      });
    }

    const rows = await q.orderBy('payments.created_at', 'desc').limit(limit);
    res.json({ success: true, data: { payments: rows } });
  } catch (e) {
    next(e);
  }
});

// GET /api/v1/payments/summary
paymentsRouter.get('/summary', async (req: AuthenticatedRequest, res, next) => {
  try {
    const shopId = req.auth!.shopId;

    const todayStart = startOfDay(new Date()).toISOString();
    const todayEnd = endOfDay(new Date()).toISOString();
    const weekStart = startOfDay(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).toISOString();
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

    const collectedTodayRow = (await database('payments')
      .where({ shop_id: shopId, is_deleted: 0 })
      .where('created_at', '>=', todayStart)
      .where('created_at', '<=', todayEnd)
      .sum('amount_centavos as total')
      .first()) as unknown as { total: number | string | null } | undefined;
    const collectedWeekRow = (await database('payments')
      .where({ shop_id: shopId, is_deleted: 0 })
      .where('created_at', '>=', weekStart)
      .sum('amount_centavos as total')
      .first()) as unknown as { total: number | string | null } | undefined;
    const collectedMonthRow = (await database('payments')
      .where({ shop_id: shopId, is_deleted: 0 })
      .where('created_at', '>=', monthStart)
      .sum('amount_centavos as total')
      .first()) as unknown as { total: number | string | null } | undefined;

    const outstandingRow = (await database('orders')
      .where({ shop_id: shopId, is_deleted: 0 })
      .sum('balance_centavos as total')
      .first()) as unknown as { total: number | string | null } | undefined;

    const statusCounts = await database('orders')
      .where({ shop_id: shopId, is_deleted: 0 })
      .select('payment_status')
      .count('id as c')
      .groupBy('payment_status');

    const counts: Record<string, number> = { UNPAID: 0, PARTIAL: 0, PAID: 0 };
    for (const r of statusCounts as unknown as { payment_status: string; c: number }[]) {
      counts[r.payment_status] = Number(r.c);
    }

    res.json({
      success: true,
      data: {
        collectedToday: Number(collectedTodayRow?.total ?? 0),
        collectedThisWeek: Number(collectedWeekRow?.total ?? 0),
        collectedThisMonth: Number(collectedMonthRow?.total ?? 0),
        outstandingBalance: Number(outstandingRow?.total ?? 0),
        unpaidOrders: counts.UNPAID,
        partialOrders: counts.PARTIAL,
        paidOrders: counts.PAID,
      },
    });
  } catch (e) {
    next(e);
  }
});

// GET /api/v1/payments/:id
paymentsRouter.get('/:id', async (req: AuthenticatedRequest, res, next) => {
  try {
    const shopId = req.auth!.shopId;
    const { id } = req.params as { id: string };
    const payment = await database('payments')
      .join('orders', 'payments.order_id', 'orders.id')
      .where('payments.id', id)
      .where('payments.shop_id', shopId)
      .where('payments.is_deleted', 0)
      .select(
        'payments.*',
        'orders.order_number as order_number',
        'orders.customer_name_snapshot as customer_name',
        'orders.shop_id as order_shop_id'
      )
      .first();
    if (!payment) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Payment not found' } });
      return;
    }
    // Also fetch order for navigation
    const order = await database('orders').where({ id: payment.order_id, shop_id: shopId }).first();
    res.json({ success: true, data: { payment, order } });
  } catch (e) {
    next(e);
  }
});
