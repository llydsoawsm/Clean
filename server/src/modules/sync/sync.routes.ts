import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { database } from '../../database/knex';
import { authMiddleware, type AuthenticatedRequest } from '../../middleware/auth';
import { safeParseIso } from '../../utils/timezone';

export const syncRouter = Router();
syncRouter.use(authMiddleware);

const STATUS_RANK: Record<string, number> = {
  RECEIVED: 0,
  PROCESSING: 1,
  READY: 2,
  COMPLETED: 3,
};

let lastServerTimeMs = 0;
function nowIso(): string {
  const now = Date.now();
  lastServerTimeMs = now > lastServerTimeMs ? now : lastServerTimeMs + 1;
  return new Date(lastServerTimeMs).toISOString();
}

function isNewer(incoming: string | null | undefined, existing: string | null | undefined): boolean {
  if (!incoming) return false;
  const incTime = new Date(incoming).getTime();
  if (Number.isNaN(incTime)) return false;
  if (!existing) return true;
  const exTime = new Date(existing).getTime();
  if (Number.isNaN(exTime)) return true;
  return incTime > exTime;
}

function derivePaymentStatus(total: number, paid: number): 'UNPAID' | 'PARTIAL' | 'PAID' {
  if (paid <= 0) return 'UNPAID';
  if (paid >= total) return 'PAID';
  return 'PARTIAL';
}

