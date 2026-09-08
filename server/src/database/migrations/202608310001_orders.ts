import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('orders', (table) => {
    table.text('id').primary();
    table.text('shop_id').notNullable().references('id').inTable('shops').onDelete('CASCADE');
    table.text('customer_id').notNullable().references('id').inTable('customers').onDelete('RESTRICT');
    table.text('service_id').notNullable().references('id').inTable('services').onDelete('RESTRICT');
    table.text('order_number').notNullable();
    table.text('service_name_snapshot').notNullable();
    table.text('pricing_type_snapshot').notNullable(); // PER_KG | PER_PIECE | FIXED
    table.integer('unit_price_snapshot_centavos').notNullable();
    table.text('customer_name_snapshot').nullable();
    table.integer('weight_grams').nullable();
    table.integer('quantity').nullable();
    table.integer('base_amount_centavos').notNullable().defaultTo(0);
    table.integer('additional_fee_centavos').notNullable().defaultTo(0);
    table.integer('rush_fee_centavos').notNullable().defaultTo(0);
    table.integer('is_rush').notNullable().defaultTo(0);
    table.integer('total_amount_centavos').notNullable();
    table.integer('amount_paid_centavos').notNullable().defaultTo(0);
    table.integer('balance_centavos').notNullable().defaultTo(0);
    table.text('payment_status').notNullable(); // UNPAID | PARTIAL | PAID
    table.text('status').notNullable().defaultTo('RECEIVED'); // RECEIVED
    table.text('notes').nullable();
    table.text('received_at').notNullable();
    table.text('created_at').notNullable();
    table.text('updated_at').notNullable();
    table.integer('is_deleted').notNullable().defaultTo(0);
    table.unique(['shop_id', 'order_number']);
    table.index(['shop_id']);
    table.index(['customer_id']);
    table.index(['status']);
    table.index(['received_at']);
  });

  await knex.schema.createTable('payments', (table) => {
    table.text('id').primary();
    table.text('shop_id').notNullable().references('id').inTable('shops').onDelete('CASCADE');
    table.text('order_id').notNullable().references('id').inTable('orders').onDelete('CASCADE');
    table.integer('amount_centavos').notNullable();
    table.text('method').notNullable().defaultTo('cash');
    table.text('created_at').notNullable();
    table.text('updated_at').notNullable();
    table.integer('is_deleted').notNullable().defaultTo(0);
    table.index(['order_id']);
    table.index(['shop_id']);
  });

  await knex.schema.createTable('order_status_history', (table) => {
    table.text('id').primary();
    table.text('order_id').notNullable().references('id').inTable('orders').onDelete('CASCADE');
    table.text('from_status').nullable();
    table.text('to_status').notNullable();
    table.text('changed_at').notNullable();
    table.text('changed_by').nullable();
    table.index(['order_id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('order_status_history');
  await knex.schema.dropTableIfExists('payments');
  await knex.schema.dropTableIfExists('orders');
}
