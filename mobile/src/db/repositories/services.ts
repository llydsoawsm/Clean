/**
 * Services repository.
 * Supports per_kg / per_piece / fixed pricing.
 */
import { getDatabase } from '../client';
import type { ServiceRow, PricingType } from '../types';
import { uuidv4 } from '@/utils/uuid';
import { nowIso } from '@/utils/dates';

export interface CreateServiceInput {
  shop_id?: string | null;
  name: string;
  pricing_type: PricingType;
  unit_price_centavos: number;
  description?: string | null;
  weight_block_grams?: number | null;
  is_active?: boolean;
}

export async function createService(input: CreateServiceInput): Promise<ServiceRow> {
  const db = getDatabase();
  if (input.shop_id) {
    const { ensureShopExists } = await import('./shop');
    await ensureShopExists(input.shop_id);
  }
  const id = uuidv4();
  const now = nowIso();
  const name = input.name.trim();
  const desc = input.description?.trim() || null;
  if (!name) throw new Error('Service name required');
  if (input.unit_price_centavos < 0) throw new Error('Price must be >=0');
  if (!['per_kg', 'per_piece', 'fixed', 'per_load'].includes(input.pricing_type)) throw new Error('Invalid pricing_type');
  const weightBlock = input.pricing_type === 'per_load' ? (input.weight_block_grams ?? 8000) : null;
  if (input.pricing_type === 'per_load' && (!weightBlock || weightBlock < 1000 || weightBlock > 50000)) throw new Error('Weight block must be 1-50 kg');

  try {
    await db.runAsync(
      `INSERT INTO services (id, shop_id, name, pricing_type, unit_price_centavos, description, weight_block_grams, is_active, created_at, updated_at, sync_status, last_synced_at, is_deleted)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', NULL, 0);`,
      [id, input.shop_id ?? null, name, input.pricing_type, input.unit_price_centavos, desc, weightBlock, input.is_active === false ? 0 : 1, now, now]
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('UNIQUE')) throw new Error(`Service "${name}" already exists`);
    throw e;
  }
  const row = await db.getFirstAsync<ServiceRow>('SELECT * FROM services WHERE id=?;', [id]);
  if (!row) throw new Error('Failed to create service');
  return row;
}

export async function getServiceById(id: string): Promise<ServiceRow | null> {
  const db = getDatabase();
  return (await db.getFirstAsync<ServiceRow>('SELECT * FROM services WHERE id=? AND is_deleted=0;', [id])) ?? null;
}

export async function listServices(shopId?: string | null, includeInactive = false): Promise<ServiceRow[]> {
  const db = getDatabase();
  const activeFilter = includeInactive ? '' : 'AND is_active=1';
  if (shopId) {
    return await db.getAllAsync<ServiceRow>(
      `SELECT * FROM services WHERE shop_id=? AND is_deleted=0 ${activeFilter} ORDER BY name ASC;`,
      [shopId]
    );
  }
  return await db.getAllAsync<ServiceRow>(`SELECT * FROM services WHERE is_deleted=0 ${activeFilter} ORDER BY name ASC;`);
}

export async function updateService(
  id: string,
  patch: Partial<Pick<ServiceRow, 'name' | 'pricing_type' | 'unit_price_centavos' | 'description' | 'weight_block_grams' | 'is_active'>>
): Promise<ServiceRow> {
  const db = getDatabase();
  const now = nowIso();
  const existing = await getServiceById(id);
  if (!existing) throw new Error('Service not found');

  const nextName = patch.name !== undefined ? patch.name.trim() : existing.name;
  const nextType = (patch.pricing_type as PricingType) ?? existing.pricing_type;
  const nextPrice = patch.unit_price_centavos ?? existing.unit_price_centavos;
  const nextDesc = patch.description !== undefined ? (patch.description?.trim() || null) : existing.description;
  const nextBlock = patch.weight_block_grams !== undefined ? patch.weight_block_grams : existing.weight_block_grams;
  const nextActive = patch.is_active !== undefined ? patch.is_active : existing.is_active;

  if (!nextName) throw new Error('Service name required');
  if (nextPrice < 0) throw new Error('Price must be >=0');
  if (!['per_kg', 'per_piece', 'fixed', 'per_load'].includes(nextType)) throw new Error('Invalid pricing_type');
  if (nextType === 'per_load' && (!nextBlock || nextBlock < 1000 || nextBlock > 50000)) throw new Error('Weight block must be 1-50 kg');

  await db.runAsync(
    `UPDATE services SET name=?, pricing_type=?, unit_price_centavos=?, description=?, weight_block_grams=?, is_active=?, updated_at=?, sync_status='PENDING' WHERE id=?;`,
    [nextName, nextType, nextPrice, nextDesc, nextBlock, nextActive, now, id]
  );
  const updated = await getServiceById(id);
  if (!updated) throw new Error('Update failed');
  return updated;
}

/**
 * Do not hard-delete if referenced by orders. Soft-delete and deactivate.
 */
export async function deactivateService(id: string): Promise<void> {
  const db = getDatabase();
  const now = nowIso();
  await db.runAsync(`UPDATE services SET is_active=0, updated_at=?, sync_status='PENDING' WHERE id=?;`, [now, id]);
}

export async function softDeleteService(id: string): Promise<void> {
  const db = getDatabase();
  const now = nowIso();
  await db.runAsync(`UPDATE services SET is_deleted=1, is_active=0, updated_at=?, sync_status='PENDING' WHERE id=?;`, [now, id]);
}

export async function getPendingServices(): Promise<ServiceRow[]> {
  const db = getDatabase();
  return await db.getAllAsync<ServiceRow>(`SELECT * FROM services WHERE sync_status IN ('PENDING','FAILED');`);
}
