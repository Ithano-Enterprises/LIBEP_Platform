import { createRepository, ensureDevice } from '../data/repository';
import { migrate, MIGRATIONS } from '../data/schema';
import type { SqlDb } from '../data/sql';
import { devLandingSite } from '../dev/fixtures/reference';
import { seedDevReference } from '../dev/fixtures/seed';
import { openTestDb, testDeps } from '../test/sqlite';
import { count, LEDGER_TABLES, sid } from './helpers';

// Area 7: migrations. A fresh install runs 1 → 2 → 3; a phone already at
// migration 1 or 2 with data upgrades without losing or changing a row.

async function version(db: SqlDb) {
  return (await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version', []))!.user_version;
}

/** Runs only the first n migrations, as an older app build would have. */
async function migrateTo(db: SqlDb, n: number) {
  for (let v = 0; v < n; v++) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(MIGRATIONS[v]);
      await db.execAsync(`PRAGMA user_version = ${v + 1}`);
    });
  }
}

async function tables(db: SqlDb) {
  return (await db.getAllAsync<{ name: string }>("SELECT name FROM sqlite_master WHERE type IN ('table','view') ORDER BY name", [])).map((r) => r.name);
}

async function dump(db: SqlDb, names: string[]) {
  const out: Record<string, unknown[]> = {};
  for (const t of names) out[t] = await db.getAllAsync(`SELECT * FROM ${t} ORDER BY rowid`, []);
  return out;
}

/**
 * Data an older build could have written. At migration 1 the repository's
 * startTrip / logCatch / closeTrip only touch migration 1 tables; the
 * correction goes in by SQL because correctCatch reads plant_weighings.
 */
async function oldData(db: SqlDb, deps: ReturnType<typeof testDeps>) {
  await ensureDevice(db, deps.uuid);
  await seedDevReference(db);
  const repo = createRepository(db, deps);
  const t1 = await repo.startTrip({ crewCount: 3, departureAt: deps.clock.now() });
  deps.tick(60_000);
  const a = await repo.logCatch({ speciesId: sid('tewa'), quantity: 2.4, gps: { latitude: -2.27, longitude: 40.93, gps_accuracy_m: 8 } });
  const b = await repo.logCatch({ speciesId: sid('tafi'), quantity: 0.6, gps: null, note: 'wavu' });
  const dev = (await db.getFirstAsync<{ device_id: string }>('SELECT device_id FROM device_profile', []))!.device_id;
  await db.runAsync(
    `INSERT INTO catch_corrections (id, device_id, recorded_at, device_clock_skew_ms, catch_id, previous_correction_id, reason, species_id, quantity, unit, hold_code, note)
     VALUES ('c0000000-0000-4000-8000-000000000001', ?, ?, -1500, ?, NULL, NULL, ?, 2.1, 't', 'A', NULL)`,
    [dev, deps.clock.now().toISOString(), a.id, sid('tewa')],
  );
  await db.runAsync("UPDATE sync_state SET state = 'sent' WHERE record_id = ?", [t1.id]);
  await repo.closeTrip({ tripId: t1.trip_id, arrivalAt: deps.clock.now(), crewCount: 3, landingSiteId: devLandingSite.id, distanceKm: 4 });
  await db.runAsync("INSERT INTO preferences (key, value) VALUES ('lang', 'en')", []);
  return { trip: t1, a, b };
}