// POST /api/v1/sync/push
// Dependency order: customers -> services -> orders -> payments -> statusHistory
syncRouter.post('/push', async (req: AuthenticatedRequest, res, next) => {
  try {
    const shopId = req.auth!.shopId;
    const userId = req.auth!.userId;

    const customers = Array.isArray(req.body.customers) ? req.body.customers : [];
    const services = Array.isArray(req.body.services) ? req.body.services : [];
    const orders = Array.isArray(req.body.orders) ? req.body.orders : [];
    const payments = Array.isArray(req.body.payments) ? req.body.payments : [];
    const statusHistory = Array.isArray(req.body.statusHistory)
      ? req.body.statusHistory
      : Array.isArray(req.body.status_history)
        ? req.body.status_history
        : [];

    const results: Record<string, any[]> = {
      customers: [],
      services: [],
      orders: [],
      payments: [],
      statusHistory: [],
    };

    // 1. Customers
    for (const c of customers) {
      const id = String(c.id ?? '').trim();
      if (!id) {
        results.customers.push({ id: c.id ?? null, status: 'failed', error: 'Missing id' });
        continue;
      }
      if (c.shop_id && c.shop_id !== shopId) {
        results.customers.push({ id, status: 'failed', error: 'Shop mismatch' });
        continue;
      }
      try {
        const existing = await database('customers').where({ id }).first();
        if (existing) {
          if (existing.shop_id !== shopId) {
            results.customers.push({ id, status: 'failed', error: 'Not owned by shop' });
            continue;
          }
          if (
            c.updated_at &&
            existing.updated_at &&
            c.updated_at === existing.updated_at &&
            c.name === existing.name &&
            c.contact_number === existing.contact_number &&
            Boolean(c.is_deleted) === Boolean(existing.is_deleted)
          ) {
            results.customers.push({ id, status: 'synced', serverUpdatedAt: existing.server_updated_at ?? existing.updated_at });
            continue;
          }
          if (isNewer(c.updated_at, existing.updated_at)) {
            const serverNow = nowIso();
            const nextRow: Record<string, unknown> = {
              updated_at: c.updated_at ?? serverNow,
              server_updated_at: serverNow,
            };
            if (c.name !== undefined) nextRow.name = String(c.name).trim();
            if (c.contact_number !== undefined) nextRow.contact_number = String(c.contact_number).trim();
            if (c.address !== undefined) nextRow.address = c.address ? String(c.address).trim() : null;
            if (c.notes !== undefined) nextRow.notes = c.notes ? String(c.notes).trim() : null;
            if (c.is_deleted !== undefined) nextRow.is_deleted = c.is_deleted ? 1 : 0;
            try {
              await database('customers').where({ id }).update(nextRow);
              results.customers.push({ id, status: 'synced', serverUpdatedAt: serverNow });
            } catch (e: unknown) {
              const msg = e instanceof Error ? e.message : String(e);
              if (msg.includes('UNIQUE')) {
                results.customers.push({ id, status: 'failed', error: 'Contact already exists' });
              } else {
                throw e;
              }
            }
          } else {
            results.customers.push({
              id,
              status: 'synced',
              serverUpdatedAt: existing.server_updated_at ?? existing.updated_at,
              conflict: 'server_newer',
            });
          }
        } else {
          if (!c.name || !c.contact_number) {
            results.customers.push({ id, status: 'failed', error: 'Missing name/contact' });
            continue;
          }
          const serverNow = nowIso();
          const clientUpdated = c.updated_at ?? c.created_at ?? serverNow;
          try {
            await database('customers').insert({
              id,
              shop_id: shopId,
              name: String(c.name).trim(),
              contact_number: String(c.contact_number).trim(),
              address: c.address ? String(c.address).trim() : null,
              notes: c.notes ? String(c.notes).trim() : null,
              created_at: c.created_at ?? clientUpdated,
              updated_at: clientUpdated,
              server_updated_at: serverNow,
              is_deleted: c.is_deleted ? 1 : 0,
            });
            results.customers.push({ id, status: 'synced', serverUpdatedAt: serverNow });
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            if (msg.includes('UNIQUE')) {
              results.customers.push({ id, status: 'failed', error: 'Contact already exists' });
            } else {
              throw e;
            }
          }
        }
      } catch (e) {
        results.customers.push({ id, status: 'failed', error: e instanceof Error ? e.message : String(e) });
      }
    }

    // 2. Services
    for (const s of services) {
      const id = String(s.id ?? '').trim();
      if (!id) {
        results.services.push({ id: s.id ?? null, status: 'failed', error: 'Missing id' });
        continue;
      }
      if (s.shop_id && s.shop_id !== shopId) {
        results.services.push({ id, status: 'failed', error: 'Shop mismatch' });
        continue;
      }
      try {
        const existing = await database('services').where({ id }).first();
        if (existing) {
          if (existing.shop_id !== shopId) {
            results.services.push({ id, status: 'failed', error: 'Not owned' });
            continue;
          }
          if (isNewer(s.updated_at, existing.updated_at)) {
            const serverNow = nowIso();
            const nextRow: Record<string, unknown> = {
              updated_at: s.updated_at ?? serverNow,
              server_updated_at: serverNow,
            };
            if (s.service_name !== undefined) nextRow.service_name = String(s.service_name).trim();
            if (s.name !== undefined) nextRow.service_name = String(s.name).trim();
            if (s.pricing_type !== undefined) nextRow.pricing_type = String(s.pricing_type).trim().toUpperCase();
            if (s.price_centavos !== undefined) {
              const p = Number(s.price_centavos);
              if (!Number.isFinite(p) || p < 0) {
                results.services.push({ id, status: 'failed', error: 'Invalid price_centavos' });
                continue;
              }
              nextRow.price_centavos = Math.round(p);
            }
            if (s.unit_price_centavos !== undefined) {
              const p = Number(s.unit_price_centavos);
              if (!Number.isFinite(p) || p < 0) {
                results.services.push({ id, status: 'failed', error: 'Invalid unit_price_centavos' });
                continue;
              }
              nextRow.price_centavos = Math.round(p);
            }
            if (s.description !== undefined) nextRow.description = s.description ? String(s.description).trim() : null;
            if (s.weight_block_grams !== undefined) nextRow.weight_block_grams = s.weight_block_grams ? Number(s.weight_block_grams) : null;
            if (s.is_active !== undefined) nextRow.is_active = s.is_active ? 1 : 0;
            if (s.is_deleted !== undefined) nextRow.is_deleted = s.is_deleted ? 1 : 0;
            try {
              await database('services').where({ id }).update(nextRow);
              results.services.push({ id, status: 'synced', serverUpdatedAt: serverNow });
            } catch (e: unknown) {
              const msg = e instanceof Error ? e.message : String(e);
              if (msg.includes('UNIQUE')) {
                results.services.push({ id, status: 'failed', error: 'Service name already exists' });
              } else {
                throw e;
              }
            }
          } else {
            results.services.push({
              id,
              status: 'synced',
              serverUpdatedAt: existing.server_updated_at ?? existing.updated_at,
              conflict: 'server_newer',
            });
          }
        } else {
          if (!s.service_name && !s.name) {
            results.services.push({ id, status: 'failed', error: 'Missing service_name' });
            continue;
          }
          const priceCentavos = Math.round(Number(s.price_centavos ?? s.unit_price_centavos ?? 0));
          if (!Number.isFinite(priceCentavos) || priceCentavos < 0) {
            results.services.push({ id, status: 'failed', error: 'Invalid price' });
            continue;
          }
          const serverNow = nowIso();
          const clientUpdated = s.updated_at ?? s.created_at ?? serverNow;
          try {
            await database('services').insert({
              id,
              shop_id: shopId,
              service_name: String(s.service_name ?? s.name).trim(),
              pricing_type: String(s.pricing_type ?? 'FIXED').trim().toUpperCase(),
              price_centavos: priceCentavos,
              description: s.description ? String(s.description).trim() : null,
              weight_block_grams: s.weight_block_grams ? Number(s.weight_block_grams) : null,
              is_active: s.is_active !== undefined ? (s.is_active ? 1 : 0) : 1,
              created_at: s.created_at ?? clientUpdated,
              updated_at: clientUpdated,
              server_updated_at: serverNow,
              is_deleted: s.is_deleted ? 1 : 0,
            });
            results.services.push({ id, status: 'synced', serverUpdatedAt: serverNow });
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            if (msg.includes('UNIQUE')) {
              results.services.push({ id, status: 'failed', error: 'Service name already exists' });
            } else {
              throw e;
            }
          }
        }
      } catch (e) {
        results.services.push({ id, status: 'failed', error: e instanceof Error ? e.message : String(e) });
      }
    }

    // 3. Orders — preserve snapshots, validate status transitions, never allow corrupting payment math
    for (const o of orders) {
      const id = String(o.id ?? '').trim();
      if (!id) {
        results.orders.push({ id: o.id ?? null, status: 'failed', error: 'Missing id' });
        continue;
      }
      if (o.shop_id && o.shop_id !== shopId) {
        results.orders.push({ id, status: 'failed', error: 'Shop mismatch' });
        continue;
      }
      try {
        const existing = await database('orders').where({ id }).first();
        if (existing) {
          if (existing.shop_id !== shopId) {
            results.orders.push({ id, status: 'failed', error: 'Not owned' });
            continue;
          }
          if (o.updated_at && existing.updated_at && o.updated_at === existing.updated_at) {
            results.orders.push({ id, status: 'synced', serverUpdatedAt: existing.server_updated_at ?? existing.updated_at });
            continue;
          }
          if (isNewer(o.updated_at, existing.updated_at)) {
            const serverNow = nowIso();
            const nextRow: Record<string, unknown> = {
              updated_at: o.updated_at ?? serverNow,
              server_updated_at: serverNow,
            };

            if (o.status !== undefined) {
              const incomingStatus = String(o.status).trim().toUpperCase();
              const currRank = STATUS_RANK[existing.status] ?? 0;
              const nextRank = STATUS_RANK[incomingStatus];
              if (nextRank === undefined) {
                results.orders.push({ id, status: 'failed', error: `Invalid status ${incomingStatus}` });
                continue;
              }
              // Only advance forward or keep same status
              if (nextRank >= currRank) {
                // Allow COMPLETED only when server balance is 0 OR payments in this same payload will settle it
                const pendingPaymentsForOrder = payments
                  .filter((p: any) => p.order_id === id && Number(p.amount_centavos) > 0)
                  .reduce((acc: number, p: any) => acc + Math.round(Number(p.amount_centavos)), 0);
                const effectiveBalance = existing.balance_centavos - pendingPaymentsForOrder;
                if (incomingStatus === 'COMPLETED' && effectiveBalance > 0) {
                  results.orders.push({ id, status: 'failed', error: 'Cannot complete order with unpaid balance' });
                  continue;
                }
                nextRow.status = incomingStatus;
              }
            }

            if (o.notes !== undefined) nextRow.notes = o.notes ? String(o.notes).trim() : null;
            if (o.is_deleted !== undefined) nextRow.is_deleted = o.is_deleted ? 1 : 0;
            if (o.processing_at !== undefined) nextRow.processing_at = o.processing_at;
            if (o.ready_at !== undefined) nextRow.ready_at = o.ready_at;
            if (o.completed_at !== undefined) nextRow.completed_at = o.completed_at;

            if (Object.keys(nextRow).length > 2) {
              await database('orders').where({ id }).update(nextRow);
            }
            results.orders.push({ id, status: 'synced', serverUpdatedAt: serverNow });
          } else {
            results.orders.push({
              id,
              status: 'synced',
              serverUpdatedAt: existing.server_updated_at ?? existing.updated_at,
              conflict: 'server_newer',
            });
          }
        } else {
          const customerId = String(o.customer_id ?? '').trim();
          const serviceId = String(o.service_id ?? '').trim();
          if (!customerId || !serviceId) {
            results.orders.push({ id, status: 'failed', error: 'Missing customer/service' });
            continue;
          }
          const customer = await database('customers').where({ id: customerId, shop_id: shopId }).first();
          if (!customer) {
            results.orders.push({ id, status: 'failed', error: 'Customer not found or not owned' });
            continue;
          }
          const service = await database('services').where({ id: serviceId, shop_id: shopId }).first();
          if (!service) {
            results.orders.push({ id, status: 'failed', error: 'Service not found or not owned' });
            continue;
          }

          let orderNumber = String(
            o.order_number ??
              `CLN-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(Math.floor(Math.random() * 9000) + 1000)}`
          ).trim();
          const collision = await database('orders').where({ shop_id: shopId, order_number: orderNumber }).whereNot({ id }).first();
          if (collision) {
            const prefix = orderNumber.split('-').slice(0, 2).join('-') || `CLN-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`;
            const cntRow = (await database('orders')
              .where('shop_id', shopId)
              .where('order_number', 'like', `${prefix}-%`)
              .count('id as c')
              .first()) as unknown as { c: number | string } | undefined;
            const cnt = Number(cntRow?.c ?? 0);
            orderNumber = `${prefix}-${String(cnt + 1).padStart(4, '0')}-${id.slice(0, 4)}`;
          }

          const totalCentavos = Math.max(0, Math.round(Number(o.total_amount_centavos ?? o.total_centavos ?? 0)));
          const amountPaid = Math.max(0, Math.round(Number(o.amount_paid_centavos ?? 0)));
          const balance = Math.max(0, totalCentavos - amountPaid);
          const paymentStatus = derivePaymentStatus(totalCentavos, amountPaid);
          const serverNow = nowIso();
          const clientUpdated = o.updated_at ?? o.created_at ?? serverNow;

          await database('orders').insert({
            id,
            shop_id: shopId,
            customer_id: customerId,
            service_id: serviceId,
            order_number: orderNumber,
            service_name_snapshot: String(o.service_name_snapshot ?? service.service_name).trim(),
            pricing_type_snapshot: String(o.pricing_type_snapshot ?? service.pricing_type).trim().toUpperCase(),
            unit_price_snapshot_centavos: Math.max(0, Math.round(Number(o.unit_price_snapshot_centavos ?? service.price_centavos ?? 0))),
            weight_block_snapshot_grams: o.weight_block_snapshot_grams
              ? Number(o.weight_block_snapshot_grams)
              : o.weight_block_grams_snapshot
                ? Number(o.weight_block_grams_snapshot)
                : null,
            customer_name_snapshot: o.customer_name_snapshot ? String(o.customer_name_snapshot).trim() : customer.name,
            weight_grams: o.weight_grams ? Number(o.weight_grams) : null,
            quantity: o.quantity ? Number(o.quantity) : null,
            base_amount_centavos: Math.max(0, Math.round(Number(o.base_amount_centavos ?? o.base_cost_centavos ?? 0))),
            additional_fee_centavos: Math.max(0, Math.round(Number(o.additional_fee_centavos ?? 0))),
            rush_fee_centavos: Math.max(0, Math.round(Number(o.rush_fee_centavos ?? 0))),
            is_rush: o.is_rush ? 1 : 0,
            total_amount_centavos: totalCentavos,
            amount_paid_centavos: amountPaid,
            balance_centavos: balance,
            payment_status: paymentStatus,
            status: STATUS_RANK[String(o.status ?? 'RECEIVED').trim().toUpperCase()] !== undefined ? String(o.status).trim().toUpperCase() : 'RECEIVED',
            notes: o.notes ? String(o.notes).trim() : null,
            received_at: o.received_at ?? o.created_at ?? clientUpdated,
            processing_at: o.processing_at ?? null,
            ready_at: o.ready_at ?? null,
            completed_at: o.completed_at ?? null,
            created_at: o.created_at ?? clientUpdated,
            updated_at: clientUpdated,
            server_updated_at: serverNow,
            is_deleted: o.is_deleted ? 1 : 0,
          });

          const hasHistory = await database('order_status_history').where({ order_id: id, to_status: 'RECEIVED' }).first();
          if (!hasHistory) {
            await database('order_status_history').insert({
              id: randomUUID(),
              order_id: id,
              from_status: null,
              to_status: 'RECEIVED',
              changed_at: o.received_at ?? clientUpdated,
              changed_by: userId,
              server_updated_at: serverNow,
            });
          }
          results.orders.push({ id, status: 'synced', serverUpdatedAt: serverNow, order_number: orderNumber });
        }
      } catch (e) {
        results.orders.push({ id, status: 'failed', error: e instanceof Error ? e.message : String(e) });
      }
    }

    // 4. Payments — append-only, idempotent via id, validates amount > 0 & recalculates order totals
    for (const p of payments) {
      const id = String(p.id ?? '').trim();
      if (!id) {
        results.payments.push({ id: p.id ?? null, status: 'failed', error: 'Missing id' });
        continue;
      }
      if (p.shop_id && p.shop_id !== shopId) {
        results.payments.push({ id, status: 'failed', error: 'Shop mismatch' });
        continue;
      }
      const amountCentavos = Math.round(Number(p.amount_centavos));
      if (!Number.isFinite(amountCentavos) || amountCentavos <= 0) {
        results.payments.push({ id, status: 'failed', error: 'Payment amount must be > 0' });
        continue;
      }
      try {
        const existing = await database('payments').where({ id }).first();
        if (existing) {
          if (existing.shop_id !== shopId) {
            results.payments.push({ id, status: 'failed', error: 'Not owned' });
            continue;
          }
          results.payments.push({ id, status: 'synced', serverUpdatedAt: existing.server_updated_at ?? existing.created_at });
          continue;
        }
        const orderId = String(p.order_id ?? '').trim();
        if (!orderId) {
          results.payments.push({ id, status: 'failed', error: 'Missing order_id' });
          continue;
        }
        const order = await database('orders').where({ id: orderId, shop_id: shopId }).first();
        if (!order) {
          results.payments.push({ id, status: 'failed', error: 'Parent order not found on server, retry after order sync' });
          continue;
        }

        const rawMethod = String(p.method ?? 'cash').trim().toLowerCase();
        const method = ['cash', 'gcash', 'other'].includes(rawMethod) ? rawMethod : 'cash';
        const serverNow = nowIso();
        const createdAt = p.created_at ?? serverNow;

        await database('payments').insert({
          id,
          shop_id: shopId,
          order_id: orderId,
          amount_centavos: amountCentavos,
          method,
          reference: p.reference ? String(p.reference).trim().slice(0, 100) : null,
          notes: p.notes ? String(p.notes).trim().slice(0, 500) : null,
          created_at: createdAt,
          updated_at: p.updated_at ?? createdAt,
          server_updated_at: serverNow,
          is_deleted: p.is_deleted ? 1 : 0,
        });

        const sumRow = (await database('payments')
          .where({ order_id: orderId, is_deleted: 0 })
          .sum('amount_centavos as total')
          .first()) as unknown as { total: number | string | null } | undefined;
        const paid = Number(sumRow?.total ?? 0);
        const balance = Math.max(0, order.total_amount_centavos - paid);
        const paymentStatus = derivePaymentStatus(order.total_amount_centavos, paid);
        const overpaid = paid > order.total_amount_centavos;

        await database('orders').where({ id: orderId }).update({
          amount_paid_centavos: paid,
          balance_centavos: balance,
          payment_status: paymentStatus,
          updated_at: serverNow,
          server_updated_at: serverNow,
        });

        results.payments.push({ id, status: 'synced', serverUpdatedAt: serverNow, ...(overpaid ? { warning: 'overpaid' } : {}) });
      } catch (e) {
        results.payments.push({ id, status: 'failed', error: e instanceof Error ? e.message : String(e) });
      }
    }

    // 5. Status History — append-only, idempotent via id, shop-scoped
    for (const h of statusHistory) {
      const id = String(h.id ?? '').trim();
      if (!id) {
        results.statusHistory.push({ id: h.id ?? null, status: 'failed', error: 'Missing id' });
        continue;
      }
      try {
        const existing = await database('order_status_history')
          .join('orders', 'order_status_history.order_id', 'orders.id')
          .where('order_status_history.id', id)
          .select('order_status_history.*', 'orders.shop_id as order_shop_id')
          .first();
        if (existing) {
          if (existing.order_shop_id !== shopId) {
            results.statusHistory.push({ id, status: 'failed', error: 'Not owned' });
            continue;
          }
          results.statusHistory.push({ id, status: 'synced', serverUpdatedAt: existing.server_updated_at ?? existing.changed_at });
          continue;
        }
        const orderId = String(h.order_id ?? '').trim();
        if (!orderId) {
          results.statusHistory.push({ id, status: 'failed', error: 'Missing order_id' });
          continue;
        }
        const order = await database('orders').where({ id: orderId, shop_id: shopId }).first();
        if (!order) {
          results.statusHistory.push({ id, status: 'failed', error: 'Parent order not found' });
          continue;
        }
        const toStatus = String(h.to_status ?? '').trim().toUpperCase();
        if (STATUS_RANK[toStatus] === undefined) {
          results.statusHistory.push({ id, status: 'failed', error: `Invalid to_status ${toStatus}` });
          continue;
        }
        const serverNow = nowIso();
        await database('order_status_history').insert({
          id,
          order_id: orderId,
          from_status: h.from_status ? String(h.from_status).trim().toUpperCase() : null,
          to_status: toStatus,
          changed_at: h.changed_at ?? serverNow,
          changed_by: h.changed_by ?? userId,
          server_updated_at: serverNow,
        });
        results.statusHistory.push({ id, status: 'synced', serverUpdatedAt: serverNow });
      } catch (e) {
        results.statusHistory.push({ id, status: 'failed', error: e instanceof Error ? e.message : String(e) });
      }
    }

    res.json({ success: true, data: { results, pushedAt: nowIso() } });
  } catch (e) {
    next(e);
  }
});

