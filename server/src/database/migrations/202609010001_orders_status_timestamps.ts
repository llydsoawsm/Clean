import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const hasProcessing = await knex.schema.hasColumn('orders', 'processing_at');
  if (!hasProcessing) {
    await knex.schema.table('orders', (table) => {
      table.text('processing_at').nullable();
    });
  }
  const hasReady = await knex.schema.hasColumn('orders', 'ready_at');
  if (!hasReady) {
    await knex.schema.table('orders', (table) => {
      table.text('ready_at').nullable();
    });
  }
  const hasCompleted = await knex.schema.hasColumn('orders', 'completed_at');
  if (!hasCompleted) {
    await knex.schema.table('orders', (table) => {
      table.text('completed_at').nullable();
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  // keep columns for safety, no drop
}
