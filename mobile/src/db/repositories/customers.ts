/**
 * Customers repository — offline-first.
 * Search by name/phone, unique contact per shop, sync_status handling.
 */
import { getDatabase } from '../client';
import type { CustomerRow } from '../types';
import { uuidv4 } from '@/utils/uuid';
import { nowIso } from '@/utils/dates';

export interface CreateCustomerInput {
  shop_id?: string | null;
  name: string;
  contact_number: string; // required unique
  address?: string | null;
  notes?: string | null;
}

export async function createCustomer(input: CreateCustomerInput): Promise<CustomerRow> {
  const db = getDatabase();
  // Ensure shop exists for FK before insert (offline-first safety)
  if (input.shop_id) {
    const { ensureShopExists } = await import('./shop');
    await ensureShopExists(input.shop_id);
  }
  const id = uuidv4();
  const now = nowIso();
  const cleanPhone = input.contact_number.trim();
  const cleanName = input.name.trim();
  const cleanAddress = input.address?.trim() || null;
  const cleanNotes = input.notes?.trim() || null;

  if (!cleanName) throw new Error('Customer name is required');
  if (!cleanPhone) throw new Error('Contact number is required');
  // basic contact validation 7-20 chars, digits + - () space
  if (!/^[0-9+\-\s()]{7,20}$/.test(cleanPhone)) throw new Error('Invalid contact number format');

  try {
    await db.runAsync(
      `INSERT INTO customers (id, shop_id, name, contact_number, address, notes, first_transaction_at, last_visit_at, transaction_count, created_at, updated_at, sync_status, last_synced_at, is_deleted)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 'PENDING', NULL, 0);`,
      [id, input.shop_id ?? null, cleanName, cleanPhone, cleanAddress, cleanNotes, now, now, now, now]
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('UNIQUE') || msg.includes('unique')) {
      throw new Error(`Customer with contact ${cleanPhone} already exists`);
    }
    throw e;
  }

  const row = await db.getFirstAsync<CustomerRow>('SELECT * FROM customers WHERE id=?;', [id]);
  if (!row) throw new Error('Failed to create customer');
  return row;
}

export async function getCustomerById(id: string): Promise<CustomerRow | null> {
  const db = getDatabase();
  return (await db.getFirstAsync<CustomerRow>('SELECT * FROM customers WHERE id=? AND is_deleted=0;', [id])) ?? null;
}

export async function getCustomerByPhone(contactNumber: string, shopId?: string | null): Promise<CustomerRow | null> {
  const db = getDatabase();
  const phone = contactNumber.trim();
  if (shopId) {
    return (
      (await db.getFirstAsync<CustomerRow>(
        'SELECT * FROM customers WHERE contact_number=? AND shop_id=? AND is_deleted=0 LIMIT 1;',
        [phone, shopId]
      )) ?? null
    );
  }
  return (await db.getFirstAsync<CustomerRow>('SELECT * FROM customers WHERE contact_number=? AND is_deleted=0 LIMIT 1;', [phone])) ?? null;
}

export async function searchCustomers(query: string, shopId?: string | null): Promise<CustomerRow[]> {
  const db = getDatabase();
  const q = `%${query.trim()}%`;
  if (!query.trim()) {
    // recent 20
    if (shopId) {
      return await db.getAllAsync<CustomerRow>(
        'SELECT * FROM customers WHERE shop_id=? AND is_deleted=0 ORDER BY updated_at DESC LIMIT 20;',
        [shopId]
      );
    }
    return await db.getAllAsync<CustomerRow>('SELECT * FROM customers WHERE is_deleted=0 ORDER BY updated_at DESC LIMIT 20;');
  }
  if (shopId) {
    return await db.getAllAsync<CustomerRow>(
      `SELECT * FROM customers WHERE shop_id=? AND is_deleted=0 AND (name LIKE ? OR contact_number LIKE ?) ORDER BY updated_at DESC LIMIT 20;`,
      [shopId, q, q]
    );
  }
  return await db.getAllAsync<CustomerRow>(
    `SELECT * FROM customers WHERE is_deleted=0 AND (name LIKE ? OR contact_number LIKE ?) ORDER BY updated_at DESC LIMIT 20;`,
    [q, q]
  );
}

export async function updateCustomer(
  id: string,
  patch: Partial<Pick<CustomerRow, 'name' | 'contact_number' | 'address' | 'notes'>>
): Promise<CustomerRow> {
  const db = getDatabase();
  const now = nowIso();
  const existing = await getCustomerById(id);
  if (!existing) throw new Error('Customer not found');

  const newName = patch.name !== undefined ? patch.name.trim() : existing.name;
  const newPhone = patch.contact_number !== undefined ? patch.contact_number.trim() : existing.contact_number;
  const newAddress = patch.address !== undefined ? (patch.address?.trim() || null) : existing.address;
  const newNotes = patch.notes !== undefined ? (patch.notes?.trim() || null) : existing.notes;

  if (!newName) throw new Error('Customer name is required');
  if (!/^[0-9+\-\s()]{7,20}$/.test(newPhone)) throw new Error('Invalid contact number format');

  await db.runAsync(
    `UPDATE customers SET name=?, contact_number=?, address=?, notes=?, updated_at=?, sync_status='PENDING' WHERE id=?;`,
    [newName, newPhone, newAddress, newNotes, now, id]
  );
  const updated = await getCustomerById(id);
  if (!updated) throw new Error('Update failed');
  return updated;
}

export async function deleteCustomer(id: string): Promise<void> {
  const db = getDatabase();
  const now = nowIso();
  await db.runAsync(`UPDATE customers SET is_deleted=1, updated_at=?, sync_status='PENDING' WHERE id=?;`, [now, id]);
  // Note: we soft-delete so FK orders remain. Hard FK RESTRICT protects accidental delete via CASCADE.
}

export async function getPendingCustomers(): Promise<CustomerRow[]> {
  const db = getDatabase();
  return await db.getAllAsync<CustomerRow>(`SELECT * FROM customers WHERE sync_status IN ('PENDING','FAILED');`);
}

export async function markCustomersSynced(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const db = getDatabase();
  const now = nowIso();
  const placeholders = ids.map(() => '?').join(',');
  await db.runAsync(`UPDATE customers SET sync_status='SYNCED', last_synced_at=? WHERE id IN (${placeholders});`, [now, ...ids]);
}
