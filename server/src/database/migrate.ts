import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config/env';
import { database } from './knex';

export async function syncMigrationExtensions(ext: '.ts' | '.js'): Promise<void> {
  const otherExt = ext === '.js' ? '.ts' : '.js';
  const hasTable = await database.schema.hasTable('knex_migrations');
  if (!hasTable) return;

  const rows = (await database('knex_migrations').select('id', 'name')) as { id: number; name: string }[];
  for (const row of rows) {
    if (row.name.endsWith(otherExt)) {
      const updatedName = `${row.name.slice(0, -otherExt.length)}${ext}`;
      await database('knex_migrations').where({ id: row.id }).update({ name: updatedName });
    }
  }
}

export async function runMigrations(
  action: 'latest' | 'rollback' = 'latest'
): Promise<{ batchNo: number; log: string[] }> {
  await fs.mkdir(path.dirname(path.resolve(process.cwd(), config.databasePath)), { recursive: true });

  const runtimeExt: '.ts' | '.js' = __filename.endsWith('.ts') ? '.ts' : '.js';
  const migrationsDir = path.resolve(__dirname, 'migrations');

  await syncMigrationExtensions(runtimeExt);

  const [batchNo, log] =
    action === 'rollback'
      ? await database.migrate.rollback({ directory: migrationsDir, loadExtensions: [runtimeExt] })
      : await database.migrate.latest({ directory: migrationsDir, loadExtensions: [runtimeExt] });

  return { batchNo, log };
}

if (require.main === module) {
  const action = process.argv[2] === 'rollback' ? 'rollback' : 'latest';
  runMigrations(action)
    .then(({ batchNo, log }) => {
      if (log.length === 0) {
        console.log(action === 'rollback' ? 'Already at the base migration' : 'Already up to date');
      } else {
        const verb = action === 'rollback' ? 'rolled back' : 'run';
        console.log(`Batch ${batchNo} ${verb}: ${log.length} migrations\n${log.join('\n')}`);
      }
    })
    .catch((err: unknown) => {
      console.error('Migration failed:', err);
      process.exitCode = 1;
    })
    .finally(async () => {
      await database.destroy();
    });
}

