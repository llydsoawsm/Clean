import path from 'node:path';
import type { Knex } from 'knex';
import { config } from './src/config/env';

const knexConfig: Record<string, Knex.Config> = {
  development: {
    client: 'sqlite3',
    connection: {
      filename: path.resolve(process.cwd(), config.databasePath),
    },
    useNullAsDefault: true,
    migrations: {
      directory: path.resolve(process.cwd(), 'src/database/migrations'),
      extension: 'ts',
    },
  },
};

export default knexConfig;
