import { getDatabase, initDatabase } from './client';
import { ensureDefaultShop } from './repositories/shop';
import { createCustomer, searchCustomers } from './repositories/customers';
import { createService, listServices } from './repositories/services';
import { createOrder, listOrders } from './repositories/orders';
import { addPayment } from './repositories/payments';

export async function ensureSeedData(): Promise<void> {
  await initDatabase();
  const shop = await ensureDefaultShop();

  // Check if services exist
  const services = await listServices(shop.id, true);
  let s1Id = services[0]?.id;
  let s2Id = services[1]?.id;
  let s3Id = services[2]?.id;

  if (services.length === 0) {
    const s1 = await createService({
      shop_id: shop.id,
      name: 'Wash & Fold',
      pricing_type: 'per_kg',
      unit_price_centavos: 3500,
      description: 'Standard washing, drying and folding',
    });
    const s2 = await createService({
      shop_id: shop.id,
      name: 'Dry Cleaning',
      pricing_type: 'per_piece',
      unit_price_centavos: 15000,
      description: 'Delicate garments pressed on hanger',
    });
    const s3 = await createService({
      shop_id: shop.id,
      name: 'Bedding & Comforter',
      pricing_type: 'per_load',
      unit_price_centavos: 18000,
      weight_block_grams: 8000,
      description: 'Up to 8kg per load',
    });
    s1Id = s1.id;
    s2Id = s2.id;
    s3Id = s3.id;
  }

  // Check if customers exist
  const customers = await searchCustomers('', shop.id);
  let c1Id = customers[0]?.id;
  let c2Id = customers[1]?.id;

  if (customers.length === 0) {
    const c1 = await createCustomer({
      shop_id: shop.id,
      name: 'Maria Santos',
      contact_number: '0917-123-4567',
      address: 'Block 4, Lot 12, Sunrise Village',
      notes: 'Prefers mild detergent',
    });
    const c2 = await createCustomer({
      shop_id: shop.id,
      name: 'Juan Dela Cruz',
      contact_number: '0918-987-6543',
      address: '124 Rizal Ave, Barangay 5',
      notes: 'Weekly drop-off regular',
    });
    await createCustomer({
      shop_id: shop.id,
      name: 'Ana Reyes',
      contact_number: '0922-333-4444',
      address: 'Unit 302, Green Residences',
      notes: 'Call upon arrival for pickup',
    });
    await createCustomer({
      shop_id: shop.id,
      name: 'Carlos Gomez',
      contact_number: '0919-555-6677',
      address: '77 Mabini St',
      notes: 'Rush wash regular',
    });
    c1Id = c1.id;
    c2Id = c2.id;
  }

  // Truncate orders and payments in SQLite database
  const db = getDatabase();
  try {
    await db.execAsync('DELETE FROM payments;');
    await db.execAsync('DELETE FROM orders;');
  } catch {
    // ignore if table doesn't exist yet
  }
}
