import { defaultDeps } from '../data/open';
import { createRepository, ensureDevice, isValidCrew, isValidQuantity, type RepoDeps } from '../data/repository';
import { migrate } from '../data/schema';
import type { SqlDb } from '../data/sql';
import { devLandingSite } from '../dev/fixtures/reference';
import { seedDevReference } from '../dev/fixtures/seed';
import { parseEntry, pressKey, type Key } from '../screens/logCatch/model';
import { openTestDb, testDeps } from '../test/sqlite';
import { count, LEDGER_TABLES, seeded, sid } from './helpers';

// Area 2: data rules at the repository level (ADR 0001, frontend data
// contract §2, backend contract proposal §2/§4).

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const RFC3339_TZ = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
const MIN = 60_000;

// jest-expo stubs expo-crypto; give it a real generator so the app's own
// defaultDeps (open.ts) can be exercised.
jest.mock('expo-crypto', () => ({ randomUUID: () => jest.requireActual<typeof import('crypto')>('crypto').randomUUID() }));
jest.mock('expo-sqlite', () => ({}));

/** A store with reference data, built on the given deps. */
async function storeWith(deps: RepoDeps, db: SqlDb = openTestDb()) {
  await migrate(db);
  await ensureDevice(db, deps.uuid);
  await seedDevReference(db);
  return { db, repo: createRepository(db, deps) };
}

/** One trip with catches, a correction chain and a close. */
async function fullTrip(repo: ReturnType<typeof createRepository>, tick: (ms: number) => void) {
  const trip = await repo.startTrip({ crewCount: 4, departureAt: new Date('2026-01-01T03:00:00Z') });
  tick(MIN);
  const a = await repo.logCatch({ speciesId: sid('tewa'), quantity: 2.4, gps: { latitude: -2.27, longitude: 40.93, gps_accuracy_m: 9 } });
  tick(MIN);
  const b = await repo.logCatch({ speciesId: sid('nguru'), quantity: 1.1, gps: null, note: ' net 2 ' });
  tick(MIN);
  const c1 = await repo.correctCatch({ catchId: a.id, previousCorrectionId: null, quantity: 2.0 });
  tick(MIN);
  const c2 = await repo.correctCatch({ catchId: a.id, previousCorrectionId: c1.id, speciesId: sid('kibua') });
  tick(MIN);
  const close = await repo.closeTrip({ tripId: trip.trip_id, arrivalAt: new Date('2026-01-01T09:00:00Z'), crewCount: 4, landingSiteId: devLandingSite.id, distanceKm: 12.5 });
  return { trip, a, b, c1, c2, close };
}