describe('migrations', () => {
  it('fresh install runs 1 → 2 → 3 and ends at user_version 3 with every table', async () => {
    const db = openTestDb();
    expect(await version(db)).toBe(0);
    await migrate(db);
    expect(await version(db)).toBe(MIGRATIONS.length);
    expect(MIGRATIONS.length).toBe(3);
    const names = await tables(db);
    for (const t of [...LEDGER_TABLES, 'sync_state', 'plant_weighings', 'v_catches_effective', 'preferences', 'device_profile']) {
      expect(names).toContain(t);
    }
    const cols = (await db.getAllAsync<{ name: string }>('PRAGMA table_info(sync_state)', [])).map((c) => c.name);
    expect(cols).toEqual(expect.arrayContaining(['attempts', 'last_error']));
  });

  it('running migrate again is a no-op', async () => {
    const db = openTestDb();
    await migrate(db);
    const before = await tables(db);
    await migrate(db);
    expect(await version(db)).toBe(3);
    expect(await tables(db)).toEqual(before);
  });

  it.each([1, 2])('upgrade from migration %i with data keeps every row unchanged', async (from) => {
    const db = openTestDb();
    const deps = testDeps();
    await migrateTo(db, from);
    expect(await version(db)).toBe(from);
    const { trip, b } = await oldData(db, deps);
    if (from === 2) {
      await db.runAsync(
        `INSERT INTO plant_weighings (id, trip_id, species_id, catch_id, weight, unit, weighed_at) VALUES ('d0000000-0000-4000-8000-000000000001', ?, ?, ?, 580, 'kg', ?)`,
        [trip.trip_id, sid('tafi'), b.id, deps.clock.now().toISOString()],
      );
    }
    const keep = [...LEDGER_TABLES, 'preferences', 'device_profile', 'vessels', 'species', 'species_menu', 'hold_codes', 'landing_sites', 'captains', ...(from === 2 ? ['plant_weighings'] : [])];
    const before = await dump(db, keep);
    const syncBefore = await db.getAllAsync<Record<string, unknown>>('SELECT record_id, kind, state, updated_at FROM sync_state ORDER BY record_id', []);
    const effectiveBefore = await db.getAllAsync('SELECT * FROM v_catches_effective ORDER BY id', []);

    await migrate(db);
    expect(await version(db)).toBe(3);
    expect(await dump(db, keep)).toEqual(before);
    const syncAfter = await db.getAllAsync<Record<string, unknown>>('SELECT * FROM sync_state ORDER BY record_id', []);
    expect(syncAfter.map(({ attempts: _a, last_error: _e, ...r }) => r)).toEqual(syncBefore);
    expect(syncAfter.every((r) => r.attempts === 0 && r.last_error === null)).toBe(true);
    expect(await db.getAllAsync('SELECT * FROM v_catches_effective ORDER BY id', [])).toEqual(effectiveBefore);

    // The upgraded store works with the current repository.
    const repo = createRepository(db, deps);
    expect((await repo.getEntry(b.id))!.plant_weight_t).toBe(from === 2 ? 0.58 : null);
    const prefs = await repo.getPreferences();
    expect(prefs.lang).toBe('en');
    await repo.startTrip({ crewCount: 2, departureAt: deps.clock.now() });
    const c = await repo.logCatch({ speciesId: sid('nguru'), quantity: 1, gps: null });
    await repo.correctCatch({ catchId: c.id, previousCorrectionId: null, quantity: 1.5 });
    const q = repo.syncQueue({ send: async (batch) => ({ status: 200, body: { results: batch.records.map((r) => ({ id: String(r.data.id), status: 'inserted' })) } }) });
    await q.runOnce();
    expect(await q.pending()).toHaveLength(0);
    // Append-only still holds after the upgrade.
    await expect(db.runAsync('DELETE FROM catches', [])).rejects.toThrow(/append-only/);
    expect(await count(db, 'catches')).toBe(3);
  });

  it('a migration that fails part-way leaves the store at the previous version', async () => {
    const db = openTestDb();
    await migrateTo(db, 2);
    // Simulate a column that already exists, so migration 3 fails on its second ALTER.
    await db.execAsync('ALTER TABLE sync_state ADD COLUMN last_error TEXT');
    await expect(migrate(db)).rejects.toThrow();
    expect(await version(db)).toBe(2);
    const cols = (await db.getAllAsync<{ name: string }>('PRAGMA table_info(sync_state)', [])).map((c) => c.name);
    expect(cols).not.toContain('attempts');
  });
});
