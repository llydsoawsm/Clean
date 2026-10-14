import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { database } from '../../database/knex';
import { authMiddleware, type AuthenticatedRequest } from '../../middleware/auth';
import { createOrderSchema } from './orders.schemas';

export const ordersRouter = Router();
ordersRouter.use(authMiddleware);

function nowIso(): string {
  return new Date().toISOString();
}
function toCentavos(pesos: number): number {
  return Math.round(pesos * 100);
}
function calcBase(
  pricingType: string,
  unitPriceCents: number,
  weightGrams: number | null,
  quantity: number | null,
  weightBlockGrams?: number | null
): number {
  if (pricingType === 'PER_KG') {
    if (!weightGrams || weightGrams <= 0) return 0;
    return Math.round((weightGrams * unitPriceCents) / 1000);
  }
  if (pricingType === 'PER_LOAD') {
    if (!weightGrams || weightGrams <= 0) return 0;
    const block = weightBlockGrams && weightBlockGrams > 0 ? weightBlockGrams : 8000;
    const loads = Math.ceil(weightGrams / block);
    return loads * unitPriceCents;
  }
  if (pricingType === 'PER_PIECE') {
    if (!quantity || quantity <= 0) return 0;
    return quantity * unitPriceCents;
  }
  return unitPriceCents; // FIXED
}
function derivePaymentStatus(total: number, paid: number): string {
  if (paid <= 0) return 'UNPAID';
  if (paid >= total) return 'PAID';
  return 'PARTIAL';
}
function orderPrefix(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `CLN-${y}${m}${day}`;
}
async function generateOrderNumber(shopId: string, trx: any): Promise<string> {
  const prefix = orderPrefix();
  const row = (await trx('orders')
    .where('shop_id', shopId)
    .where('order_number', 'like', `${prefix}-%`)
    .count('id as count')
    .first()) as unknown as { count: number | string } | undefined;
  const cnt = Number((row as unknown as { count: number })?.count ?? 0);
  const next = cnt + 1;
  return `${prefix}-${String(next).padStart(4, '0')}`;
}

// GET /api/v1/orders?status=RECEIVED&search=&limit=20
ordersRouter.get('/', async (req: AuthenticatedRequest, res, next) => {
  try {
    const shopId = req.auth!.shopId;
    const status = (req.query.status as string | undefined)?.trim().toUpperCase();
    const search = (req.query.search as string | undefined)?.trim() ?? '';
    const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) ?? '20', 10) || 20));

    let q = database('orders').where({ shop_id: shopId, is_deleted: 0 });
    if (status && ['RECEIVED', 'PROCESSING', 'READY', 'COMPLETED'].includes(status)) {
      q = q.where({ status });
    }
    if (search) {
      const like = `%${search}%`;
      q = q.where(function () {
        this.where('order_number', 'like', like)
          .orWhere('service_name_snapshot', 'like', like)
          .orWhere('customer_name_snapshot', 'like', like)
          .orWhereIn(
            'customer_id',
            database('customers').select('id').where('shop_id', shopId).where('contact_number', 'like', like)
          );
      });
    }
    const rows = await q.orderBy('received_at', 'desc').limit(limit);
    res.json({ success: true, data: { orders: rows } });
  } catch (e) {
    next(e);
  }
});

ordersRouter.get('/:id', async (req: AuthenticatedRequest, res, next) => {
  try {
    const shopId = req.auth!.shopId;
    const { id } = req.params as { id: string };
    const order = await database('orders').where({ id, shop_id: shopId, is_deleted: 0 }).first();
    if (!order) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } });
      return;
    }
    const payments = await database('payments').where({ order_id: id, is_deleted: 0 }).orderBy('created_at', 'asc');
    const history = await database('order_status_history').where({ order_id: id }).orderBy('changed_at', 'asc');
    // also fetch customer contact for convenience
    const customer = await database('customers').where({ id: order.customer_id }).first();
    res.json({ success: true, data: { order, payments, history, customer } });
  } catch (e) {
    next(e);
  }
});