describe('ids and times', () => {
  it('every id the app makes is a UUIDv4 (production generator)', async () => {
    let t = Date.parse('2026-03-01T04:00:00Z');
    const deps: RepoDeps = { uuid: defaultDeps.uuid, clock: { now: () => new Date(t), skewMs: () => null } };
    const { db, repo } = await storeWith(deps);
    await fullTrip(repo, (ms) => (t += ms));
    const ids: string[] = [];
    for (const table of LEDGER_TABLES) {
      const rows = await db.getAllAsync<Record<string, string | null>>(`SELECT * FROM ${table}`, []);
      for (const r of rows) {
        ids.push(r.id!, r.device_id!);
        if (r.trip_id) ids.push(r.trip_id);
        if (r.catch_id) ids.push(r.catch_id);
        if (r.previous_correction_id) ids.push(r.previous_correction_id);
      }
    }
    expect(ids.length).toBeGreaterThan(10);
    for (const id of ids) expect(id).toMatch(UUID_V4);
    const device = await db.getFirstAsync<{ device_id: string }>('SELECT device_id FROM device_profile', []);
    expect(device!.device_id).toMatch(UUID_V4);
  });

  it('recorded_at, departure_at and arrival_at are RFC 3339 with a timezone', async () => {
    const ctx = await seeded();
    await fullTrip(ctx.repo, ctx.deps.tick);
    for (const table of LEDGER_TABLES) {
      const rows = await ctx.db.getAllAsync<Record<string, string | null>>(`SELECT * FROM ${table}`, []);
      for (const r of rows) {
        expect(r.recorded_at).toMatch(RFC3339_TZ);
        if ('departure_at' in r) expect(r.departure_at).toMatch(RFC3339_TZ);
        if ('arrival_at' in r) expect(r.arrival_at).toMatch(RFC3339_TZ);
      }
    }
    for (const r of await ctx.db.getAllAsync<{ updated_at: string }>('SELECT updated_at FROM sync_state', [])) {
      expect(r.updated_at).toMatch(RFC3339_TZ);
    }
  });

  it('device_clock_skew_ms is stored exactly as measured and times are not corrected', async () => {
    for (const skew of [-3_600_000, 0, 1, 987_654_321, null]) {
      const base = testDeps(new Date('2026-05-05T05:05:05.123Z'));
      const deps: RepoDeps = { uuid: base.uuid, clock: { now: base.clock.now, skewMs: () => skew } };
      const { db, repo } = await storeWith(deps);
      await fullTrip(repo, base.tick);
      for (const table of LEDGER_TABLES) {
        const rows = await db.getAllAsync<{ device_clock_skew_ms: number | null; recorded_at: string }>(
          `SELECT device_clock_skew_ms, recorded_at FROM ${table}`,
          [],
        );
        for (const r of rows) expect(r.device_clock_skew_ms).toBe(skew);
      }
      // The first record is stamped with the device clock as is.
      const start = await db.getFirstAsync<{ recorded_at: string }>('SELECT recorded_at FROM trip_starts', []);
      expect(start!.recorded_at).toBe('2026-05-05T05:05:05.123Z');
    }
  });
});

