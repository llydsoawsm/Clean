import { initDatabase } from './client';
import { ensureDefaultShop } from './repositories/shop';
import { createCustomer, searchCustomers } from './repositories/customers';
import { createService, listServices } from './repositories/services';

/**
 * Non-destructive demo seed helper (manual dev use only).
 * Never deletes existing orders or payments.
 */
export async function ensureSeedData(): Promise<void> {
  await initDatabase();
  const shop = await ensureDefaultShop();

  const services = await listServices(shop.id, true);
  if (services.length === 0) {
    await createService({
      shop_id: shop.id,
      name: 'Wash & Fold',
      pricing_type: 'per_kg',
      unit_price_centavos: 3500,
      description: 'Standard washing, drying and folding',
    });
    await createService({
      shop_id: shop.id,
      name: 'Dry Cleaning',
      pricing_type: 'per_piece',
      unit_price_centavos: 15000,
      description: 'Delicate garments pressed on hanger',
    });
    await createService({
      shop_id: shop.id,
      name: 'Bedding & Comforter',
      pricing_type: 'per_load',
      unit_price_centavos: 18000,
      weight_block_grams: 8000,
      description: 'Up to 8kg per load',
    });
  }

  const customers = await searchCustomers('', shop.id);
  if (customers.length === 0) {
    await createCustomer({
      shop_id: shop.id,
      name: 'Maria Santos',
      contact_number: '0917-123-4567',
      address: 'Block 4, Lot 12, Sunrise Village',
      notes: 'Prefers mild detergent',
    });
    await createCustomer({
      shop_id: shop.id,
      name: 'Juan Dela Cruz',
      contact_number: '0918-987-6543',
      address: '124 Rizal Ave, Barangay 5',
      notes: 'Weekly drop-off regular',
    });
  }
}
