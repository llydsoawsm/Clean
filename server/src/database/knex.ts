import path from 'node:path';
import knex, { type Knex } from 'knex';
import { config } from '../config/env';

export const database: Knex = knex({
  client: 'sqlite3',
  connection: {
    filename: path.resolve(process.cwd(), config.databasePath),
  },
  useNullAsDefault: true,
  pool: {
    afterCreate: (
      connection: { run: (sql: string, callback: (error: Error | null) => void) => void },
      callback: (error: Error | null, connection: unknown) => void,
    ) => {
      connection.run('PRAGMA foreign_keys = ON', (error) => callback(error, connection));
    },
  },
});