describe('append-only ledger', () => {
  it.each(LEDGER_TABLES)('%s: UPDATE and DELETE are rejected by triggers, rows unchanged', async (table) => {
    const ctx = await seeded();
    await fullTrip(ctx.repo, ctx.deps.tick);
    const before = await ctx.db.getAllAsync(`SELECT * FROM ${table} ORDER BY id`, []);
    expect(before.length).toBeGreaterThan(0);
    await expect(ctx.db.runAsync(`UPDATE ${table} SET recorded_at = recorded_at`, [])).rejects.toThrow(/append-only/);
    await expect(ctx.db.runAsync(`DELETE FROM ${table}`, [])).rejects.toThrow(/append-only/);
    // Upsert is an update too.
    const row = before[0] as Record<string, unknown>;
    const cols = Object.keys(row);
    await expect(
      ctx.db.runAsync(
        `INSERT INTO ${table} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})
         ON CONFLICT (id) DO UPDATE SET recorded_at = excluded.recorded_at`,
        cols.map((c) => row[c] as string | number | null),
      ),
    ).rejects.toThrow(/append-only/);
    expect(await ctx.db.getAllAsync(`SELECT * FROM ${table} ORDER BY id`, [])).toEqual(before);
  });

  // BUG-4: INSERT OR REPLACE silently overwrites a ledger row. REPLACE
  // deletes the old row without firing the BEFORE DELETE trigger (SQLite
  // only fires delete triggers on REPLACE with recursive_triggers on), so
  // the append-only rule can be bypassed by one statement.
  it.failing.each(LEDGER_TABLES)('%s: INSERT OR REPLACE cannot overwrite a saved row', async (table) => {
    const ctx = await seeded();
    await fullTrip(ctx.repo, ctx.deps.tick);
    const row = (await ctx.db.getFirstAsync<Record<string, unknown>>(`SELECT * FROM ${table} ORDER BY id`, []))!;
    const cols = Object.keys(row);
    const changed: Record<string, unknown> = { ...row, recorded_at: '1999-01-01T00:00:00.000Z' };
    await ctx.db
      .runAsync(`INSERT OR REPLACE INTO ${table} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`, cols.map((c) => changed[c] as string | number | null))
      .catch(() => undefined);
    const after = await ctx.db.getFirstAsync<Record<string, unknown>>(`SELECT * FROM ${table} WHERE id = ?`, [row.id as string]);
    expect(after).toEqual(row);
  });

  it('migrations 2 and 3 keep every append-only trigger and add none to device-only tables by mistake', async () => {
    const ctx = await seeded();
    const triggers = await ctx.db.getAllAsync<{ name: string; tbl_name: string }>(
      "SELECT name, tbl_name FROM sqlite_master WHERE type = 'trigger' ORDER BY name",
      [],
    );
    for (const t of LEDGER_TABLES) {
      expect(triggers).toEqual(expect.arrayContaining([{ name: `${t}_no_update`, tbl_name: t }, { name: `${t}_no_delete`, tbl_name: t }]));
    }
    // sync_state (migration 3 columns) must stay writable: it is the only mutable record bookkeeping.
    await ctx.repo.startTrip({ crewCount: 4, departureAt: ctx.deps.clock.now() });
    await expect(ctx.db.runAsync("UPDATE sync_state SET attempts = attempts + 1, last_error = 'x'", [])).resolves.toBeDefined();
  });

  // BUG-5: plant_weighings (migration 2) has no append-only triggers. Deleting
  // or editing the cached weight silently re-opens corrections on a catch the
  // plant has weighed (contract §2: corrections close once W exists).
  // [TO CONFIRM: whether the device cache of plant weights is part of the ledger]
  it.failing('plant_weighings (migration 2): a cached weight cannot be deleted or edited', async () => {
    const ctx = await seeded();
    const { trip, b } = await fullTrip(ctx.repo, ctx.deps.tick);
    await ctx.repo.applyPlantWeighing({ id: '11111111-1111-4111-8111-111111111111', trip_id: trip.trip_id, species_id: sid('nguru'), catch_id: b.id, weight: 1.0, unit: 't', weighed_at: ctx.deps.clock.now().toISOString() });
    await ctx.db.runAsync('DELETE FROM plant_weighings', []).catch(() => undefined);
    await ctx.db.runAsync('UPDATE plant_weighings SET weight = 9', []).catch(() => undefined);
    expect(await ctx.repo.getPlantWeighing(b.id)).toMatchObject({ weight: 1.0 });
  });

  it('a repeated plant weighing report is ignored, the first is kept', async () => {
    const ctx = await seeded();
    const { trip, b } = await fullTrip(ctx.repo, ctx.deps.tick);
    const w = { id: '11111111-1111-4111-8111-111111111111', trip_id: trip.trip_id, species_id: sid('nguru'), catch_id: b.id, weight: 1.0, unit: 't' as const, weighed_at: ctx.deps.clock.now().toISOString() };
    await ctx.repo.applyPlantWeighing(w);
    await ctx.repo.applyPlantWeighing({ ...w, weight: 5 });
    expect((await ctx.repo.getPlantWeighing(b.id))!.weight).toBe(1.0);
  });
});

