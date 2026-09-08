import fs from 'node:fs/promises';
import path from 'node:path';
import { app } from './app';
import { config } from './config/env';
import { database } from './database/knex';

async function start(): Promise<void> {
  await fs.mkdir(path.dirname(path.resolve(process.cwd(), config.databasePath)), { recursive: true });
  await database.migrate.latest({
    directory: path.resolve(process.cwd(), 'src/database/migrations'),
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
