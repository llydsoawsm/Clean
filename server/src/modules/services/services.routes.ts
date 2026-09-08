import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { database } from '../../database/knex';
import { authMiddleware, type AuthenticatedRequest } from '../../middleware/auth';
import { createServiceSchema, updateServiceSchema } from './services.schemas';

export const servicesRouter = Router();
servicesRouter.use(authMiddleware);

function nowIso(): string {
  return new Date().toISOString();
}

function toCentavos(price: number): number {
  return Math.round(price * 100);
}
function fromCentavos(cents: number): number {
  return cents / 100;
}

// GET /api/v1/services?includeInactive=true
servicesRouter.get('/', async (req: AuthenticatedRequest, res, next) => {
  try {
    const shopId = req.auth!.shopId;
    const includeInactive = (req.query.includeInactive as string) === 'true';
    let query = database('services').where({ shop_id: shopId, is_deleted: 0 });
    if (!includeInactive) query = query.where({ is_active: 1 });
    const rows = await query.orderBy('service_name', 'asc');
    // map price_centavos -> price for display, keep both
    const mapped = rows.map((r: Record<string, unknown>) => ({
      ...r,
      price: fromCentavos(r.price_centavos as number),
    }));
    res.json({ success: true, data: { services: mapped } });
  } catch (e) {
    next(e);
  }
});

servicesRouter.get('/:id', async (req: AuthenticatedRequest, res, next) => {
  try {
    const shopId = req.auth!.shopId;
    const { id } = req.params as { id: string };
    const row = await database('services').where({ id, shop_id: shopId, is_deleted: 0 }).first();
    if (!row) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Service not found' } });
      return;
    }
    res.json({ success: true, data: { service: { ...row, price: fromCentavos(row.price_centavos as number) } } });
  } catch (e) {
    next(e);
  }
});

servicesRouter.post('/', async (req: AuthenticatedRequest, res, next) => {
  try {
    const shopId = req.auth!.shopId;
    // coerce price if string
    if (typeof req.body.price === 'string') req.body.price = parseFloat(req.body.price);
    if (typeof req.body.weight_block_kg === 'string') req.body.weight_block_kg = parseFloat(req.body.weight_block_kg);
    if (typeof req.body.weight_block_grams === 'string') req.body.weight_block_grams = parseInt(req.body.weight_block_grams, 10);
    const parsed = createServiceSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input' } });
      return;
    }
    const now = nowIso();
    const id = randomUUID();
    const { service_name, pricing_type, price, description, is_active } = parsed.data;
    const price_centavos = toCentavos(price);
    // weight block for PER_LOAD: prefer weight_block_grams, else weight_block_kg*1000, else default 8000
    let weightBlockGrams: number | null = null;
    if (pricing_type === 'PER_LOAD') {
      if (parsed.data.weight_block_grams != null) weightBlockGrams = parsed.data.weight_block_grams;
      else if (parsed.data.weight_block_kg != null) weightBlockGrams = Math.round(parsed.data.weight_block_kg * 1000);
      else weightBlockGrams = 8000;
      if (weightBlockGrams < 1000 || weightBlockGrams > 50000) {
        res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Weight block must be 1-50 kg' } });
        return;
      }
    }

    try {
      await database('services').insert({
        id,
        shop_id: shopId,
        service_name: service_name.trim(),
        pricing_type,
        price_centavos,
        weight_block_grams: weightBlockGrams,
        description: description?.trim() || null,
        is_active: is_active ? 1 : 0,
        created_at: now,
        updated_at: now,
        is_deleted: 0,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('UNIQUE')) {
        res.status(409).json({ success: false, error: { code: 'DUPLICATE', message: 'Service name already exists for this shop' } });
        return;
      }
      throw err;
    }

    const created = await database('services').where({ id }).first();
    res.status(201).json({ success: true, data: { service: { ...created, price: fromCentavos(created.price_centavos as number) } } });
  } catch (e) {
    next(e);
  }
});

servicesRouter.patch('/:id', async (req: AuthenticatedRequest, res, next) => {
  try {
    const shopId = req.auth!.shopId;
    const { id } = req.params as { id: string };
    if (typeof req.body.price === 'string') req.body.price = parseFloat(req.body.price);
    if (typeof req.body.weight_block_kg === 'string') req.body.weight_block_kg = parseFloat(req.body.weight_block_kg);
    if (typeof req.body.weight_block_grams === 'string') req.body.weight_block_grams = parseInt(req.body.weight_block_grams, 10);
    const parsed = updateServiceSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input' } });
      return;
    }

    const existing = await database('services').where({ id, shop_id: shopId, is_deleted: 0 }).first();
    if (!existing) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Service not found' } });
      return;
    }

    const patch = parsed.data;
    const nextRow: Record<string, unknown> = { updated_at: nowIso() };
    if (patch.service_name !== undefined) nextRow.service_name = patch.service_name.trim();
    if (patch.pricing_type !== undefined) nextRow.pricing_type = patch.pricing_type;
    if (patch.price !== undefined) nextRow.price_centavos = toCentavos(patch.price);
    if (patch.description !== undefined) nextRow.description = patch.description?.trim() || null;
    if (patch.is_active !== undefined) nextRow.is_active = patch.is_active ? 1 : 0;
    // weight block handling
    if (patch.weight_block_grams !== undefined || patch.weight_block_kg !== undefined) {
      let block: number | null = null;
      if (patch.weight_block_grams != null) block = patch.weight_block_grams;
      else if (patch.weight_block_kg != null) block = Math.round(patch.weight_block_kg * 1000);
      nextRow.weight_block_grams = block;
    } else if (patch.pricing_type === 'PER_LOAD' && !existing.weight_block_grams) {
      // ensure per_load has default block if switching to per_load without block
      nextRow.weight_block_grams = 8000;
    }

    try {
      await database('services').where({ id }).update(nextRow);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('UNIQUE')) {
        res.status(409).json({ success: false, error: { code: 'DUPLICATE', message: 'Service name already exists' } });
        return;
      }
      throw err;
    }

    const updated = await database('services').where({ id }).first();
    res.json({ success: true, data: { service: { ...updated, price: fromCentavos(updated.price_centavos as number) } } });
  } catch (e) {
    next(e);
  }
});

servicesRouter.delete('/:id', async (req: AuthenticatedRequest, res, next) => {
  try {
    const shopId = req.auth!.shopId;
    const { id } = req.params as { id: string };
    const existing = await database('services').where({ id, shop_id: shopId }).first();
    if (!existing) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Service not found' } });
      return;
    }
    if (existing.is_deleted) {
      res.json({ success: true, data: { service: existing } });
      return;
    }
    await database('services').where({ id }).update({ is_deleted: 1, is_active: 0, updated_at: nowIso() });
    const updated = await database('services').where({ id }).first();
    res.json({ success: true, data: { service: updated } });
  } catch (e) {
    next(e);
  }
});