describe('corrections', () => {
  it('the chain is read in link order even when the clock went backwards between corrections', async () => {
    const ctx = await seeded();
    await ctx.repo.startTrip({ crewCount: 4, departureAt: ctx.deps.clock.now() });
    const c = await ctx.repo.logCatch({ speciesId: sid('tewa'), quantity: 5, gps: null });
    ctx.deps.tick(10 * MIN);
    const c1 = await ctx.repo.correctCatch({ catchId: c.id, previousCorrectionId: null, quantity: 4 });
    ctx.deps.tick(-60 * MIN); // device clock set back
    const c2 = await ctx.repo.correctCatch({ catchId: c.id, previousCorrectionId: c1.id, quantity: 3 });
    ctx.deps.tick(5 * MIN);
    const c3 = await ctx.repo.correctCatch({ catchId: c.id, previousCorrectionId: c2.id, speciesId: sid('nguru') });
    const h = (await ctx.repo.getCatchHistory(c.id))!;
    expect(h.original.quantity).toBe(5);
    expect(h.corrections.map((x) => x.id)).toEqual([c1.id, c2.id, c3.id]);
    const e = (await ctx.repo.getEntry(c.id))!;
    expect(e.head_correction_id).toBe(c3.id);
    expect(e.quantity).toBe(3);
    expect(e.species_local_name).toBe('nguru');
    expect(e.hold_code).toBe('B');
    expect(e.correction_count).toBe(3);
  });

  it('a stale or forked correction is refused and nothing is written', async () => {
    const ctx = await seeded();
    await ctx.repo.startTrip({ crewCount: 4, departureAt: ctx.deps.clock.now() });
    const c = await ctx.repo.logCatch({ speciesId: sid('tewa'), quantity: 5, gps: null });
    const c1 = await ctx.repo.correctCatch({ catchId: c.id, previousCorrectionId: null, quantity: 4 });
    await expect(ctx.repo.correctCatch({ catchId: c.id, previousCorrectionId: null, quantity: 3 })).rejects.toMatchObject({ code: 'stale_correction' });
    const other = await ctx.repo.logCatch({ speciesId: sid('tafi'), quantity: 1, gps: null });
    await expect(ctx.repo.correctCatch({ catchId: other.id, previousCorrectionId: c1.id, quantity: 2 })).rejects.toMatchObject({ code: 'stale_correction' });
    await expect(ctx.repo.correctCatch({ catchId: 'nope', previousCorrectionId: null, quantity: 2 })).rejects.toMatchObject({ code: 'unknown_catch' });
    expect(await count(ctx.db, 'catch_corrections')).toBe(1);
    // The schema blocks a fork even if the repository check were skipped.
    await expect(
      ctx.db.runAsync(
        `INSERT INTO catch_corrections (id, device_id, recorded_at, catch_id, previous_correction_id, species_id, quantity, unit)
         VALUES ('f0000000-0000-4000-8000-000000000001', 'd', '2026-01-01T00:00:00Z', ?, NULL, ?, 1, 't')`,
        [c.id, sid('tewa')],
      ),
    ).rejects.toThrow(/UNIQUE/);
  });

  it('totals use the latest revision: trip home list, close total and by-species', async () => {
    const ctx = await seeded();
    const trip = await ctx.repo.startTrip({ crewCount: 4, departureAt: ctx.deps.clock.now() });
    const a = await ctx.repo.logCatch({ speciesId: sid('tewa'), quantity: 18, gps: null });
    await ctx.repo.logCatch({ speciesId: sid('tafi'), quantity: 0.3, gps: null });
    const c1 = await ctx.repo.correctCatch({ catchId: a.id, previousCorrectionId: null, quantity: 1.8 });
    await ctx.repo.correctCatch({ catchId: a.id, previousCorrectionId: c1.id, quantity: 1.9 });
    const entries = await ctx.repo.listTripEntries(trip.trip_id);
    expect(entries.map((e) => e.quantity).sort()).toEqual([0.3, 1.9]);
    const close = await ctx.repo.closeTrip({ tripId: trip.trip_id, arrivalAt: ctx.deps.clock.now(), crewCount: 4, landingSiteId: devLandingSite.id, distanceKm: null });
    expect(close.total_quantity).toBe(2.2);
  });

  it('corrections are refused once the plant has weighed the catch (t or kg)', async () => {
    const ctx = await seeded();
    const trip = await ctx.repo.startTrip({ crewCount: 4, departureAt: ctx.deps.clock.now() });
    const a = await ctx.repo.logCatch({ speciesId: sid('tewa'), quantity: 2, gps: null });
    const b = await ctx.repo.logCatch({ speciesId: sid('tafi'), quantity: 1, gps: null });
    await ctx.repo.applyPlantWeighing({ id: '21111111-1111-4111-8111-111111111111', trip_id: trip.trip_id, species_id: sid('tewa'), catch_id: a.id, weight: 2.1, unit: 't', weighed_at: ctx.deps.clock.now().toISOString() });
    await ctx.repo.applyPlantWeighing({ id: '31111111-1111-4111-8111-111111111111', trip_id: trip.trip_id, species_id: sid('tafi'), catch_id: b.id, weight: 950, unit: 'kg', weighed_at: ctx.deps.clock.now().toISOString() });
    for (const id of [a.id, b.id]) {
      await expect(ctx.repo.correctCatch({ catchId: id, previousCorrectionId: null, quantity: 3 })).rejects.toMatchObject({ code: 'corrections_closed' });
    }
    expect(await count(ctx.db, 'catch_corrections')).toBe(0);
    expect((await ctx.repo.getEntry(b.id))!.plant_weight_t).toBe(0.95);
  });
});

