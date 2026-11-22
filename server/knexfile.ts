import path from 'node:path';
import type { Knex } from 'knex';
import { config } from './src/config/env';

const sharedConnection = {
  filename: path.resolve(process.cwd(), config.databasePath),
};

const knexConfig: Record<string, Knex.Config> = {
  development: {
    client: 'sqlite3',
    connection: sharedConnection,
    useNullAsDefault: true,
    migrations: {
      directory: path.resolve(process.cwd(), 'src/database/migrations'),
      extension: 'ts',
    },
  },
  production: {
    client: 'sqlite3',
    connection: sharedConnection,
    useNullAsDefault: true,
    migrations: {
      directory: path.resolve(process.cwd(), 'dist/database/migrations'),
      extension: 'js',
    },
  },
};

export default knexConfig;
