/**
 * Local SQLite migrations — Clean offline-first.
 * Uses PRAGMA user_version for incremental upgrades.
 * Version 1 = initial Clean schema (shops, customers, services, orders, payments, status_history).
 *
 * All tables use TEXT PK (UUID v4), integer centavos, ISO8601 TEXT timestamps.
 * Sync fields: sync_status, last_synced_at, updated_at, is_deleted.
 */

import type { SQLiteDatabase } from 'expo-sqlite';

export const CURRENT_DB_VERSION = 5;

export async function migrate(db: SQLiteDatabase): Promise<void> {
  // Enable foreign keys, WAL for concurrency
  await db.execAsync('PRAGMA foreign_keys = ON;');
  await db.execAsync('PRAGMA journal_mode = WAL;');

  const versionRow = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version;');
  const currentVersion = versionRow?.user_version ?? 0;

  if (currentVersion < 1) {
    await migrateToV1(db);
    await db.execAsync('PRAGMA user_version = 1;');
  }

  if (currentVersion < 2) {
    await migrateToV2(db);
    await db.execAsync('PRAGMA user_version = 2;');
  }

  if (currentVersion < 3) {
    await migrateToV3(db);
    await db.execAsync('PRAGMA user_version = 3;');
  }

  if (currentVersion < 4) {
    await migrateToV4(db);
    await db.execAsync('PRAGMA user_version = 4;');
  }

  if (currentVersion < 5) {
    await migrateToV5(db);
    await db.execAsync('PRAGMA user_version = 5;');
  }

  // Ensure pragmas after migration too
  await db.execAsync('PRAGMA foreign_keys = ON;');
}

