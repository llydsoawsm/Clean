import fs from 'node:fs/promises';
import path from 'node:path';
import { app } from './app';
import { config } from './config/env';
import { database } from './database/knex';

async function syncMigrationExtensions(ext: '.ts' | '.js'): Promise<void> {
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

async function start(): Promise<void> {
  await fs.mkdir(path.dirname(path.resolve(process.cwd(), config.databasePath)), { recursive: true });

  // Works in both dev (src/database/migrations/*.ts via tsx) and prod (dist/database/migrations/*.js via node)
  const runtimeExt: '.ts' | '.js' = __filename.endsWith('.ts') ? '.ts' : '.js';
  const migrationsDir = path.resolve(__dirname, 'database/migrations');

  await syncMigrationExtensions(runtimeExt);
  await database.migrate.latest({
    directory: migrationsDir,
    loadExtensions: [runtimeExt],
  });

  const server = app.listen(config.port, config.host, () => {
    console.log(`Clean API listening on http://${config.host}:${config.port}`);
  });

  const shutdown = async (signal: string): Promise<void> => {
    console.log(`${signal} received, shutting down`);
    server.close(async () => {
      await database.destroy();
      process.exit(0);
    });
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

start().catch(async (error: unknown) => {
  console.error('Unable to start Clean API:', error);
  await database.destroy();
  process.exit(1);
});
