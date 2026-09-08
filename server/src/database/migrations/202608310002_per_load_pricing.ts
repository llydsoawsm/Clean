import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Add weight_block_grams to services for PER_LOAD (e.g., 8000 for 8kg)
  const hasServicesBlock = await knex.schema.hasColumn('services', 'weight_block_grams');
  if (!hasServicesBlock) {
    await knex.schema.table('services', (table) => {
      table.integer('weight_block_grams').nullable();
    });
  }

  // Add snapshot to orders
  const hasOrdersBlock = await knex.schema.hasColumn('orders', 'weight_block_snapshot_grams');
  if (!hasOrdersBlock) {
    await knex.schema.table('orders', (table) => {
      table.integer('weight_block_snapshot_grams').nullable();
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasServicesBlock = await knex.schema.hasColumn('services', 'weight_block_grams');
  if (hasServicesBlock) {
    await knex.schema.table('services', (table) => {
      table.dropColumn('weight_block_grams');
    });
  }
  const hasOrdersBlock = await knex.schema.hasColumn('orders', 'weight_block_snapshot_grams');
  if (hasOrdersBlock) {
    await knex.schema.table('orders', (table) => {
      table.dropColumn('weight_block_snapshot_grams');
    });
  }
}
