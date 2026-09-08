import { Router } from 'express';
import { database } from '../../database/knex';
import { authMiddleware, type AuthenticatedRequest } from '../../middleware/auth';

export const shopsRouter = Router();

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
