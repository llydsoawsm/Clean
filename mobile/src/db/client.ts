/**
 * Clean Database Client — expo-sqlite wrapper.
 * Handles open, init, migrations, and graceful errors.
 * Usage:
 *   import { getDatabase, initDatabase } from '@/db/client';
 *   await initDatabase(); // idempotent
 *   const db = getDatabase();
 */

import * as SQLite from 'expo-sqlite';
import { migrate } from './migrations';

const DB_NAME = 'clean.db';

let dbInstance: SQLite.SQLiteDatabase | null = null;
let initPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDatabase(): SQLite.SQLiteDatabase {
  if (!dbInstance) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return dbInstance;
}

export function isDatabaseInitialized(): boolean {
  return dbInstance !== null;
}

/**
 * Initialize DB: open file, run migrations, enable foreign_keys.
 * Safe to call multiple times (deduped).
 */
export async function initDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) return dbInstance;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const db = await SQLite.openDatabaseAsync(DB_NAME, {
        useNewConnection: false,
      });

      // Core pragmas
      await db.execAsync('PRAGMA foreign_keys = ON;');
      await db.execAsync('PRAGMA journal_mode = WAL;');

      await migrate(db);

      dbInstance = db;
      return db;
    } catch (error) {
      initPromise = null;
      const message = error instanceof Error ? error.message : String(error);
      console.error('[CleanDB] init failed:', message);
      throw new Error(`Failed to initialize local database: ${message}`);
    }
  })();

  return initPromise;
}

/**
 * For tests/dev: close and optionally delete DB file.
 * Use with care.
 */
export async function closeDatabase(): Promise<void> {
  if (dbInstance) {
    try {
      await dbInstance.closeAsync();
    } catch (e) {
      console.warn('[CleanDB] close error', e);
    }
    dbInstance = null;
    initPromise = null;
  }
}

export async function deleteDatabase(): Promise<void> {
  await closeDatabase();
  try {
    await SQLite.deleteDatabaseAsync(DB_NAME);
  } catch (e) {
    console.warn('[CleanDB] delete error', e);
  }
}

/**
 * Helper: run in transaction if needed.
 */
export async function withTransaction<T>(fn: (db: SQLite.SQLiteDatabase) => Promise<T>): Promise<T> {
  const db = getDatabase();
  let result: T;
  await db.withTransactionAsync(async () => {
    result = await fn(db);
  });
  // @ts-ignore assigned inside
  return result;
}
