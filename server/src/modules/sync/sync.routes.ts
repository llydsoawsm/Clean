import { Router } from 'express';
import { database } from '../../database/knex';
import { authMiddleware, type AuthenticatedRequest } from '../../middleware/auth';

export const syncRouter = Router();
syncRouter.use(authMiddleware);

function nowIso(): string {
  return new Date().toISOString();
}

// Helper: compare ISO timestamps
function isNewer(incoming: string | null | undefined, existing: string | null | undefined): boolean {
  if (!incoming) return false;
  if (!existing) return true;
  return new Date(incoming).getTime() > new Date(existing).getTime();
}

// POST /api/v1/sync/push
// Body: { customers?: CustomerInput[], services?: ServiceInput[], orders?: OrderInput[], payments?: PaymentInput[], statusHistory?: StatusInput[] }
// Each with id, shop_id etc. Server validates shop ownership, idempotent via id.
syncRouter.post('/push', async (req: AuthenticatedRequest, res, next) => {
  try {
    const shopId = req.auth!.shopId;
    const userId = req.auth!.userId;

    const customers = (req.body.customers as any[]) ?? [];
    const services = (req.body.services as any[]) ?? [];
    const orders = (req.body.orders as any[]) ?? [];
    const payments = (req.body.payments as any[]) ?? [];
    const statusHistory = (req.body.statusHistory as any[]) ?? (req.body.status_history as any[]) ?? [];

    const results: Record<string, any[]> = {
      customers: [],
      services: [],
      orders: [],
      payments: [],
      statusHistory: [],
    };

    // Customers — dependency first
    for (const c of customers) {
      const id = String(c.id ?? '').trim();
      if (!id) {
        results.customers.push({ id: c.id ?? null, status: 'failed', error: 'Missing id' });
        continue;
      }
      // Shop scoping: reject if client tries to push other shop's customer
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
          // Idempotency: if same updated_at, return success
          // Conflict: latest updated_at wins for customers
          if (c.updated_at && existing.updated_at && c.updated_at === existing.updated_at && c.name === existing.name && c.contact_number === existing.contact_number) {
            results.customers.push({ id, status: 'synced', serverUpdatedAt: existing.updated_at });
            continue;
          }
          if (isNewer(c.updated_at, existing.updated_at)) {
            const nextRow: Record<string, unknown> = { updated_at: c.updated_at ?? nowIso() };
            if (c.name !== undefined) nextRow.name = String(c.name).trim();
            if (c.contact_number !== undefined) nextRow.contact_number = String(c.contact_number).trim();
            if (c.address !== undefined) nextRow.address = c.address ? String(c.address).trim() : null;
            if (c.notes !== undefined) nextRow.notes = c.notes ? String(c.notes).trim() : null;
            if (c.is_deleted !== undefined) nextRow.is_deleted = c.is_deleted ? 1 : 0;
            await database('customers').where({ id }).update(nextRow);
            const updated = await database('customers').where({ id }).first();
            results.customers.push({ id, status: 'synced', serverUpdatedAt: updated.updated_at });
          } else {
            // Server is newer, keep server
            results.customers.push({ id, status: 'synced', serverUpdatedAt: existing.updated_at, conflict: 'server_newer' });
          }
        } else {
          // Insert new — validate required
          if (!c.name || !c.contact_number) {
            results.customers.push({ id, status: 'failed', error: 'Missing name/contact' });
            continue;
          }
          const now = c.updated_at ?? c.created_at ?? nowIso();
          try {
            await database('customers').insert({
              id,
              shop_id: shopId,
              name: String(c.name).trim(),
              contact_number: String(c.contact_number).trim(),
              address: c.address ? String(c.address).trim() : null,
              notes: c.notes ? String(c.notes).trim() : null,
              created_at: c.created_at ?? now,
              updated_at: now,
              is_deleted: c.is_deleted ? 1 : 0,
            });
            results.customers.push({ id, status: 'synced', serverUpdatedAt: now });
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            if (msg.includes('UNIQUE')) {
              results.customers.push({ id, status: 'failed', error: 'Contact already exists' });
            } else throw e;
          }
        }
      } catch (e) {
        results.customers.push({ id, status: 'failed', error: e instanceof Error ? e.message : String(e) });
      }
    }

    // Services
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
            const nextRow: Record<string, unknown> = { updated_at: s.updated_at ?? nowIso() };
            if (s.service_name !== undefined) nextRow.service_name = String(s.service_name).trim();
            if (s.name !== undefined) nextRow.service_name = String(s.name).trim();
            if (s.pricing_type !== undefined) nextRow.pricing_type = String(s.pricing_type).trim().toUpperCase();
            if (s.price_centavos !== undefined) nextRow.price_centavos = Number(s.price_centavos);
            if (s.unit_price_centavos !== undefined) nextRow.price_centavos = Number(s.unit_price_centavos);
            if (s.description !== undefined) nextRow.description = s.description ? String(s.description).trim() : null;
            if (s.weight_block_grams !== undefined) nextRow.weight_block_grams = s.weight_block_grams ? Number(s.weight_block_grams) : null;
            if (s.is_active !== undefined) nextRow.is_active = s.is_active ? 1 : 0;
            if (s.is_deleted !== undefined) nextRow.is_deleted = s.is_deleted ? 1 : 0;
            await database('services').where({ id }).update(nextRow);
            const updated = await database('services').where({ id }).first();
            results.services.push({ id, status: 'synced', serverUpdatedAt: updated.updated_at });
          } else {
            results.services.push({ id, status: 'synced', serverUpdatedAt: existing.updated_at, conflict: 'server_newer' });
          }
        } else {
          if (!s.service_name && !s.name) {
            results.services.push({ id, status: 'failed', error: 'Missing service_name' });
            continue;
          }
          const now = s.updated_at ?? s.created_at ?? nowIso();
          await database('services').insert({
            id,
            shop_id: shopId,
            service_name: String(s.service_name ?? s.name).trim(),
            pricing_type: String(s.pricing_type ?? 'FIXED').trim().toUpperCase(),
            price_centavos: Number(s.price_centavos ?? s.unit_price_centavos ?? 0),
            description: s.description ? String(s.description).trim() : null,
            weight_block_grams: s.weight_block_grams ? Number(s.weight_block_grams) : null,
            is_active: s.is_active !== undefined ? (s.is_active ? 1 : 0) : 1,
            created_at: s.created_at ?? now,
            updated_at: now,
            is_deleted: s.is_deleted ? 1 : 0,
          });
          results.services.push({ id, status: 'synced', serverUpdatedAt: now });
        }
      } catch (e) {
        results.services.push({ id, status: 'failed', error: e instanceof Error ? e.message : String(e) });
      }
    }

    // Orders — preserve snapshots, handle order_number collision
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
          // Idempotent if same updated_at
          if (o.updated_at && existing.updated_at && o.updated_at === existing.updated_at) {
            results.orders.push({ id, status: 'synced', serverUpdatedAt: existing.updated_at });
            continue;
          }
          // Order conflict safety: never overwrite snapshots financials if incoming differs and server has different price
          // For now, only allow status/payment fields to change via sync if newer
          if (isNewer(o.updated_at, existing.updated_at)) {
            // Only update non-snapshot fields: status, payment_status, amount_paid, balance, notes, updated_at, is_deleted, processing/ready/completed_at
            // Do NOT overwrite snapshots: service_name_snapshot, pricing_type_snapshot, unit_price_snapshot, weight_block, etc.
            const nextRow: Record<string, unknown> = { updated_at: o.updated_at ?? nowIso() };
            if (o.status !== undefined) nextRow.status = String(o.status).trim().toUpperCase();
            if (o.payment_status !== undefined) nextRow.payment_status = String(o.payment_status).trim().toUpperCase();
            if (o.amount_paid_centavos !== undefined) nextRow.amount_paid_centavos = Number(o.amount_paid_centavos);
            if (o.balance_centavos !== undefined) nextRow.balance_centavos = Number(o.balance_centavos);
            if (o.notes !== undefined) nextRow.notes = o.notes ? String(o.notes).trim() : null;
            if (o.is_deleted !== undefined) nextRow.is_deleted = o.is_deleted ? 1 : 0;
            if (o.processing_at !== undefined) nextRow.processing_at = o.processing_at;
            if (o.ready_at !== undefined) nextRow.ready_at = o.ready_at;
            if (o.completed_at !== undefined) nextRow.completed_at = o.completed_at;
            // Only update if there's something to update beyond updated_at
            if (Object.keys(nextRow).length > 1) {
              await database('orders').where({ id }).update(nextRow);
            }
            const updated = await database('orders').where({ id }).first();
            results.orders.push({ id, status: 'synced', serverUpdatedAt: updated.updated_at });
          } else {
            results.orders.push({ id, status: 'synced', serverUpdatedAt: existing.updated_at, conflict: 'server_newer' });
          }
        } else {
          // New order — validate required and shop ownership of customer/service
          const customerId = String(o.customer_id ?? '').trim();
          const serviceId = String(o.service_id ?? '').trim();
          if (!customerId || !serviceId) {
            results.orders.push({ id, status: 'failed', error: 'Missing customer/service' });
            continue;
          }
          // Verify customer/service belong to shop
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
          // Handle order_number collision: if same shop_id+order_number exists with different id, generate new number
          let orderNumber = String(o.order_number ?? `CLN-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${String(Math.floor(Math.random()*9000)+1000)}`).trim();
          const collision = await database('orders').where({ shop_id: shopId, order_number: orderNumber }).whereNot({ id }).first();
          if (collision) {
            // Generate new number via count
            const prefix = orderNumber.split('-').slice(0,2).join('-') || `CLN-${new Date().toISOString().slice(0,10).replace(/-/g,'')}`;
            const cntRow = (await database('orders').where('shop_id', shopId).where('order_number', 'like', `${prefix}-%`).count('id as c').first()) as unknown as { c: number | string } | undefined;
            const cnt = Number((cntRow as any)?.c ?? 0);
            orderNumber = `${prefix}-${String(cnt + 1).padStart(4, '0')}-${id.slice(0,4)}`;
          }
          const now = o.updated_at ?? o.created_at ?? nowIso();
          // Preserve snapshots as sent, do not recalculate
          await database('orders').insert({
            id,
            shop_id: shopId,
            customer_id: customerId,
            service_id: serviceId,
            order_number: orderNumber,
            service_name_snapshot: String(o.service_name_snapshot ?? service.service_name).trim(),
            pricing_type_snapshot: String(o.pricing_type_snapshot ?? service.pricing_type).trim().toUpperCase(),
            unit_price_snapshot_centavos: Number(o.unit_price_snapshot_centavos ?? service.price_centavos ?? 0),
            weight_block_snapshot_grams: o.weight_block_snapshot_grams ? Number(o.weight_block_snapshot_grams) : (o.weight_block_grams_snapshot ? Number(o.weight_block_grams_snapshot) : null),
            customer_name_snapshot: o.customer_name_snapshot ? String(o.customer_name_snapshot).trim() : customer.name,
            weight_grams: o.weight_grams ? Number(o.weight_grams) : null,
            quantity: o.quantity ? Number(o.quantity) : null,
            base_amount_centavos: Number(o.base_amount_centavos ?? o.base_cost_centavos ?? 0),
            additional_fee_centavos: Number(o.additional_fee_centavos ?? 0),
            rush_fee_centavos: Number(o.rush_fee_centavos ?? 0),
            is_rush: o.is_rush ? 1 : 0,
            total_amount_centavos: Number(o.total_amount_centavos ?? o.total_centavos ?? 0),
            amount_paid_centavos: Number(o.amount_paid_centavos ?? 0),
            balance_centavos: Number(o.balance_centavos ?? 0),
            payment_status: String(o.payment_status ?? 'UNPAID').trim().toUpperCase(),
            status: String(o.status ?? 'RECEIVED').trim().toUpperCase(),
            notes: o.notes ? String(o.notes).trim() : null,
            received_at: o.received_at ?? o.created_at ?? now,
            processing_at: o.processing_at ?? null,
            ready_at: o.ready_at ?? null,
            completed_at: o.completed_at ?? null,
            created_at: o.created_at ?? now,
            updated_at: now,
            is_deleted: o.is_deleted ? 1 : 0,
          });
          // Also create initial status history if not provided
          const hasHistory = await database('order_status_history').where({ order_id: id, to_status: 'RECEIVED' }).first();
          if (!hasHistory) {
            await database('order_status_history').insert({
              id: require('node:crypto').randomUUID(),
              order_id: id,
              from_status: null,
              to_status: 'RECEIVED',
              changed_at: o.received_at ?? now,
              changed_by: userId,
            });
          }
          results.orders.push({ id, status: 'synced', serverUpdatedAt: now, order_number: orderNumber });
        }
      } catch (e) {
        results.orders.push({ id, status: 'failed', error: e instanceof Error ? e.message : String(e) });
      }
    }

    // Payments — append-only, idempotent via id
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
      try {
        const existing = await database('payments').where({ id }).first();
        if (existing) {
          // Idempotent: already exists, return success without re-inserting or recalculating
          if (existing.shop_id !== shopId) {
            results.payments.push({ id, status: 'failed', error: 'Not owned' });
            continue;
          }
          results.payments.push({ id, status: 'synced', serverUpdatedAt: existing.created_at });
          continue;
        }
        const orderId = String(p.order_id ?? '').trim();
        if (!orderId) {
          results.payments.push({ id, status: 'failed', error: 'Missing order_id' });
          continue;
        }
        const order = await database('orders').where({ id: orderId, shop_id: shopId }).first();
        if (!order) {
          // Parent order missing, remain pending
          results.payments.push({ id, status: 'failed', error: 'Parent order not found on server, retry after order sync' });
          continue;
        }
        // Validate not overpay? But we trust local balance check; server will verify and recalc
        // Insert
        const now = p.created_at ?? nowIso();
        await database('payments').insert({
          id,
          shop_id: shopId,
          order_id: orderId,
          amount_centavos: Number(p.amount_centavos),
          method: String(p.method ?? 'cash').toLowerCase(),
          reference: p.reference ? String(p.reference).trim() : null,
          notes: p.notes ? String(p.notes).trim() : null,
          created_at: now,
          updated_at: p.updated_at ?? now,
          is_deleted: p.is_deleted ? 1 : 0,
        });
        // Recalc order paid/balance/status via sum (merge behavior)
        const sumRow = (await database('payments').where({ order_id: orderId, is_deleted: 0 }).sum('amount_centavos as total').first()) as unknown as { total: number | string | null } | undefined;
        const paid = Number(sumRow?.total ?? 0);
        const balance = order.total_amount_centavos - paid;
        let paymentStatus: string = 'UNPAID';
        if (paid <= 0) paymentStatus = 'UNPAID';
        else if (paid >= order.total_amount_centavos) paymentStatus = 'PAID';
        else paymentStatus = 'PARTIAL';
        await database('orders').where({ id: orderId }).update({
          amount_paid_centavos: paid,
          balance_centavos: balance,
          payment_status: paymentStatus,
          updated_at: nowIso(),
        });
        results.payments.push({ id, status: 'synced', serverUpdatedAt: now });
      } catch (e) {
        results.payments.push({ id, status: 'failed', error: e instanceof Error ? e.message : String(e) });
      }
    }

    // Status History — append-only, idempotent via id
    for (const h of statusHistory) {
      const id = String(h.id ?? '').trim();
      if (!id) {
        results.statusHistory.push({ id: h.id ?? null, status: 'failed', error: 'Missing id' });
        continue;
      }
      try {
        const existing = await database('order_status_history').where({ id }).first();
        if (existing) {
          results.statusHistory.push({ id, status: 'synced', serverUpdatedAt: existing.changed_at });
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
        // Validate status transition sequence? Allow if valid but not strict for sync; record as is
        await database('order_status_history').insert({
          id,
          order_id: orderId,
          from_status: h.from_status ? String(h.from_status).trim().toUpperCase() : null,
          to_status: String(h.to_status).trim().toUpperCase(),
          changed_at: h.changed_at ?? nowIso(),
          changed_by: h.changed_by ?? userId,
        });
        // Optionally update order status/ timestamps if this is latest? For sync, we trust order's status via order sync; but we can also ensure order's status reflects latest history if newer
        // We do not automatically change order status from history to avoid conflict; order sync handles status
        results.statusHistory.push({ id, status: 'synced', serverUpdatedAt: h.changed_at ?? nowIso() });
      } catch (e) {
        results.statusHistory.push({ id, status: 'failed', error: e instanceof Error ? e.message : String(e) });
      }
    }

    res.json({ success: true, data: { results, pushedAt: nowIso() } });
  } catch (e) {
    next(e);
  }
});

