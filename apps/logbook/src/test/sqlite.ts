import Database from 'better-sqlite3';

import { createRepository, ensureDevice, type RepoDeps } from '../data/repository';
import { migrate } from '../data/schema';
import type { SqlDb, SqlValue } from '../data/sql';

// The native addon keeps the error class of the first Jest sandbox that
// loaded it, so in later test files its errors fail `instanceof Error`.
// Re-throw them as errors of the current sandbox.
function sql<T>(fn: () => T): T {
  try {
    return fn();
  } catch (e) {
    throw new Error((e as { message?: string }).message ?? String(e));
  }
}

// In-memory SQLite for tests, behind the same SqlDb interface as
// expo-sqlite on the phone.
export function openTestDb(): SqlDb & { raw: Database.Database } {
  const raw = new Database(':memory:');
  raw.pragma('foreign_keys = ON');
  return {
    raw,
    async execAsync(source) {
      sql(() => raw.exec(source));
    },
    async runAsync(source, params: SqlValue[]) {
      const r = sql(() => raw.prepare(source).run(...params));
      return { changes: r.changes };
    },
    async getAllAsync<T>(source: string, params: SqlValue[]) {
      return sql(() => {
        const stmt = raw.prepare(source);
        return (stmt.reader ? stmt.all(...params) : []) as T[];
      });
    },
    async getFirstAsync<T>(source: string, params: SqlValue[]) {
      return sql(() => {
        const stmt = raw.prepare(source);
        return ((stmt.reader ? stmt.get(...params) : undefined) ?? null) as T | null;
      });
    },
    async withTransactionAsync(task) {
      raw.exec('BEGIN');
      try {
        await task();
        raw.exec('COMMIT');
      } catch (e) {
        raw.exec('ROLLBACK');
        throw e;
      }
    },
  };
}

/** Deterministic ids and clock for tests. */
export function testDeps(start = new Date('2026-01-01T03:00:00Z')): RepoDeps & { tick(ms: number): void } {
  let n = 0;
  let t = start.getTime();
  return {
    uuid: () => {
      n += 1;
      return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
    },
    clock: { now: () => new Date(t), skewMs: () => null },
    tick: (ms) => {
      t += ms;
    },
  };
}

export async function openTestRepo() {
  const db = openTestDb();
  const deps = testDeps();
  await migrate(db);
  await ensureDevice(db, deps.uuid);
  return { db, deps, repo: createRepository(db, deps) };
}
