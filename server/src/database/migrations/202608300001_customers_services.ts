import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Customers — shop-scoped, unique contact per shop
  await knex.schema.createTable('customers', (table) => {
    table.text('id').primary();
    table.text('shop_id').notNullable().references('id').inTable('shops').onDelete('CASCADE');
    table.text('name').notNullable();
    table.text('contact_number').notNullable();
    table.text('address').nullable();
    table.text('notes').nullable();
    table.text('created_at').notNullable();
    table.text('updated_at').notNullable();
    table.integer('is_deleted').notNullable().defaultTo(0);
    table.index(['shop_id']);
    table.index(['contact_number']);
    // unique contact per shop (where not deleted)
    table.unique(['shop_id', 'contact_number']);
  });

  // Services — shop-scoped
  await knex.schema.createTable('services', (table) => {
    table.text('id').primary();
    table.text('shop_id').notNullable().references('id').inTable('shops').onDelete('CASCADE');
    table.text('service_name').notNullable();
    table.text('pricing_type').notNullable(); // PER_KG / PER_PIECE / FIXED (normalized)
    table.integer('price_centavos').notNullable().defaultTo(0);
    table.text('description').nullable();
    table.integer('is_active').notNullable().defaultTo(1);
    table.text('created_at').notNullable();
    table.text('updated_at').notNullable();
    table.integer('is_deleted').notNullable().defaultTo(0);
    table.index(['shop_id']);
    table.index(['is_active']);
    table.unique(['shop_id', 'service_name']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('services');
  await knex.schema.dropTableIfExists('customers');
}