async function migrateToV1(db: SQLiteDatabase): Promise<void> {
  // Shops — single row per device (MVP). Shop is sync tenant.
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS shops (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      owner_name TEXT,
      contact_number TEXT,
      address TEXT,
      currency TEXT NOT NULL DEFAULT 'PHP',
      rush_fee_centavos INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      sync_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (sync_status IN ('PENDING','SYNCING','SYNCED','FAILED')),
      last_synced_at TEXT
    );
  `);

  // Customers — unique contact per shop
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY NOT NULL,
      shop_id TEXT,
      name TEXT NOT NULL,
      contact_number TEXT NOT NULL,
      first_transaction_at TEXT,
      last_visit_at TEXT,
      transaction_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      sync_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (sync_status IN ('PENDING','SYNCING','SYNCED','FAILED')),
      last_synced_at TEXT,
      is_deleted INTEGER NOT NULL DEFAULT 0 CHECK (is_deleted IN (0,1)),
      FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE SET NULL
    );
  `);
  await db.execAsync(`CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_shop_contact ON customers(shop_id, contact_number) WHERE is_deleted = 0;`);
  await db.execAsync(`CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);`);
  await db.execAsync(`CREATE INDEX IF NOT EXISTS idx_customers_updated ON customers(updated_at);`);

  // Services — unique name per shop
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS services (
      id TEXT PRIMARY KEY NOT NULL,
      shop_id TEXT,
      name TEXT NOT NULL,
      pricing_type TEXT NOT NULL CHECK (pricing_type IN ('per_kg','per_piece','fixed')),
      unit_price_centavos INTEGER NOT NULL CHECK (unit_price_centavos >= 0),
      is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      sync_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (sync_status IN ('PENDING','SYNCING','SYNCED','FAILED')),
      last_synced_at TEXT,
      is_deleted INTEGER NOT NULL DEFAULT 0 CHECK (is_deleted IN (0,1)),
      FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE SET NULL
    );
  `);
  await db.execAsync(`CREATE UNIQUE INDEX IF NOT EXISTS idx_services_shop_name ON services(shop_id, name) WHERE is_deleted = 0;`);
  await db.execAsync(`CREATE INDEX IF NOT EXISTS idx_services_active ON services(is_active);`);

  // Orders — core transaction. Snapshots preserve history.
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY NOT NULL,
      shop_id TEXT,
      customer_id TEXT NOT NULL,
      service_id TEXT NOT NULL,
      order_number TEXT NOT NULL,
      pricing_type_snapshot TEXT NOT NULL CHECK (pricing_type_snapshot IN ('per_kg','per_piece','fixed')),
      service_name_snapshot TEXT NOT NULL,
      unit_price_snapshot_centavos INTEGER NOT NULL,
      customer_name_snapshot TEXT,
      weight_grams INTEGER CHECK (weight_grams IS NULL OR weight_grams >= 0),
      quantity INTEGER CHECK (quantity IS NULL OR quantity >= 0),
      base_cost_centavos INTEGER NOT NULL DEFAULT 0,
      additional_fee_centavos INTEGER NOT NULL DEFAULT 0,
      rush_fee_centavos INTEGER NOT NULL DEFAULT 0,
      is_rush INTEGER NOT NULL DEFAULT 0 CHECK (is_rush IN (0,1)),
      total_centavos INTEGER NOT NULL CHECK (total_centavos >= 0),
      amount_paid_centavos INTEGER NOT NULL DEFAULT 0 CHECK (amount_paid_centavos >= 0),
      balance_centavos INTEGER NOT NULL DEFAULT 0,
      payment_status TEXT NOT NULL CHECK (payment_status IN ('UNPAID','PARTIAL','PAID')),
      status TEXT NOT NULL CHECK (status IN ('RECEIVED','PROCESSING','READY','COMPLETED')),
      notes TEXT,
      estimated_ready_at TEXT,
      received_at TEXT NOT NULL,
      processing_at TEXT,
      ready_at TEXT,
      completed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      sync_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (sync_status IN ('PENDING','SYNCING','SYNCED','FAILED')),
      last_synced_at TEXT,
      is_deleted INTEGER NOT NULL DEFAULT 0 CHECK (is_deleted IN (0,1)),
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
      FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE RESTRICT,
      FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE SET NULL
    );
  `);
  await db.execAsync(`CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_shop_ordernum ON orders(shop_id, order_number) WHERE is_deleted = 0;`);
  await db.execAsync(`CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);`);
  await db.execAsync(`CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);`);
  await db.execAsync(`CREATE INDEX IF NOT EXISTS idx_orders_received ON orders(received_at);`);
  await db.execAsync(`CREATE INDEX IF NOT EXISTS idx_orders_ready ON orders(ready_at) WHERE status = 'READY';`);
  await db.execAsync(`CREATE INDEX IF NOT EXISTS idx_orders_sync ON orders(sync_status);`);

  // Payments — append-only
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY NOT NULL,
      order_id TEXT NOT NULL,
      shop_id TEXT,
      amount_centavos INTEGER NOT NULL CHECK (amount_centavos > 0),
      method TEXT NOT NULL DEFAULT 'cash',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      sync_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (sync_status IN ('PENDING','SYNCING','SYNCED','FAILED')),
      last_synced_at TEXT,
      is_deleted INTEGER NOT NULL DEFAULT 0 CHECK (is_deleted IN (0,1)),
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE SET NULL
    );
  `);
  await db.execAsync(`CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);`);
  await db.execAsync(`CREATE INDEX IF NOT EXISTS idx_payments_sync ON payments(sync_status);`);

  // Status history
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS status_history (
      id TEXT PRIMARY KEY NOT NULL,
      order_id TEXT NOT NULL,
      from_status TEXT CHECK (from_status IN ('RECEIVED','PROCESSING','READY','COMPLETED')),
      to_status TEXT NOT NULL CHECK (to_status IN ('RECEIVED','PROCESSING','READY','COMPLETED')),
      changed_at TEXT NOT NULL,
      changed_by TEXT,
      sync_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (sync_status IN ('PENDING','SYNCING','SYNCED','FAILED')),
      last_synced_at TEXT,
      is_deleted INTEGER NOT NULL DEFAULT 0 CHECK (is_deleted IN (0,1)),
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    );
  `);
  await db.execAsync(`CREATE INDEX IF NOT EXISTS idx_status_history_order ON status_history(order_id);`);

  // Optional: sync logs for debugging failed pushes
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS sync_logs (
      id TEXT PRIMARY KEY NOT NULL,
      entity TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      action TEXT NOT NULL,
      error TEXT,
      created_at TEXT NOT NULL
    );
  `);
}

async function migrateToV2(db: SQLiteDatabase): Promise<void> {
  // Customers: add address and notes for Phase 4
  // Check if columns exist before adding (SQLite doesn't support IF NOT EXISTS for ADD COLUMN in older versions, so try/catch)
  try {
    await db.execAsync(`ALTER TABLE customers ADD COLUMN address TEXT;`);
  } catch {}
  try {
    await db.execAsync(`ALTER TABLE customers ADD COLUMN notes TEXT;`);
  } catch {}

  // Services: add description for Phase 4
  try {
    await db.execAsync(`ALTER TABLE services ADD COLUMN description TEXT;`);
  } catch {}

  // Note: pricing_type CHECK remains per_kg/per_piece/fixed (lowercase) — server normalizes to lowercase, UI maps to labels
}

async function migrateToV3(db: SQLiteDatabase): Promise<void> {
  // Phase 5: package/load pricing ₱160 per 8kg
  // Services: add weight_block_grams for per_load (e.g., 8000), and expand pricing_type to include per_load

  // Add weight_block_grams column if not exists
  try {
    await db.execAsync(`ALTER TABLE services ADD COLUMN weight_block_grams INTEGER;`);
  } catch {}

  // Add snapshot column to orders for historical preservation
  try {
    await db.execAsync(`ALTER TABLE orders ADD COLUMN weight_block_grams_snapshot INTEGER;`);
  } catch {}

  // Expand pricing_type CHECK to include per_load — requires table recreation because CHECK cannot be altered
  // We recreate services and orders to allow per_load while preserving data
  // Use PRAGMA foreign_keys OFF during recreation
  await db.execAsync(`PRAGMA foreign_keys = OFF;`);

  // Recreate services with per_load support (if not already)
  try {
    const servicesInfo = await db.getAllAsync<{ name: string }>(`SELECT name FROM sqlite_master WHERE type='table' AND name='services';`);
    if (servicesInfo.length > 0) {
      // Check if per_load already allowed by trying to insert and rollback test
      // Instead we just attempt to recreate if old CHECK still blocks per_load
      // Create new table
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS services_new (
          id TEXT PRIMARY KEY NOT NULL,
          shop_id TEXT,
          name TEXT NOT NULL,
          pricing_type TEXT NOT NULL CHECK (pricing_type IN ('per_kg','per_piece','fixed','per_load')),
          unit_price_centavos INTEGER NOT NULL CHECK (unit_price_centavos >= 0),
          description TEXT,
          weight_block_grams INTEGER,
          is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          sync_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (sync_status IN ('PENDING','SYNCING','SYNCED','FAILED')),
          last_synced_at TEXT,
          is_deleted INTEGER NOT NULL DEFAULT 0 CHECK (is_deleted IN (0,1)),
          FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE SET NULL
        );
      `);
      // Copy data if services_new was just created and empty
      const countNew = await db.getFirstAsync<{ c: number }>(`SELECT COUNT(*) as c FROM services_new;`);
      const countOld = await db.getFirstAsync<{ c: number }>(`SELECT COUNT(*) as c FROM services;`);
      if ((countNew?.c ?? 0) === 0 && (countOld?.c ?? 0) >= 0) {
        // Check if columns mismatch — copy with explicit columns
        await db.execAsync(`
          INSERT INTO services_new (id, shop_id, name, pricing_type, unit_price_centavos, description, weight_block_grams, is_active, created_at, updated_at, sync_status, last_synced_at, is_deleted)
          SELECT id, shop_id, name, pricing_type, unit_price_centavos, description, weight_block_grams, is_active, created_at, updated_at, sync_status, last_synced_at, is_deleted FROM services;
        `);
        await db.execAsync(`DROP TABLE services;`);
        await db.execAsync(`ALTER TABLE services_new RENAME TO services;`);
        await db.execAsync(`CREATE UNIQUE INDEX IF NOT EXISTS idx_services_shop_name ON services(shop_id, name) WHERE is_deleted = 0;`);
        await db.execAsync(`CREATE INDEX IF NOT EXISTS idx_services_active ON services(is_active);`);
      } else {
        // services_new already has data, drop it
        try {
          await db.execAsync(`DROP TABLE services_new;`);
        } catch {}
      }
    }
  } catch (e) {
    // if recreation fails, ignore (fallback to existing)
  }

  // Recreate orders pricing_type_snapshot to allow per_load
  try {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS orders_new (
        id TEXT PRIMARY KEY NOT NULL,
        shop_id TEXT,
        customer_id TEXT NOT NULL,
        service_id TEXT NOT NULL,
        order_number TEXT NOT NULL,
        pricing_type_snapshot TEXT NOT NULL CHECK (pricing_type_snapshot IN ('per_kg','per_piece','fixed','per_load')),
        service_name_snapshot TEXT NOT NULL,
        unit_price_snapshot_centavos INTEGER NOT NULL,
        weight_block_grams_snapshot INTEGER,
        customer_name_snapshot TEXT,
        weight_grams INTEGER CHECK (weight_grams IS NULL OR weight_grams >= 0),
        quantity INTEGER CHECK (quantity IS NULL OR quantity >= 0),
        base_cost_centavos INTEGER NOT NULL DEFAULT 0,
        additional_fee_centavos INTEGER NOT NULL DEFAULT 0,
        rush_fee_centavos INTEGER NOT NULL DEFAULT 0,
        is_rush INTEGER NOT NULL DEFAULT 0 CHECK (is_rush IN (0,1)),
        total_centavos INTEGER NOT NULL CHECK (total_centavos >= 0),
        amount_paid_centavos INTEGER NOT NULL DEFAULT 0 CHECK (amount_paid_centavos >= 0),
        balance_centavos INTEGER NOT NULL DEFAULT 0,
        payment_status TEXT NOT NULL CHECK (payment_status IN ('UNPAID','PARTIAL','PAID')),
        status TEXT NOT NULL CHECK (status IN ('RECEIVED','PROCESSING','READY','COMPLETED')),
        notes TEXT,
        estimated_ready_at TEXT,
        received_at TEXT NOT NULL,
        processing_at TEXT,
        ready_at TEXT,
        completed_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        sync_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (sync_status IN ('PENDING','SYNCING','SYNCED','FAILED')),
        last_synced_at TEXT,
        is_deleted INTEGER NOT NULL DEFAULT 0 CHECK (is_deleted IN (0,1)),
        FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
        FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE RESTRICT,
        FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE SET NULL
      );
    `);
    const cntNew = await db.getFirstAsync<{ c: number }>(`SELECT COUNT(*) as c FROM orders_new;`);
    const cntOld = await db.getFirstAsync<{ c: number }>(`SELECT COUNT(*) as c FROM orders;`);
    if ((cntNew?.c ?? 0) === 0 && (cntOld?.c ?? 0) >= 0) {
      await db.execAsync(`
        INSERT INTO orders_new (id, shop_id, customer_id, service_id, order_number, pricing_type_snapshot, service_name_snapshot, unit_price_snapshot_centavos, weight_block_grams_snapshot, customer_name_snapshot, weight_grams, quantity, base_cost_centavos, additional_fee_centavos, rush_fee_centavos, is_rush, total_centavos, amount_paid_centavos, balance_centavos, payment_status, status, notes, estimated_ready_at, received_at, processing_at, ready_at, completed_at, created_at, updated_at, sync_status, last_synced_at, is_deleted)
        SELECT id, shop_id, customer_id, service_id, order_number, pricing_type_snapshot, service_name_snapshot, unit_price_snapshot_centavos, weight_block_grams_snapshot, customer_name_snapshot, weight_grams, quantity, base_cost_centavos, additional_fee_centavos, rush_fee_centavos, is_rush, total_centavos, amount_paid_centavos, balance_centavos, payment_status, status, notes, estimated_ready_at, received_at, processing_at, ready_at, completed_at, created_at, updated_at, sync_status, last_synced_at, is_deleted FROM orders;
      `);
      await db.execAsync(`DROP TABLE orders;`);
      await db.execAsync(`ALTER TABLE orders_new RENAME TO orders;`);
      await db.execAsync(`CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_shop_ordernum ON orders(shop_id, order_number) WHERE is_deleted = 0;`);
      await db.execAsync(`CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);`);
      await db.execAsync(`CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);`);
      await db.execAsync(`CREATE INDEX IF NOT EXISTS idx_orders_received ON orders(received_at);`);
      await db.execAsync(`CREATE INDEX IF NOT EXISTS idx_orders_ready ON orders(ready_at) WHERE status = 'READY';`);
      await db.execAsync(`CREATE INDEX IF NOT EXISTS idx_orders_sync ON orders(sync_status);`);
    } else {
      try {
        await db.execAsync(`DROP TABLE orders_new;`);
      } catch {}
    }
  } catch {}

  await db.execAsync(`PRAGMA foreign_keys = ON;`);
}

async function migrateToV4(db: SQLiteDatabase): Promise<void> {
  // Phase 7: payment method/reference/notes for financial management
  // Payments already have method TEXT default 'cash', add reference and notes non-destructively
  try {
    await db.execAsync(`ALTER TABLE payments ADD COLUMN reference TEXT;`);
  } catch {}
  try {
    await db.execAsync(`ALTER TABLE payments ADD COLUMN notes TEXT;`);
  } catch {}
  // Create index for payment created_at for daily collections
  try {
    await db.execAsync(`CREATE INDEX IF NOT EXISTS idx_payments_created ON payments(created_at);`);
  } catch {}
  try {
    await db.execAsync(`CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);`);
  } catch {}
}

async function migrateToV5(db: SQLiteDatabase): Promise<void> {
  // Phase 9: sync state cursor and sync logs
  try {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS sync_state (
        shop_id TEXT PRIMARY KEY NOT NULL,
        last_sync_at TEXT,
        last_sync_cursor TEXT,
        updated_at TEXT NOT NULL
      );
    `);
  } catch {}
  try {
    await db.execAsync(`CREATE INDEX IF NOT EXISTS idx_sync_state_shop ON sync_state(shop_id);`);
  } catch {}
  // Ensure sync_status indexes still exist (already created in V1)
  // Add index for updated_at for pull efficiency if not exists
  try {
    await db.execAsync(`CREATE INDEX IF NOT EXISTS idx_customers_updated ON customers(updated_at);`);
  } catch {}
  try {
    await db.execAsync(`CREATE INDEX IF NOT EXISTS idx_services_updated ON services(updated_at);`);
  } catch {}
  try {
    await db.execAsync(`CREATE INDEX IF NOT EXISTS idx_orders_updated ON orders(updated_at);`);
  } catch {}
}