ordersRouter.post('/', async (req: AuthenticatedRequest, res, next) => {
  try {
    const shopId = req.auth!.shopId;
    // coerce numeric strings
    for (const k of ['weight_kg', 'weight_grams', 'quantity', 'additional_fee', 'rush_fee', 'amount_paid', 'additional_fee_centavos', 'rush_fee_centavos', 'amount_paid_centavos']) {
      if (typeof req.body[k] === 'string' && req.body[k] !== '') req.body[k] = parseFloat(req.body[k]);
    }

    const parsed = createOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input' } });
      return;
    }
    const data = parsed.data;

    // Fetch customer and service with shop scoping
    const customer = await database('customers').where({ id: data.customer_id, shop_id: shopId, is_deleted: 0 }).first();
    if (!customer) {
      res.status(400).json({ success: false, error: { code: 'INVALID_CUSTOMER', message: 'Customer not found or not owned by shop' } });
      return;
    }
    const service = await database('services').where({ id: data.service_id, shop_id: shopId, is_deleted: 0 }).first();
    if (!service) {
      res.status(400).json({ success: false, error: { code: 'INVALID_SERVICE', message: 'Service not found or not owned by shop' } });
      return;
    }
    if (!service.is_active) {
      res.status(400).json({ success: false, error: { code: 'INACTIVE_SERVICE', message: 'Service is inactive and cannot be used for new orders' } });
      return;
    }

    const pricingType = (service.pricing_type as string).toUpperCase(); // PER_KG etc, normalize
    const unitPriceCents = service.price_centavos as number;

    // Resolve weight_grams / quantity and weight block for PER_LOAD
    let weightGrams: number | null = null;
    let quantity: number | null = null;
    let weightBlockSnapshot: number | null = null;

    if (pricingType === 'PER_KG') {
      if (data.weight_grams != null) weightGrams = Math.round(data.weight_grams);
      else if (data.weight_kg != null) weightGrams = Math.round((data.weight_kg as number) * 1000);
      else {
        res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Weight is required for PER_KG service' } });
        return;
      }
      if (!weightGrams || weightGrams <= 0) {
        res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Weight must be > 0' } });
        return;
      }
    } else if (pricingType === 'PER_LOAD') {
      if (data.weight_grams != null) weightGrams = Math.round(data.weight_grams);
      else if (data.weight_kg != null) weightGrams = Math.round((data.weight_kg as number) * 1000);
      else {
        res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Weight is required for PER_LOAD service' } });
        return;
      }
      if (!weightGrams || weightGrams <= 0) {
        res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Weight must be > 0' } });
        return;
      }
      weightBlockSnapshot = (service.weight_block_grams as number) ?? 8000;
    } else if (pricingType === 'PER_PIECE') {
      if (data.quantity == null) {
        res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Quantity is required for PER_PIECE service' } });
        return;
      }
      quantity = data.quantity as number;
    } else {
      // FIXED: weight/quantity not required
    }

    // Fees: prefer centavos if provided, else pesos
    let additionalCents = 0;
    if (data.additional_fee_centavos != null) additionalCents = data.additional_fee_centavos;
    else if (data.additional_fee != null) additionalCents = toCentavos(data.additional_fee);
    let rushCents = 0;
    if (data.rush_fee_centavos != null) rushCents = data.rush_fee_centavos;
    else if (data.rush_fee != null) rushCents = toCentavos(data.rush_fee);
    let paidCents = 0;
    if (data.amount_paid_centavos != null) paidCents = data.amount_paid_centavos;
    else if (data.amount_paid != null) paidCents = toCentavos(data.amount_paid);

    if (additionalCents < 0 || rushCents < 0 || paidCents < 0) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Fees and payment cannot be negative' } });
      return;
    }

    const base = calcBase(pricingType, unitPriceCents, weightGrams, quantity, weightBlockSnapshot);
    const total = base + additionalCents + rushCents;
    if (paidCents > total) {
      res.status(400).json({ success: false, error: { code: 'OVERPAYMENT', message: 'Amount paid cannot exceed total' } });
      return;
    }
    const balance = total - paidCents;
    const paymentStatus = derivePaymentStatus(total, paidCents);

    const now = nowIso();
    const id = randomUUID();

    let createdOrder: any = null;

    await database.transaction(async (trx) => {
      const orderNumber = await generateOrderNumber(shopId, trx);

      await trx('orders').insert({
        id,
        shop_id: shopId,
        customer_id: customer.id,
        service_id: service.id,
        order_number: orderNumber,
        service_name_snapshot: service.service_name,
        pricing_type_snapshot: pricingType,
        unit_price_snapshot_centavos: unitPriceCents,
        weight_block_snapshot_grams: weightBlockSnapshot,
        customer_name_snapshot: customer.name,
        weight_grams: weightGrams,
        quantity,
        base_amount_centavos: base,
        additional_fee_centavos: additionalCents,
        rush_fee_centavos: rushCents,
        is_rush: data.is_rush ? 1 : 0,
        total_amount_centavos: total,
        amount_paid_centavos: paidCents,
        balance_centavos: balance,
        payment_status: paymentStatus,
        status: 'RECEIVED',
        notes: data.notes?.trim() || null,
        received_at: now,
        created_at: now,
        updated_at: now,
        is_deleted: 0,
      });

      await trx('order_status_history').insert({
        id: randomUUID(),
        order_id: id,
        from_status: null,
        to_status: 'RECEIVED',
        changed_at: now,
        changed_by: req.auth!.userId,
      });

      if (paidCents > 0) {
        await trx('payments').insert({
          id: randomUUID(),
          shop_id: shopId,
          order_id: id,
          amount_centavos: paidCents,
          method: 'cash',
          created_at: now,
          updated_at: now,
          is_deleted: 0,
        });
      }

      createdOrder = await trx('orders').where({ id }).first();
    });

    const payments = await database('payments').where({ order_id: id, is_deleted: 0 });
    const history = await database('order_status_history').where({ order_id: id });

    res.status(201).json({ success: true, data: { order: createdOrder, payments, history } });
  } catch (e) {
    next(e);
  }
});

