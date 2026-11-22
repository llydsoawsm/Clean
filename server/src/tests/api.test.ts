import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { Server } from 'node:http';
import { randomUUID } from 'node:crypto';

// Configure isolated test environment BEFORE importing app/database
const tmpDir = path.join(os.tmpdir(), `clean-api-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
const testDbPath = path.join(tmpDir, 'test.sqlite');
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = testDbPath;
process.env.JWT_SECRET = 'test-secret-key-for-automated-suite-32chars!';
process.env.PORT = '3000';

let server: Server;
let baseUrl = '';
let databaseRef: typeof import('../database/knex').database;

async function req(
  method: string,
  urlPath: string,
  opts?: { token?: string; body?: unknown }
): Promise<{ status: number; json: any }> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (opts?.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts?.body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${baseUrl}${urlPath}`, {
    method,
    headers,
    body: opts?.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const json = await res.json();
  return { status: res.status, json };
}

before(async () => {
  await fs.mkdir(tmpDir, { recursive: true });
  const { database } = await import('../database/knex');
  const { app } = await import('../app');
  databaseRef = database;

  await database.migrate.latest({
    directory: path.resolve(__dirname, '../database/migrations'),
  });

  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (addr && typeof addr === 'object') {
        baseUrl = `http://127.0.0.1:${addr.port}/api/v1`;
      }
      resolve();
    });
  });
});

after(async () => {
  if (server) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  if (databaseRef) {
    await databaseRef.destroy();
  }
  await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
});

