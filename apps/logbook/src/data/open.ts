import * as Crypto from 'expo-crypto';
import * as SQLite from 'expo-sqlite';

import { seedDevFixtures } from '../dev/fixtures/seed';
import { createRepository, ensureDevice, type RepoDeps, type Repository } from './repository';
import { migrate } from './schema';
import type { SqlDb } from './sql';

export const defaultDeps: RepoDeps = {
  uuid: () => Crypto.randomUUID(),
  // No trusted time source yet, so skew is unknown (null). Never corrected.
  clock: { now: () => new Date(), skewMs: () => null },
};

/** Opens the on-device database, migrates it and returns the repository. */
export async function openLogbook(deps: RepoDeps = defaultDeps): Promise<Repository> {
  const native = await SQLite.openDatabaseAsync('logbook.db');
  await native.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const db: SqlDb = native;
  await migrate(db);
  await ensureDevice(db, deps.uuid);
  const repo = createRepository(db, deps);
  // EXPO_PUBLIC_DEV_SEED (comma list): no-open-trip seeds without an open
  // trip (to try S1); history adds older trips (to try My grounds).
  if (__DEV__) {
    const flags = (process.env.EXPO_PUBLIC_DEV_SEED ?? '').split(',');
    await seedDevFixtures(db, deps, {
      openTrip: !flags.includes('no-open-trip'),
      history: flags.includes('history'),
    });
  }
  return repo;
}
