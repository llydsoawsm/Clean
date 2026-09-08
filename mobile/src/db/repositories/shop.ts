/**
 * Shop repository — single shop per device (MVP).
 * Shop provides sync tenant id and default rush fee.
 */
import { getDatabase } from '../client';
import type { ShopRow } from '../types';
import { uuidv4 } from '@/utils/uuid';
import { nowIso } from '@/utils/dates';

export async function getShop(): Promise<ShopRow | null> {
  const db = getDatabase();
  return (await db.getFirstAsync<ShopRow>('SELECT * FROM shops LIMIT 1;')) ?? null;
}

export async function upsertShop(data: {
  id?: string;
  name: string;
  owner_name?: string | null;
  contact_number?: string | null;
  address?: string | null;
  currency?: string;
  rush_fee_centavos?: number;
}): Promise<ShopRow> {
  const db = getDatabase();
  const now = nowIso();

  // Try to find existing shop by the specific id if provided
  let existing: ShopRow | null = null;
  if (data.id) {
    existing = (await db.getFirstAsync<ShopRow>('SELECT * FROM shops WHERE id=?;', [data.id])) ?? null;
  }
  // Fallback to any shop (single-shop MVP)
  if (!existing) {
    existing = await getShop();
  }

  // If we found a shop with the same id, update it
  if (existing && data.id && existing.id === data.id) {
    await db.runAsync(
      `UPDATE shops SET name=?, owner_name=?, contact_number=?, address=?, currency=?, rush_fee_centavos=?, updated_at=?, sync_status='PENDING' WHERE id=?;`,
      [
        data.name,
        data.owner_name ?? existing.owner_name,
        data.contact_number ?? existing.contact_number,
        data.address ?? existing.address,
        data.currency ?? existing.currency,
        data.rush_fee_centavos ?? existing.rush_fee_centavos,
        now,
        existing.id,
      ]
    );
    const updated = await db.getFirstAsync<ShopRow>('SELECT * FROM shops WHERE id=?;', [existing.id]);
    if (!updated) throw new Error('Failed to update shop');
    return updated;
  }

  // If we found a different shop (LIMIT 1) and data.id is different, we need to handle shop switch (e.g., logout/login with different shop)
  // For MVP single-shop, we can update the existing shop's id to match the new shop's id by inserting new and keeping old? Simpler: insert new shop with data.id, keep old? But MVP expects single shop, so we update the existing shop's id via delete+insert or just insert new
  // To preserve FK integrity, we need the exact shop id that authenticated session uses to exist
  if (data.id) {
    // Check if a shop with data.id already exists (we already checked, it doesn't)
    // If there's an existing shop with different id, we should ensure the new shop exists
    // Insert the new shop; keep old for now (will be orphan but FK for old customers still valid via old id)
    // For single-shop, we can just insert new shop if not exists
    const id = data.id;
    await db.runAsync(
      `INSERT OR REPLACE INTO shops (id, name, owner_name, contact_number, address, currency, rush_fee_centavos, created_at, updated_at, sync_status, last_synced_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT created_at FROM shops WHERE id=?), ?), ?, 'PENDING', NULL);`,
      [id, data.name, data.owner_name ?? null, data.contact_number ?? null, data.address ?? null, data.currency ?? 'PHP', data.rush_fee_centavos ?? 0, id, now, now]
    );
    const created = await db.getFirstAsync<ShopRow>('SELECT * FROM shops WHERE id=?;', [id]);
    if (!created) throw new Error('Failed to create shop');
    return created;
  }

  // No id provided, fallback to existing or new
  if (existing) {
    await db.runAsync(
      `UPDATE shops SET name=?, owner_name=?, contact_number=?, address=?, currency=?, rush_fee_centavos=?, updated_at=?, sync_status='PENDING' WHERE id=?;`,
      [
        data.name,
        data.owner_name ?? existing.owner_name,
        data.contact_number ?? existing.contact_number,
        data.address ?? existing.address,
        data.currency ?? existing.currency,
        data.rush_fee_centavos ?? existing.rush_fee_centavos,
        now,
        existing.id,
      ]
    );
    const updated = await getShop();
    if (!updated) throw new Error('Failed to update shop');
    return updated;
  }

  const id = uuidv4();
  await db.runAsync(
    `INSERT INTO shops (id, name, owner_name, contact_number, address, currency, rush_fee_centavos, created_at, updated_at, sync_status, last_synced_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', NULL);`,
    [id, data.name, data.owner_name ?? null, data.contact_number ?? null, data.address ?? null, data.currency ?? 'PHP', data.rush_fee_centavos ?? 0, now, now]
  );
  const created = await getShop();
  if (!created) throw new Error('Failed to create shop');
  return created;
}

export async function ensureDefaultShop(): Promise<ShopRow> {
  const existing = await getShop();
  if (existing) return existing;
  return upsertShop({ name: 'Clean Laundry Shop', currency: 'PHP', rush_fee_centavos: 0 });
}

export async function ensureShopExists(shopId: string): Promise<void> {
  const db = getDatabase();
  const existing = await db.getFirstAsync<ShopRow>('SELECT * FROM shops WHERE id=?;', [shopId]);
  if (existing) return;
  // Create minimal shop row to satisfy FK for offline customer/service/order creation
  // This will be updated later when real shop data is synced via AuthContext
  const now = nowIso();
  try {
    await db.runAsync(
      `INSERT INTO shops (id, name, owner_name, contact_number, address, currency, rush_fee_centavos, created_at, updated_at, sync_status, last_synced_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', NULL);`,
      [shopId, 'Clean Shop', null, null, null, 'PHP', 0, now, now]
    );
  } catch {}
}
