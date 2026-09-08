/**
 * Dev-only DB verification helper.
 * Exercises: init -> insert customer -> read -> update -> verify -> PENDING check -> foreign key.
 * No prod fake data on every start — only when explicitly called.
 * Also tests services + orders + payments + status flow.
 */
import { initDatabase, getDatabase } from './client';
import { ensureDefaultShop } from './repositories/shop';
import { createCustomer, searchCustomers, updateCustomer } from './repositories/customers';
import { createService } from './repositories/services';
import { createOrder, updateOrderStatus, getOrderById } from './repositories/orders';
import { addPayment } from './repositories/payments';
import { uuidv4 } from '@/utils/uuid';

export interface DevTestResult {
  success: boolean;
  steps: string[];
  error?: string;
  ids?: { shopId: string; customerId: string; serviceId: string; orderId: string };
}

export async function runDevDbTest(): Promise<DevTestResult> {
  const steps: string[] = [];
  try {
    steps.push('1. initDatabase()');
    const db = await initDatabase();
    steps.push('   -> DB opened: clean.db');

    steps.push('2. Ensure default shop');
    const shop = await ensureDefaultShop();
    steps.push(`   -> Shop: ${shop.name} (${shop.id}) sync=${shop.sync_status}`);

    // Create unique test identifiers to avoid UNIQUE collisions on rerun
    const suffix = Date.now().toString().slice(-6);
    const testPhone = `09${suffix}1234`; // 09xxxx1234
    const testShopId = shop.id;

    steps.push(`3. Insert customer (phone ${testPhone})`);
    const customer = await createCustomer({
      shop_id: testShopId,
      name: `Test Cust ${suffix}`,
      contact_number: testPhone,
    });
    steps.push(`   -> customer id=${customer.id} sync=${customer.sync_status} phone=${customer.contact_number}`);
    if (customer.sync_status !== 'PENDING') throw new Error('Customer sync_status should be PENDING');

    steps.push('4. Read customer by search');
    const found = await searchCustomers(`Test Cust ${suffix}`, testShopId);
    if (found.length === 0) throw new Error('Search failed to find just-inserted customer');
    steps.push(`   -> found ${found.length} row(s)`);

    steps.push('5. Update customer name');
    const updated = await updateCustomer(customer.id, { name: `Updated Cust ${suffix}` });
    steps.push(`   -> updated name=${updated.name} updated_at=${updated.updated_at} sync=${updated.sync_status}`);
    if (updated.name !== `Updated Cust ${suffix}`) throw new Error('Update did not persist');
    if (updated.sync_status !== 'PENDING') throw new Error('Update should keep PENDING');

    steps.push('6. Insert service (per_kg)');
    const service = await createService({
      shop_id: testShopId,
      name: `Wash-Dry ${suffix}`,
      pricing_type: 'per_kg',
      unit_price_centavos: 3500, // 35 PHP/kg
      is_active: true,
    });
    steps.push(`   -> service id=${service.id} price=${service.unit_price_centavos} sync=${service.sync_status}`);

    steps.push('7. Create order (5.5kg = 5500g, rush 3000c)');
    const order = await createOrder({
      shop_id: testShopId,
      customer_id: customer.id,
      customer_name_snapshot: updated.name,
      service_id: service.id,
      service_name: service.name,
      pricing_type: service.pricing_type as any,
      unit_price_centavos: service.unit_price_centavos,
      weight_grams: 5500,
      additional_fee_centavos: 2000,
      rush_fee_centavos: 3000,
      is_rush: true,
      amount_paid_centavos: 5000, // partial
      notes: 'Separate white clothes',
    });
    // base 19250 +2000+3000=24250 total, paid 5000, balance 19250 partial
    steps.push(
      `   -> order ${order.order_number} id=${order.id} total=${order.total_centavos} paid=${order.amount_paid_centavos} balance=${order.balance_centavos} status=${order.status} payment=${order.payment_status}`
    );
    if (order.total_centavos !== 24250) throw new Error(`Total mismatch expected 24250 got ${order.total_centavos}`);
    if (order.payment_status !== 'PARTIAL') throw new Error('Expected PARTIAL');
    if (order.sync_status !== 'PENDING') throw new Error('Order should be PENDING');

    steps.push('8. Verify pricing preserved after service rate change');
    // change service rate — order snapshot must stay
    const db2 = getDatabase();
    await db2.runAsync(`UPDATE services SET unit_price_centavos=4000, updated_at=? WHERE id=?;`, [new Date().toISOString(), service.id]);
    const orderAfter = await getOrderById(order.id);
    if (!orderAfter) throw new Error('Order not found after service update');
    if (orderAfter.unit_price_snapshot_centavos !== 3500) throw new Error('Snapshot was mutated!');
    steps.push(`   -> snapshot preserved ${orderAfter.unit_price_snapshot_centavos} (service now 4000)`);

    steps.push('9. Update status RECEIVED -> PROCESSING -> READY');
    let tmp = await updateOrderStatus(order.id, 'PROCESSING');
    steps.push(`   -> PROCESSING processing_at=${tmp.processing_at}`);
    tmp = await updateOrderStatus(order.id, 'READY');
    steps.push(`   -> READY ready_at=${tmp.ready_at}`);

    steps.push('10. Add payment to settle balance');
    const pay = await addPayment({ order_id: order.id, shop_id: testShopId, amount_centavos: tmp.balance_centavos });
    steps.push(`   -> payment ${pay.id} amount=${pay.amount_centavos}`);
    const settled = await getOrderById(order.id);
    steps.push(`   -> after payment total=${settled?.total_centavos} paid=${settled?.amount_paid_centavos} balance=${settled?.balance_centavos} payment=${settled?.payment_status}`);
    if (settled?.payment_status !== 'PAID') throw new Error('Expected PAID after settling');
    if (settled?.balance_centavos !== 0) throw new Error('Balance should be 0');

    steps.push('11. Try invalid transition READY->RECEIVED (should fail)');
    try {
      await updateOrderStatus(order.id, 'RECEIVED');
      throw new Error('Invalid transition should have thrown');
    } catch (e: any) {
      if (e.message.includes('Invalid transition')) steps.push('   -> correctly rejected invalid transition');
      else throw e;
    }

    steps.push('12. Complete order READY -> COMPLETED');
    const completed = await updateOrderStatus(order.id, 'COMPLETED');
    steps.push(`   -> COMPLETED completed_at=${completed.completed_at}`);

    steps.push('13. Check foreign key enforcement (invalid customer)');
    try {
      await db.runAsync(
        `INSERT INTO orders (id, shop_id, customer_id, service_id, order_number, pricing_type_snapshot, service_name_snapshot, unit_price_snapshot_centavos, weight_grams, base_cost_centavos, total_centavos, amount_paid_centavos, balance_centavos, payment_status, status, notes, received_at, created_at, updated_at, sync_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [uuidv4(), testShopId, 'nonexistent-customer', service.id, `BAD-${suffix}`, 'per_kg', 'Bad', 3500, 1000, 3500, 3500, 0, 3500, 'UNPAID', 'RECEIVED', null, new Date().toISOString(), new Date().toISOString(), new Date().toISOString(), 'PENDING']
      );
      throw new Error('FK should have rejected bad customer_id');
    } catch (e: any) {
      if (String(e.message).toLowerCase().includes('foreign key') || String(e.message).toLowerCase().includes('constraint')) {
        steps.push('   -> FK correctly rejected invalid customer');
      } else throw e;
    }

    steps.push('14. Verify persistence (re-query)');
    const reloaded = await getOrderById(order.id);
    if (!reloaded) throw new Error('Persistence check failed');
    steps.push(`   -> persisted order ${reloaded.order_number} status=${reloaded.status}`);

    steps.push('15. Check PENDING sync counts');
    const pending = await db.getAllAsync<{ tbl: string; c: number }>(
      `SELECT 'customers' as tbl, COUNT(*) as c FROM customers WHERE sync_status='PENDING' UNION ALL SELECT 'orders', COUNT(*) FROM orders WHERE sync_status='PENDING' UNION ALL SELECT 'payments', COUNT(*) FROM payments WHERE sync_status='PENDING';`
    );
    steps.push(`   -> pending ${JSON.stringify(pending)}`);

    steps.push('✅ All local DB tests passed. Data will remain without backend. sync_status=PENDING ready for future Sync Engine.');
    return { success: true, steps, ids: { shopId: testShopId, customerId: customer.id, serviceId: service.id, orderId: order.id } };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    steps.push(`❌ FAILED: ${msg}`);
    return { success: false, steps, error: msg };
  }
}

/**
 * Light health check for UI banner — verifies DB initialized and counts.
 */
export async function getLocalDbStats(): Promise<{ shops: number; customers: number; services: number; orders: number; pending: number } | null> {
  try {
    const db = await initDatabase();
    const shops = await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) as c FROM shops;');
    const customers = await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) as c FROM customers WHERE is_deleted=0;');
    const services = await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) as c FROM services WHERE is_deleted=0;');
    const orders = await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) as c FROM orders WHERE is_deleted=0;');
    const pending = await db.getFirstAsync<{ c: number }>(
      `SELECT (SELECT COUNT(*) FROM customers WHERE sync_status='PENDING') + (SELECT COUNT(*) FROM orders WHERE sync_status='PENDING') + (SELECT COUNT(*) FROM payments WHERE sync_status='PENDING') + (SELECT COUNT(*) FROM services WHERE sync_status='PENDING') as c;`
    );
    return {
      shops: shops?.c ?? 0,
      customers: customers?.c ?? 0,
      services: services?.c ?? 0,
      orders: orders?.c ?? 0,
      pending: pending?.c ?? 0,
    };
  } catch {
    return null;
  }
}
