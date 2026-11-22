import path from 'node:path';
import knex, { type Knex } from 'knex';
import { config } from '../config/env';

type SqliteConnection = {
  run: (sql: string, callback: (error: Error | null) => void) => void;
};

export const database: Knex = knex({
  client: 'sqlite3',
  connection: {
    filename: path.resolve(process.cwd(), config.databasePath),
  },
  useNullAsDefault: true,
  pool: {
    afterCreate: (
      connection: SqliteConnection,
      callback: (error: Error | null, connection: unknown) => void,
    ) => {
      connection.run('PRAGMA foreign_keys = ON', (fkErr) => {
        if (fkErr) return callback(fkErr, connection);
        connection.run('PRAGMA journal_mode = WAL', (walErr) => {
          if (walErr) return callback(walErr, connection);
          connection.run('PRAGMA busy_timeout = 5000', (busyErr) => {
            callback(busyErr, connection);
          });
        });
      });
    },
  },
});
