import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('app_metadata', (table) => {
    table.increments('id').primary();
    table.string('key').notNullable().unique();
    table.string('value').notNullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('app_metadata');
}
