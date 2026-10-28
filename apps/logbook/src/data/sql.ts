// The minimal database surface the data layer needs. expo-sqlite's
// SQLiteDatabase satisfies it on the phone; tests use an in-memory
// SQLite through the same interface (src/test/sqlite.ts).
// Positional parameters only.

export type SqlValue = string | number | null;

export interface SqlDb {
  execAsync(source: string): Promise<void>;
  runAsync(source: string, params: SqlValue[]): Promise<{ changes: number }>;
  getAllAsync<T>(source: string, params: SqlValue[]): Promise<T[]>;
  getFirstAsync<T>(source: string, params: SqlValue[]): Promise<T | null>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
}
