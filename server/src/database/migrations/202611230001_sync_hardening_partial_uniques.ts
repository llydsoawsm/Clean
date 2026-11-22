import type { Knex } from 'knex';

/**
 * Migration: Sync hardening & schema parity with mobile SQLite.
 * 1. Adds `server_updated_at` to customers, services, orders, payments, order_status_history
 *    so incremental sync pulls never miss backdated offline edits.
 * 2. Replaces full-table UNIQUE constraints on customers(shop_id, contact_number) and
 *    services(shop_id, service_name) with partial unique indexes (WHERE is_deleted = 0),
 *    matching mobile SQLite so soft-deleted records don't block recreating active ones.
 */
export async function up(knex: Knex): Promise<void> {
  // 1. Add server_updated_at columns if missing
  const tables: { name: string; fallbackCol: string }[] = [
    { name: 'customers', fallbackCol: 'updated_at' },
    { name: 'services', fallbackCol: 'updated_at' },
    { name: 'orders', fallbackCol: 'updated_at' },
    { name: 'payments', fallbackCol: 'updated_at' },
    { name: 'order_status_history', fallbackCol: 'changed_at' },
  ];

  for (const t of tables) {
    const hasCol = await knex.schema.hasColumn(t.name, 'server_updated_at');
    if (!hasCol) {
      await knex.schema.table(t.name, (table) => {
        table.text('server_updated_at').nullable();
      });
    }
    await knex.raw(`UPDATE ${t.name} SET server_updated_at = COALESCE(${t.fallbackCol}, CURRENT_TIMESTAMP) WHERE server_updated_at IS NULL`);
    await knex.raw(`CREATE INDEX IF NOT EXISTS idx_${t.name}_server_updated_at ON ${t.name}(server_updated_at)`);
  }

  // 2. Replace full UNIQUE constraints on customers & services with partial UNIQUE indexes (WHERE is_deleted = 0)
  // SQLite requires table recreation to drop inline UNIQUE constraints.
  await knex.raw('PRAGMA foreign_keys = OFF');
  try {
    await knex.transaction(async (trx) => {
      // Customers
      await trx.raw(`
        CREATE TABLE customers_new (
          id TEXT PRIMARY KEY,
          shop_id TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          contact_number TEXT NOT NULL,
          address TEXT,
          notes TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          is_deleted INTEGER NOT NULL DEFAULT 0,
          server_updated_at TEXT
        )
      `);
      await trx.raw(`
        INSERT INTO customers_new (id, shop_id, name, contact_number, address, notes, created_at, updated_at, is_deleted, server_updated_at)
        SELECT id, shop_id, name, contact_number, address, notes, created_at, updated_at, is_deleted, server_updated_at FROM customers
      `);
      await trx.raw('DROP TABLE customers');
      await trx.raw('ALTER TABLE customers_new RENAME TO customers');
      await trx.raw('CREATE INDEX IF NOT EXISTS idx_customers_shop_id ON customers(shop_id)');
      await trx.raw('CREATE INDEX IF NOT EXISTS idx_customers_contact_number ON customers(contact_number)');
      await trx.raw('CREATE INDEX IF NOT EXISTS idx_customers_server_updated_at ON customers(server_updated_at)');
      await trx.raw('CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_shop_contact_active ON customers(shop_id, contact_number) WHERE is_deleted = 0');

      // Services
      await trx.raw(`
        CREATE TABLE services_new (
          id TEXT PRIMARY KEY,
          shop_id TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
          service_name TEXT NOT NULL,
          pricing_type TEXT NOT NULL,
          price_centavos INTEGER NOT NULL DEFAULT 0,
          description TEXT,
          weight_block_grams INTEGER,
          is_active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          is_deleted INTEGER NOT NULL DEFAULT 0,
          server_updated_at TEXT
        )
      `);
      await trx.raw(`
        INSERT INTO services_new (id, shop_id, service_name, pricing_type, price_centavos, description, weight_block_grams, is_active, created_at, updated_at, is_deleted, server_updated_at)
        SELECT id, shop_id, service_name, pricing_type, price_centavos, description, weight_block_grams, is_active, created_at, updated_at, is_deleted, server_updated_at FROM services
      `);
      await trx.raw('DROP TABLE services');
      await trx.raw('ALTER TABLE services_new RENAME TO services');
      await trx.raw('CREATE INDEX IF NOT EXISTS idx_services_shop_id ON services(shop_id)');
      await trx.raw('CREATE INDEX IF NOT EXISTS idx_services_is_active ON services(is_active)');
      await trx.raw('CREATE INDEX IF NOT EXISTS idx_services_server_updated_at ON services(server_updated_at)');
      await trx.raw('CREATE UNIQUE INDEX IF NOT EXISTS idx_services_shop_name_active ON services(shop_id, service_name) WHERE is_deleted = 0');
    });
  } finally {
    await knex.raw('PRAGMA foreign_keys = ON');
  }
}

export async function down(_knex: Knex): Promise<void> {
  // Non-destructive down migration to preserve data integrity
}