// PATCH /api/v1/orders/:id/status — valid transitions, ready_at, balance check for COMPLETED
const VALID_TRANSITIONS: Record<string, string[]> = {
  RECEIVED: ['PROCESSING'],
  PROCESSING: ['READY'],
  READY: ['COMPLETED'],
  COMPLETED: [],
};
ordersRouter.patch('/:id/status', async (req: AuthenticatedRequest, res, next) => {
  try {
    const shopId = req.auth!.shopId;
    const { id } = req.params as { id: string };
    const { status: nextStatusRaw } = req.body as { status?: string };
    const nextStatus = (nextStatusRaw ?? '').trim().toUpperCase();
    if (!['RECEIVED', 'PROCESSING', 'READY', 'COMPLETED'].includes(nextStatus)) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid status' } });
      return;
    }

    const order = await database('orders').where({ id, shop_id: shopId, is_deleted: 0 }).first();
    if (!order) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } });
      return;
    }

    const current = order.status as string;
    const allowed = VALID_TRANSITIONS[current] ?? [];
    if (!allowed.includes(nextStatus)) {
      res.status(400).json({ success: false, error: { code: 'INVALID_TRANSITION', message: `Invalid transition ${current} -> ${nextStatus}` } });
      return;
    }

    // Balance check for COMPLETED: must be 0
    if (nextStatus === 'COMPLETED' && order.balance_centavos > 0) {
      res.status(400).json({
        success: false,
        error: { code: 'UNPAID_BALANCE', message: `This order still has a ${order.balance_centavos} centavos balance. Please settle before completing.` },
      });
      return;
    }

    const now = nowIso();

    await database.transaction(async (trx) => {
      const updates: Record<string, unknown> = {
        status: nextStatus,
        updated_at: now,
      };
      if (nextStatus === 'PROCESSING' && !order.processing_at) updates.processing_at = now;
      if (nextStatus === 'READY') updates.ready_at = now;
      if (nextStatus === 'COMPLETED') updates.completed_at = now;

      await trx('orders').where({ id }).update(updates);

      await trx('order_status_history').insert({
        id: randomUUID(),
        order_id: id,
        from_status: current,
        to_status: nextStatus,
        changed_at: now,
        changed_by: req.auth!.userId,
      });
    });

    const updated = await database('orders').where({ id }).first();
    const history = await database('order_status_history').where({ order_id: id }).orderBy('changed_at', 'asc');
    res.json({ success: true, data: { order: updated, history } });
  } catch (e) {
    next(e);
  }
});