// GET /api/v1/sync/pull?since=ISO&limit=50
// Uses server_updated_at (immune to client clock skew) and safe pagination cursor (never skips rows).
syncRouter.get('/pull', async (req: AuthenticatedRequest, res, next) => {
  try {
    const shopId = req.auth!.shopId;
    const sinceRaw =
      (req.query.since as string | undefined)?.trim() ??
      (req.query.lastSync as string | undefined)?.trim() ??
      (req.query.cursor as string | undefined)?.trim();

    let since = new Date(0).toISOString();
    if (sinceRaw) {
      const parsed = safeParseIso(sinceRaw);
      if (!parsed) {
        res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid "since" timestamp' } });
        return;
      }
      since = parsed;
    }

    const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) ?? '50', 10) || 50));
    const fetchLimit = limit + 1;

    const rawCustomers = await database('customers')
      .where('shop_id', shopId)
      .whereRaw('COALESCE(server_updated_at, updated_at) > ?', [since])
      .orderByRaw('COALESCE(server_updated_at, updated_at) ASC, id ASC')
      .limit(fetchLimit);

    const rawServices = await database('services')
      .where('shop_id', shopId)
      .whereRaw('COALESCE(server_updated_at, updated_at) > ?', [since])
      .orderByRaw('COALESCE(server_updated_at, updated_at) ASC, id ASC')
      .limit(fetchLimit);

    const rawOrders = await database('orders')
      .where('shop_id', shopId)
      .whereRaw('COALESCE(server_updated_at, updated_at) > ?', [since])
      .orderByRaw('COALESCE(server_updated_at, updated_at) ASC, id ASC')
      .limit(fetchLimit);

    const rawPayments = await database('payments')
      .where('shop_id', shopId)
      .whereRaw('COALESCE(server_updated_at, updated_at, created_at) > ?', [since])
      .orderByRaw('COALESCE(server_updated_at, updated_at, created_at) ASC, id ASC')
      .limit(fetchLimit);

    const rawHistory = await database('order_status_history')
      .join('orders', 'order_status_history.order_id', 'orders.id')
      .where('orders.shop_id', shopId)
      .whereRaw('COALESCE(order_status_history.server_updated_at, order_status_history.changed_at) > ?', [since])
      .select('order_status_history.*')
      .orderByRaw('COALESCE(order_status_history.server_updated_at, order_status_history.changed_at) ASC, order_status_history.id ASC')
      .limit(fetchLimit);

    const slicePage = <T>(rows: T[]) => ({
      items: rows.slice(0, limit),
      truncated: rows.length > limit,
    });

    const pCustomers = slicePage(rawCustomers);
    const pServices = slicePage(rawServices);
    const pOrders = slicePage(rawOrders);
    const pPayments = slicePage(rawPayments);
    const pHistory = slicePage(rawHistory);

    const hasMore = pCustomers.truncated || pServices.truncated || pOrders.truncated || pPayments.truncated || pHistory.truncated;

    const tsOf = (row: any, fallbackKey: string): string => String(row.server_updated_at ?? row[fallbackKey] ?? since);

    // Safe cursor calculation:
    // - If any entity was truncated by `limit`, advance cursor only up to the MIN of the last timestamps
    //   across all truncated entities so no remaining rows from any table are skipped.
    // - Otherwise, advance to the MAX timestamp across all returned rows (or keep `since` if empty).
    let nextCursor = since;
    if (hasMore) {
      const truncatedEnds: string[] = [];
      if (pCustomers.truncated && pCustomers.items.length > 0) truncatedEnds.push(tsOf(pCustomers.items[pCustomers.items.length - 1], 'updated_at'));
      if (pServices.truncated && pServices.items.length > 0) truncatedEnds.push(tsOf(pServices.items[pServices.items.length - 1], 'updated_at'));
      if (pOrders.truncated && pOrders.items.length > 0) truncatedEnds.push(tsOf(pOrders.items[pOrders.items.length - 1], 'updated_at'));
      if (pPayments.truncated && pPayments.items.length > 0) truncatedEnds.push(tsOf(pPayments.items[pPayments.items.length - 1], 'updated_at'));
      if (pHistory.truncated && pHistory.items.length > 0) truncatedEnds.push(tsOf(pHistory.items[pHistory.items.length - 1], 'changed_at'));
      if (truncatedEnds.length > 0) {
        truncatedEnds.sort();
        nextCursor = truncatedEnds[0];
      }
    } else {
      const allTimes: string[] = [
        ...pCustomers.items.map((r: any) => tsOf(r, 'updated_at')),
        ...pServices.items.map((r: any) => tsOf(r, 'updated_at')),
        ...pOrders.items.map((r: any) => tsOf(r, 'updated_at')),
        ...pPayments.items.map((r: any) => tsOf(r, 'updated_at')),
        ...pHistory.items.map((r: any) => tsOf(r, 'changed_at')),
      ];
      if (allTimes.length > 0) {
        allTimes.sort();
        nextCursor = allTimes[allTimes.length - 1];
      }
    }

    res.json({
      success: true,
      data: {
        customers: pCustomers.items,
        services: pServices.items,
        orders: pOrders.items,
        payments: pPayments.items,
        statusHistory: pHistory.items,
        nextCursor,
        hasMore,
        pulledAt: nowIso(),
      },
    });
  } catch (e) {
    next(e);
  }
});

// GET /api/v1/sync/status
syncRouter.get('/status', async (req: AuthenticatedRequest, res, next) => {
  try {
    const shopId = req.auth!.shopId;
    const counts = {
      customers: Number(((await database('customers').where({ shop_id: shopId, is_deleted: 0 }).count('id as c').first()) as any)?.c ?? 0),
      services: Number(((await database('services').where({ shop_id: shopId, is_deleted: 0 }).count('id as c').first()) as any)?.c ?? 0),
      orders: Number(((await database('orders').where({ shop_id: shopId, is_deleted: 0 }).count('id as c').first()) as any)?.c ?? 0),
      payments: Number(((await database('payments').where({ shop_id: shopId, is_deleted: 0 }).count('id as c').first()) as any)?.c ?? 0),
    };
    res.json({ success: true, data: counts });
  } catch (e) {
    next(e);
  }
});