test('Health check & security headers', async () => {
  const res = await fetch(`${baseUrl}/health`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(res.headers.get('x-frame-options'), 'DENY');
  const body = (await res.json()) as any;
  assert.equal(body.success, true);
  assert.equal(body.data.database, 'connected');
});

test('Full end-to-end flow: Auth, Shops, Soft-Delete Uniques, Orders, Payments, Reports, Shop Isolation & Sync', async () => {
  // 1. Register two independent shops
  const regA = await req('POST', '/auth/register', {
    body: { shopName: 'Alpha Laundry', ownerName: 'Alice', email: 'alice@test.com', password: 'password123' },
  });
  assert.equal(regA.status, 201);
  const tokenA = regA.json.data.token as string;
  const shopA = regA.json.data.shop.id as string;

  const regB = await req('POST', '/auth/register', {
    body: { shopName: 'Beta Laundry', ownerName: 'Bob', email: 'bob@test.com', password: 'password123' },
  });
  assert.equal(regB.status, 201);
  const tokenB = regB.json.data.token as string;

  // Duplicate email rejected
  const dup = await req('POST', '/auth/register', {
    body: { shopName: 'Dup', ownerName: 'Dup', email: 'alice@test.com', password: 'password123' },
  });
  assert.equal(dup.status, 409);

  // 2. PATCH /shops/me
  const shopPatch = await req('PATCH', '/shops/me', {
    token: tokenA,
    body: { address: '123 Main St', contact_number: '09171234567', rush_fee_centavos: 7500 },
  });
  assert.equal(shopPatch.status, 200);
  assert.equal(shopPatch.json.data.shop.rush_fee_centavos, 7500);
  assert.equal(shopPatch.json.data.shop.address, '123 Main St');

  // 3. Soft-delete customer & recreate with same contact number (partial unique index test)
  const c1 = await req('POST', '/customers', {
    token: tokenA,
    body: { name: 'Maria Old', contact_number: '09170001111' },
  });
  assert.equal(c1.status, 201);
  const c1Id = c1.json.data.customer.id as string;

  const delC1 = await req('DELETE', `/customers/${c1Id}`, { token: tokenA });
  assert.equal(delC1.status, 200);

  const c2 = await req('POST', '/customers', {
    token: tokenA,
    body: { name: 'Maria New', contact_number: '09170001111' },
  });
  assert.equal(c2.status, 201, 'Recreating customer with soft-deleted phone should succeed');
  const customerId = c2.json.data.customer.id as string;

  // 4. Soft-delete service & recreate with same name
  const s1 = await req('POST', '/services', {
    token: tokenA,
    body: { service_name: 'Wash & Dry', pricing_type: 'PER_LOAD', price: 160, weight_block_kg: 8 },
  });
  assert.equal(s1.status, 201);
  await req('DELETE', `/services/${s1.json.data.service.id}`, { token: tokenA });

  const s2 = await req('POST', '/services', {
    token: tokenA,
    body: { service_name: 'Wash & Dry', pricing_type: 'PER_LOAD', price: 160, weight_block_kg: 8 },
  });
  assert.equal(s2.status, 201, 'Recreating service with soft-deleted name should succeed');
  const serviceId = s2.json.data.service.id as string;

  // 5. Create order: 12kg @ ₱160/8kg = 2 loads = ₱320 (32000 centavos) + ₱100 initial payment
  const ordRes = await req('POST', '/orders', {
    token: tokenA,
    body: { customer_id: customerId, service_id: serviceId, weight_kg: 12, amount_paid: 100 },
  });
  assert.equal(ordRes.status, 201);
  const order = ordRes.json.data.order;
  assert.equal(order.total_amount_centavos, 32000);
  assert.equal(order.amount_paid_centavos, 10000);
  assert.equal(order.balance_centavos, 22000);
  assert.equal(order.payment_status, 'PARTIAL');

  // Shop isolation: Shop B gets 404 on Shop A's order
  const crossShop = await req('GET', `/orders/${order.id}`, { token: tokenB });
  assert.equal(crossShop.status, 404);

  // 6. Status transitions & unpaid completion guard
  assert.equal((await req('PATCH', `/orders/${order.id}/status`, { token: tokenA, body: { status: 'PROCESSING' } })).status, 200);
  assert.equal((await req('PATCH', `/orders/${order.id}/status`, { token: tokenA, body: { status: 'READY' } })).status, 200);
  const blockedComplete = await req('PATCH', `/orders/${order.id}/status`, { token: tokenA, body: { status: 'COMPLETED' } });
  assert.equal(blockedComplete.status, 400);
  assert.equal(blockedComplete.json.error.code, 'UNPAID_BALANCE');

  // 7. POST /orders/:id/payments — overpayment rejected, exact settlement succeeds
  const overpay = await req('POST', `/orders/${order.id}/payments`, {
    token: tokenA,
    body: { amount: 500, method: 'GCASH' },
  });
  assert.equal(overpay.status, 400);
  assert.equal(overpay.json.error.code, 'OVERPAYMENT');

  const settle = await req('POST', `/orders/${order.id}/payments`, {
    token: tokenA,
    body: { amount: 220, method: 'GCASH', reference: 'GCASH-9988', notes: 'Pickup payment' },
  });
  assert.equal(settle.status, 201);
  assert.equal(settle.json.data.order.balance_centavos, 0);
  assert.equal(settle.json.data.order.payment_status, 'PAID');

  const completed = await req('PATCH', `/orders/${order.id}/status`, { token: tokenA, body: { status: 'COMPLETED' } });
  assert.equal(completed.status, 200);
  assert.equal(completed.json.data.order.status, 'COMPLETED');

  // 8. Payments & Reports routes active and validating bad dates
  const paySummary = await req('GET', '/payments/summary?tzOffset=480', { token: tokenA });
  assert.equal(paySummary.status, 200);
  assert.equal(paySummary.json.data.collectedToday, 32000);
  assert.equal(paySummary.json.data.outstandingBalance, 0);

  const badReport = await req('GET', '/reports/summary?from=not-a-date', { token: tokenA });
  assert.equal(badReport.status, 400);

  const report = await req('GET', '/reports/summary?range=today&tzOffset=480', { token: tokenA });
  assert.equal(report.status, 200);
  assert.equal(report.json.data.collections, 32000);
  assert.equal(report.json.data.orderValue, 32000);
  assert.equal(report.json.data.totalOrders, 1);

  const trends = await req('GET', '/reports/trends?range=today&tzOffset=480', { token: tokenA });
  assert.equal(trends.status, 200);
  assert.equal(trends.json.data.trends.length, 1);
  assert.equal(trends.json.data.trends[0].collections, 32000);

  // 9. Sync push & pull — backdated offline record & safe pagination
  // First pull to capture current cursor
  const initialPull = await req('GET', '/sync/pull', { token: tokenA });
  assert.equal(initialPull.status, 200);
  const cursorBeforeOfflinePush = initialPull.json.data.nextCursor as string;

  // Push 3 customers with BACKDATED client timestamps (2 days ago) + 1 invalid negative payment
  const twoDaysAgo = new Date(Date.now() - 2 * 86400_000).toISOString();
  const offlineCustIds = [randomUUID(), randomUUID(), randomUUID()];
  const pushRes = await req('POST', '/sync/push', {
    token: tokenA,
    body: {
      customers: offlineCustIds.map((id, idx) => ({
        id,
        shop_id: shopA,
        name: `Offline Cust ${idx}`,
        contact_number: `0918000000${idx}`,
        created_at: twoDaysAgo,
        updated_at: twoDaysAgo,
      })),
      payments: [
        {
          id: randomUUID(),
          shop_id: shopA,
          order_id: order.id,
          amount_centavos: -500,
          method: 'cash',
        },
      ],
    },
  });
  assert.equal(pushRes.status, 200);
  assert.equal(pushRes.json.data.results.customers.every((r: any) => r.status === 'synced'), true);
  assert.equal(pushRes.json.data.results.payments[0].status, 'failed');

  // Pull with limit=2 starting from cursorBeforeOfflinePush — MUST return all 3 backdated customers across pages without skipping!
  const pulledIds = new Set<string>();
  let cursor = cursorBeforeOfflinePush;
  let pages = 0;
  while (pages < 10) {
    const p = await req('GET', `/sync/pull?since=${encodeURIComponent(cursor)}&limit=2`, { token: tokenA });
    assert.equal(p.status, 200);
    for (const c of p.json.data.customers) pulledIds.add(c.id);
    pages++;
    if (!p.json.data.hasMore || p.json.data.nextCursor === cursor) break;
    cursor = p.json.data.nextCursor;
  }
  for (const id of offlineCustIds) {
    assert.equal(pulledIds.has(id), true, `Backdated customer ${id} must be pulled without skipping`);
  }

  // Bad since returns 400
  const badPull = await req('GET', '/sync/pull?since=invalid-iso', { token: tokenA });
  assert.equal(badPull.status, 400);
});