// --- Milestone 60%: Commented out order payments sub-route ---
/*
// POST /api/v1/orders/:id/payments — add payment, recalc (Phase 7: method/reference/notes)
ordersRouter.post('/:id/payments', async (req: AuthenticatedRequest, res, next) => {
  try {
    const shopId = req.auth!.shopId;
    const { id } = req.params as { id: string };
    let amountCents: number | undefined;
    if (typeof req.body.amount_centavos === 'number') amountCents = req.body.amount_centavos;
    else if (typeof req.body.amount === 'number') amountCents = toCentavos(req.body.amount);
    else if (typeof req.body.amount === 'string' && req.body.amount !== '') amountCents = toCentavos(parseFloat(req.body.amount));
    else if (typeof req.body.amount_centavos === 'string' && req.body.amount_centavos !== '') amountCents = parseInt(req.body.amount_centavos as string, 10);

    if (amountCents == null || isNaN(amountCents)) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'amount is required' } });
      return;
    }
    if (amountCents <= 0) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Payment must be > 0' } });
      return;
    }

    // Payment method handling (Phase 7)
    const rawMethod = typeof req.body.method === 'string' ? req.body.method.trim().toUpperCase() : typeof req.body.payment_method === 'string' ? req.body.payment_method.trim().toUpperCase() : 'CASH';
    const method = ['CASH', 'GCASH', 'OTHER'].includes(rawMethod) ? rawMethod.toLowerCase() : 'cash';
    // Normalize to lowercase for storage, accept CASH/GCASH/OTHER case-insensitive
    const validatedMethod = ['cash', 'gcash', 'other'].includes(method) ? method : 'cash';

    const referenceRaw = typeof req.body.reference === 'string' ? req.body.reference.trim() : '';
    const reference = referenceRaw ? referenceRaw.slice(0, 100) : null;
    const notesRaw = typeof req.body.notes === 'string' ? req.body.notes.trim() : typeof req.body.payment_notes === 'string' ? req.body.payment_notes.trim() : '';
    const notes = notesRaw ? notesRaw.slice(0, 500) : null;

    // reference not required for cash, optional for gcash/other — no hard require, but trim
    // Do not store sensitive data beyond reference/notes

    const order = await database('orders').where({ id, shop_id: shopId, is_deleted: 0 }).first();
    if (!order) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } });
      return;
    }
    if (order.balance_centavos <= 0) {
      res.status(400).json({ success: false, error: { code: 'ALREADY_PAID', message: 'This order is already fully paid.' } });
      return;
    }
    if (amountCents > order.balance_centavos) {
      res.status(400).json({ success: false, error: { code: 'OVERPAYMENT', message: 'Payment exceeds remaining balance' } });
      return;
    }

    const now = nowIso();
    const paymentId = randomUUID();

    await database.transaction(async (trx) => {
      await trx('payments').insert({
        id: paymentId,
        shop_id: shopId,
        order_id: id,
        amount_centavos: amountCents,
        method: validatedMethod,
        reference,
        notes,
        created_at: now,
        updated_at: now,
        is_deleted: 0,
      });

      // recalc order paid/balance/status
      const sumRow = (await trx('payments').where({ order_id: id, is_deleted: 0 }).sum('amount_centavos as total').first()) as unknown as { total: number | string } | undefined;
      const paid = Number(sumRow?.total ?? 0);
      const balance = order.total_amount_centavos - paid;
      let paymentStatus: string = 'UNPAID';
      if (paid <= 0) paymentStatus = 'UNPAID';
      else if (paid >= order.total_amount_centavos) paymentStatus = 'PAID';
      else paymentStatus = 'PARTIAL';

      await trx('orders').where({ id }).update({
        amount_paid_centavos: paid,
        balance_centavos: balance,
        payment_status: paymentStatus,
        updated_at: now,
      });
    });

    const updatedOrder = await database('orders').where({ id }).first();
    const payments = await database('payments').where({ order_id: id, is_deleted: 0 }).orderBy('created_at', 'asc');
    const payment = await database('payments').where({ id: paymentId }).first();
    res.status(201).json({ success: true, data: { order: updatedOrder, payments, payment } });
  } catch (e) {
    next(e);
  }
});
*/

ordersRouter.delete('/:id', async (req: AuthenticatedRequest, res, next) => {
  try {
    const shopId = req.auth!.shopId;
    const { id } = req.params as { id: string };
    const existing = await database('orders').where({ id, shop_id: shopId }).first();
    if (!existing) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } });
      return;
    }
    if (existing.is_deleted) {
      res.json({ success: true, data: { order: existing } });
      return;
    }
    // Preserve financial history: soft-delete, do not hard-delete payments/history
    await database('orders').where({ id }).update({ is_deleted: 1, updated_at: nowIso() });
    const updated = await database('orders').where({ id }).first();
    res.json({ success: true, data: { order: updated } });
  } catch (e) {
    next(e);
  }
});