describe('trips', () => {
  it('only one trip can be open (sequential calls)', async () => {
    const ctx = await seeded();
    await ctx.repo.startTrip({ crewCount: 4, departureAt: ctx.deps.clock.now() });
    await expect(ctx.repo.startTrip({ crewCount: 4, departureAt: ctx.deps.clock.now() })).rejects.toMatchObject({ code: 'trip_already_open' });
    expect(await count(ctx.db, 'trip_starts', 'trip_id NOT IN (SELECT trip_id FROM trip_closes)')).toBe(1);
  });

  // BUG-1 (data layer): two startTrip calls that overlap both pass the
  // "no open trip" check before either inserts, so two trips are open. The
  // check runs outside the write transaction. Here transactions are queued
  // one after the other, as a real SQLite connection would run them.
  it.failing('two concurrent startTrip calls: exactly one succeeds, one open trip', async () => {
    const raw = openTestDb();
    let chain: Promise<void> = Promise.resolve();
    const db: SqlDb = {
      ...raw,
      withTransactionAsync(task) {
        const run = chain.then(() => raw.withTransactionAsync(task));
        chain = run.catch(() => undefined);
        return run;
      },
    };
    const deps = testDeps();
    const { repo } = await storeWith(deps, db);
    const results = await Promise.allSettled([
      repo.startTrip({ crewCount: 4, departureAt: deps.clock.now() }),
      repo.startTrip({ crewCount: 4, departureAt: deps.clock.now() }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await count(db, 'trip_starts', 'trip_id NOT IN (SELECT trip_id FROM trip_closes)')).toBe(1);
  });

  it('a catch needs an open trip; a closed trip cannot be closed again', async () => {
    const ctx = await seeded();
    await expect(ctx.repo.logCatch({ speciesId: sid('tewa'), quantity: 1, gps: null })).rejects.toMatchObject({ code: 'no_open_trip' });
    const trip = await ctx.repo.startTrip({ crewCount: 4, departureAt: ctx.deps.clock.now() });
    const input = { tripId: trip.trip_id, arrivalAt: ctx.deps.clock.now(), crewCount: 4, landingSiteId: devLandingSite.id, distanceKm: null };
    await ctx.repo.closeTrip(input);
    await expect(ctx.repo.closeTrip(input)).rejects.toMatchObject({ code: 'no_open_trip' });
    await expect(ctx.repo.logCatch({ speciesId: sid('tewa'), quantity: 1, gps: null })).rejects.toMatchObject({ code: 'no_open_trip' });
  });

  it('a trip with zero catches can be closed: total 0, no catch ids', async () => {
    const ctx = await seeded();
    const trip = await ctx.repo.startTrip({ crewCount: 4, departureAt: ctx.deps.clock.now() });
    const close = await ctx.repo.closeTrip({ tripId: trip.trip_id, arrivalAt: ctx.deps.clock.now(), crewCount: 4, landingSiteId: devLandingSite.id, distanceKm: null });
    expect(close.total_quantity).toBe(0);
    expect(close.catch_ids).toEqual([]);
    expect(await ctx.repo.getOpenTrip()).toBeNull();
    expect((await ctx.repo.getTripClose(trip.trip_id))!.catch_ids).toEqual([]);
  });

  it.each([
    [0, false], [1, true], [24, true], [25, false], [-1, false], [1.5, false], [NaN, false],
  ])('crew %p valid=%p at start and close, and in the schema', async (crew, valid) => {
    expect(isValidCrew(crew)).toBe(valid);
    const ctx = await seeded();
    const start = ctx.repo.startTrip({ crewCount: crew, departureAt: ctx.deps.clock.now() });
    if (!valid) {
      await expect(start).rejects.toMatchObject({ code: 'invalid_crew' });
      const trip = await ctx.repo.startTrip({ crewCount: 4, departureAt: ctx.deps.clock.now() });
      await expect(
        ctx.repo.closeTrip({ tripId: trip.trip_id, arrivalAt: ctx.deps.clock.now(), crewCount: crew, landingSiteId: devLandingSite.id, distanceKm: null }),
      ).rejects.toMatchObject({ code: 'invalid_crew' });
    } else {
      const trip = await start;
      const close = await ctx.repo.closeTrip({ tripId: trip.trip_id, arrivalAt: ctx.deps.clock.now(), crewCount: crew, landingSiteId: devLandingSite.id, distanceKm: null });
      expect(close.crew_count).toBe(crew);
    }
  });
});

describe('quantity edge values', () => {
  it.each([
    [0, false], [0.05, false], [0.1, true], [0.3, true], [99.9, true], [100, true], [100.1, true], [250, true],
    [-1, false], [NaN, false], [Infinity, false], [1.25, false],
  ])('quantity %p valid=%p for a catch and a correction', async (q, valid) => {
    expect(isValidQuantity(q)).toBe(valid);
    const ctx = await seeded();
    await ctx.repo.startTrip({ crewCount: 4, departureAt: ctx.deps.clock.now() });
    const save = ctx.repo.logCatch({ speciesId: sid('tewa'), quantity: q, gps: null });
    if (valid) {
      expect((await save).quantity).toBe(q);
    } else {
      await expect(save).rejects.toMatchObject({ code: 'invalid_quantity' });
      expect(await count(ctx.db, 'catches', 'trip_id = ?', [(await ctx.repo.getOpenTrip())!.trip_id])).toBe(0);
    }
    const c = await ctx.repo.logCatch({ speciesId: sid('tafi'), quantity: 1, gps: null });
    const corr = ctx.repo.correctCatch({ catchId: c.id, previousCorrectionId: null, quantity: q });
    if (valid) await expect(corr).resolves.toMatchObject({ quantity: q });
    else await expect(corr).rejects.toMatchObject({ code: 'invalid_quantity' });
  });

  it('the schema refuses quantity 0 even past the repository', async () => {
    const ctx = await seeded();
    const trip = await ctx.repo.startTrip({ crewCount: 4, departureAt: ctx.deps.clock.now() });
    const c = (await ctx.repo.logCatch({ speciesId: sid('tewa'), quantity: 1, gps: null })) as unknown as Record<string, unknown>;
    const row: Record<string, unknown> = { ...c, id: 'e0000000-0000-4000-8000-000000000001', quantity: 0, trip_id: trip.trip_id };
    const cols = Object.keys(row);
    await expect(
      ctx.db.runAsync(`INSERT INTO catches (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`, cols.map((k) => row[k] as string | number | null)),
    ).rejects.toThrow(/CHECK/);
  });

  it('the keypad can never produce "1.2.3": a second dot is ignored', () => {
    let v = '';
    for (const k of ['1', '.', '2', '.', '3'] as Key[]) v = pressKey(v, k);
    expect(v).toBe('1.2');
  });

  it.each(['', '.', '0', '0.', '0.0', '-1'])('parseEntry(%p) is null', (s) => {
    expect(parseEntry(s)).toBeNull();
  });

  // BUG-6 (latent): parseEntry accepts malformed figures ("1.2.3" → 1.2,
  // "2abc" → 2) and two-decimal figures the store refuses ("0.05", "1.25").
  // The built-in keypad cannot produce them today (see the next test), but
  // any other input path would enable Save for a value logCatch rejects with
  // a raw "invalid_quantity" message.
  it.failing.each(['1.2.3', '2abc', '0.05', '1.25'])('parseEntry(%p) is null (not a valid quantity)', (s) => {
    expect(parseEntry(s)).toBeNull();
  });

  it('every figure the keypad produces that parseEntry accepts is a valid quantity', () => {
    const keys: Key[] = ['0', '1', '5', '9', '.', 'back'];
    const seen = new Set<string>(['']);
    let frontier = [''];
    for (let depth = 0; depth < 6; depth++) {
      const next: string[] = [];
      for (const v of frontier) for (const k of keys) {
        const n = pressKey(v, k);
        if (!seen.has(n)) {
          seen.add(n);
          next.push(n);
        }
      }
      frontier = next;
    }
    for (const v of seen) {
      const q = parseEntry(v);
      if (q != null) expect([v, isValidQuantity(q)]).toEqual([v, true]);
    }
  });
});