// GET /api/v1/sync/pull?since=ISO&limit=50&cursor=
// Returns incremental server changes since timestamp, shop-scoped
syncRouter.get('/pull', async (req: AuthenticatedRequest, res, next) => {
  try {
    const shopId = req.auth!.shopId;
    const sinceRaw = (req.query.since as string | undefined)?.trim() ?? (req.query.lastSync as string | undefined)?.trim() ?? (req.query.cursor as string | undefined)?.trim();
    const since = sinceRaw ? new Date(sinceRaw).toISOString() : new Date(0).toISOString();
    const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) ?? '50', 10) || 50));

    // Use updated_at for customers/services/orders, created_at for payments/history
    const customers = await database('customers').where('shop_id', shopId).where('updated_at', '>', since).orderBy('updated_at', 'asc').limit(limit);
    const services = await database('services').where('shop_id', shopId).where('updated_at', '>', since).orderBy('updated_at', 'asc').limit(limit);
    const orders = await database('orders').where('shop_id', shopId).where('updated_at', '>', since).orderBy('updated_at', 'asc').limit(limit);
    const payments = await database('payments').where('shop_id', shopId).where('created_at', '>', since).orderBy('created_at', 'asc').limit(limit);
    const statusHistory = await database('order_status_history')
      .join('orders', 'order_status_history.order_id', 'orders.id')
      .where('orders.shop_id', shopId)
      .where('order_status_history.changed_at', '>', since)
      .select('order_status_history.*')
      .orderBy('order_status_history.changed_at', 'asc')
      .limit(limit);

    // Also include tombstones: where is_deleted=1 and updated_at > since for customers/services/orders/payments
    // Already included via updated_at filter above (since is_deleted doesn't filter)
    // For payments, need to include deleted as well
    const now = nowIso();
    // Compute next cursor as max updated_at among all returned
    const allTimes: string[] = [];
    for (const c of customers) allTimes.push(c.updated_at);
    for (const s of services) allTimes.push(s.updated_at);
    for (const o of orders) allTimes.push(o.updated_at);
    for (const p of payments) allTimes.push((p as any).created_at);
    for (const h of statusHistory) allTimes.push((h as any).changed_at);
    const nextCursor = allTimes.length > 0 ? allTimes.sort().reverse()[0] : since;

    res.json({
      success: true,
      data: {
        customers,
        services,
        orders,
        payments,
        statusHistory,
        nextCursor,
        pulledAt: now,
      },
    });
  } catch (e) {
    next(e);
  }
});

// GET /api/v1/sync/status — quick pending count? Not needed, client computes locally
syncRouter.get('/status', async (req: AuthenticatedRequest, res, next) => {
  try {
    const shopId = req.auth!.shopId;
    const counts = {
      customers: Number((await database('customers').where({ shop_id: shopId, is_deleted: 0 }).count('id as c').first() as any)?.c ?? 0),
      services: Number((await database('services').where({ shop_id: shopId, is_deleted: 0 }).count('id as c').first() as any)?.c ?? 0),
      orders: Number((await database('orders').where({ shop_id: shopId, is_deleted: 0 }).count('id as c').first() as any)?.c ?? 0),
      payments: Number((await database('payments').where({ shop_id: shopId, is_deleted: 0 }).count('id as c').first() as any)?.c ?? 0),
    };
    res.json({ success: true, data: counts });
  } catch (e) {
    next(e);
  }
});
