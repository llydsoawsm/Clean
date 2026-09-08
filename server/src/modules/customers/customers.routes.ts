import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { database } from '../../database/knex';
import { authMiddleware, type AuthenticatedRequest } from '../../middleware/auth';
import { createCustomerSchema, updateCustomerSchema } from './customers.schemas';

export const customersRouter = Router();
customersRouter.use(authMiddleware);

function nowIso(): string {
  return new Date().toISOString();
}

// GET /api/v1/customers?search=&limit=20&offset=0
customersRouter.get('/', async (req: AuthenticatedRequest, res, next) => {
  try {
    const shopId = req.auth!.shopId;
    const search = (req.query.search as string | undefined)?.trim() ?? '';
    const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) ?? '20', 10) || 20));
    const offset = Math.max(0, parseInt((req.query.offset as string) ?? '0', 10) || 0);

    let query = database('customers').where({ shop_id: shopId, is_deleted: 0 });

    if (search) {
      const like = `%${search}%`;
      query = query.where(function () {
        this.where('name', 'like', like).orWhere('contact_number', 'like', like);
      });
    }

    const rows = await query.orderBy('updated_at', 'desc').limit(limit).offset(offset);
    res.json({ success: true, data: { customers: rows } });
  } catch (e) {
    next(e);
  }
});

customersRouter.get('/:id', async (req: AuthenticatedRequest, res, next) => {
  try {
    const shopId = req.auth!.shopId;
    const { id } = req.params as { id: string };
    const row = await database('customers').where({ id, shop_id: shopId, is_deleted: 0 }).first();
    if (!row) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } });
      return;
    }
    res.json({ success: true, data: { customer: row } });
  } catch (e) {
    next(e);
  }
});

customersRouter.post('/', async (req: AuthenticatedRequest, res, next) => {
  try {
    const shopId = req.auth!.shopId;
    const parsed = createCustomerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input' } });
      return;
    }

    const now = nowIso();
    const id = randomUUID();
    const data = parsed.data;

    try {
      await database('customers').insert({
        id,
        shop_id: shopId,
        name: data.name.trim(),
        contact_number: data.contact_number.trim(),
        address: data.address?.trim() || null,
        notes: data.notes?.trim() || null,
        created_at: now,
        updated_at: now,
        is_deleted: 0,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('UNIQUE')) {
        res.status(409).json({ success: false, error: { code: 'DUPLICATE', message: 'Contact number already exists for this shop' } });
        return;
      }
      throw err;
    }

    const created = await database('customers').where({ id }).first();
    res.status(201).json({ success: true, data: { customer: created } });
  } catch (e) {
    next(e);
  }
});

customersRouter.patch('/:id', async (req: AuthenticatedRequest, res, next) => {
  try {
    const shopId = req.auth!.shopId;
    const { id } = req.params as { id: string };
    const parsed = updateCustomerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input' } });
      return;
    }

    const existing = await database('customers').where({ id, shop_id: shopId, is_deleted: 0 }).first();
    if (!existing) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } });
      return;
    }

    const patch = parsed.data;
    const nextRow: Record<string, unknown> = {
      updated_at: nowIso(),
    };
    if (patch.name !== undefined) nextRow.name = patch.name.trim();
    if (patch.contact_number !== undefined) nextRow.contact_number = patch.contact_number.trim();
    if (patch.address !== undefined) nextRow.address = patch.address?.trim() || null;
    if (patch.notes !== undefined) nextRow.notes = patch.notes?.trim() || null;

    if (Object.keys(nextRow).length === 1) {
      // only updated_at
      res.json({ success: true, data: { customer: existing } });
      return;
    }

    try {
      await database('customers').where({ id }).update(nextRow);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('UNIQUE')) {
        res.status(409).json({ success: false, error: { code: 'DUPLICATE', message: 'Contact number already exists' } });
        return;
      }
      throw err;
    }

    const updated = await database('customers').where({ id }).first();
    res.json({ success: true, data: { customer: updated } });
  } catch (e) {
    next(e);
  }
});

customersRouter.delete('/:id', async (req: AuthenticatedRequest, res, next) => {
  try {
    const shopId = req.auth!.shopId;
    const { id } = req.params as { id: string };
    const existing = await database('customers').where({ id, shop_id: shopId }).first();
    if (!existing) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } });
      return;
    }
    if (existing.is_deleted) {
      res.json({ success: true, data: { customer: existing } });
      return;
    }
    // Check historical orders: if customer has orders, allow soft-delete but warn via tombstone
    // We allow soft-delete even with history (historical orders remain readable via snapshot)
    await database('customers').where({ id }).update({ is_deleted: 1, updated_at: nowIso() });
    const updated = await database('customers').where({ id }).first();
    res.json({ success: true, data: { customer: updated } });
  } catch (e) {
    next(e);
  }
});
