import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const hasRef = await knex.schema.hasColumn('payments', 'reference');
  if (!hasRef) {
    await knex.schema.table('payments', (table) => {
      table.text('reference').nullable();
    });
  }
  const hasNotes = await knex.schema.hasColumn('payments', 'notes');
  if (!hasNotes) {
    await knex.schema.table('payments', (table) => {
      table.text('notes').nullable();
    });
  }
  // Ensure method column exists with proper default (already exists, but ensure it allows CASH/GCASH/OTHER)
  // No CHECK remake to keep non-destructive; validation in app layer.
}

export async function down(knex: Knex): Promise<void> {
  // non-destructive: keep columns
}
