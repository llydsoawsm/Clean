import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('shops', (table) => {
    table.text('id').primary();
    table.text('name').notNullable();
    table.text('owner_name').nullable();
    table.text('contact_number').nullable();
    table.text('address').nullable();
    table.text('currency').notNullable().defaultTo('PHP');
    table.integer('rush_fee_centavos').notNullable().defaultTo(0);
    table.text('created_at').notNullable();
    table.text('updated_at').notNullable();
  });

  await knex.schema.createTable('users', (table) => {
    table.text('id').primary();
    table
      .text('shop_id')
      .notNullable()
      .references('id')
      .inTable('shops')
      .onDelete('CASCADE');
    table.text('email').notNullable().unique();
    table.text('password_hash').notNullable();
    table.text('name').notNullable();
    table.text('created_at').notNullable();
    table.text('updated_at').notNullable();
    table.index(['shop_id']);
    table.index(['email']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('users');
  await knex.schema.dropTableIfExists('shops');
}
