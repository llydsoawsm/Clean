import { Router } from 'express';
import { z } from 'zod';
import { database } from '../../database/knex';
import { authMiddleware, type AuthenticatedRequest } from '../../middleware/auth';

export const shopsRouter = Router();

const updateShopSchema = z.object({
  name: z.string().trim().min(2, 'Shop name must be at least 2 characters').max(100).optional(),
  owner_name: z.string().trim().max(100).nullable().optional(),
  contact_number: z.string().trim().max(30).nullable().optional(),
  address: z.string().trim().max(250).nullable().optional(),
  rush_fee_centavos: z.number().int().min(0).max(10_000_000).optional(),
});

// All shop routes require auth and ownership
shopsRouter.use(authMiddleware);

shopsRouter.get('/me', async (req: AuthenticatedRequest, res, next) => {
  try {
    const auth = req.auth;
    if (!auth) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      return;
    }

    const shop = await database('shops').where({ id: auth.shopId }).first();
    if (!shop) {
      res.status(404).json({ success: false, error: { code: 'SHOP_NOT_FOUND', message: 'Shop not found' } });
      return;
    }

    res.json({
      success: true,
      data: { shop },
    });
  } catch (error) {
    next(error);
  }
});

shopsRouter.patch('/me', async (req: AuthenticatedRequest, res, next) => {
  try {
    const shopId = req.auth!.shopId;
    const parsed = updateShopSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input' },
      });
      return;
    }

    const existing = await database('shops').where({ id: shopId }).first();
    if (!existing) {
      res.status(404).json({ success: false, error: { code: 'SHOP_NOT_FOUND', message: 'Shop not found' } });
      return;
    }

    const patch = parsed.data;
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.name !== undefined) updates.name = patch.name.trim();
    if (patch.owner_name !== undefined) updates.owner_name = patch.owner_name?.trim() || null;
    if (patch.contact_number !== undefined) updates.contact_number = patch.contact_number?.trim() || null;
    if (patch.address !== undefined) updates.address = patch.address?.trim() || null;
    if (patch.rush_fee_centavos !== undefined) updates.rush_fee_centavos = patch.rush_fee_centavos;

    if (Object.keys(updates).length > 1) {
      await database('shops').where({ id: shopId }).update(updates);
    }

    const shop = await database('shops').where({ id: shopId }).first();
    res.json({ success: true, data: { shop } });
  } catch (error) {
    next(error);
  }
});
