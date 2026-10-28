import { migrate, MIGRATIONS } from '../schema';
import { openTestRepo } from '../../test/sqlite';
import { seedDevReference } from '../../dev/fixtures/seed';
import { devSpecies } from '../../dev/fixtures/reference';

async function seeded() {
  const ctx = await openTestRepo();
  await seedDevReference(ctx.db);
  await ctx.repo.startTrip({ crewDeparted: 4, departureAt: ctx.deps.clock.now() });
  const trip = (await ctx.repo.getOpenTrip())!;
  const species = devSpecies.find((s) => s.local_name === 'tewa')!;
  const c = await ctx.repo.logCatch({ speciesId: species.id, quantity: 2400, gps: null });
  return { ...ctx, trip, c };
}

describe('schema', () => {
  it('migrates to the latest version and is safe to run again', async () => {
    const { db } = await openTestRepo();
    await migrate(db);
    const v = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version', []);
    expect(v?.user_version).toBe(MIGRATIONS.length);
  });

  it.each(['trip_starts', 'catches', 'catch_corrections', 'trip_closes'])(
    '%s rejects UPDATE and DELETE (append-only)',
    async (table) => {
      const { db, repo, c, trip } = await seeded();
      await repo.correctCatch({ catchId: c.id, previousCorrectionId: null, quantity: 2500 });
      await repo.closeTrip({
        tripId: trip.trip_id,
        arrivalAt: new Date('2026-01-01T09:00:00Z'),
        crewReturned: 4,
        landingSiteId: (await repo.getLandingSites())[0].id,
        distanceKm: null,
      });
      await expect(db.runAsync(`UPDATE ${table} SET recorded_at = 'x'`, [])).rejects.toThrow(
        /append-only/,
      );
      await expect(db.runAsync(`DELETE FROM ${table}`, [])).rejects.toThrow(/append-only/);
    },
  );

  it.each(['trip_starts', 'catches', 'catch_corrections', 'trip_closes'])(
    '%s rejects INSERT OR REPLACE over a saved row (append-only)',
    async (table) => {
      const { db, repo, c, trip } = await seeded();
      await repo.correctCatch({ catchId: c.id, previousCorrectionId: null, quantity: 2500 });
      await repo.closeTrip({
        tripId: trip.trip_id,
        arrivalAt: new Date('2026-01-01T09:00:00Z'),
        crewReturned: 4,
        landingSiteId: (await repo.getLandingSites())[0].id,
        distanceKm: null,
      });
      const row = (await db.getFirstAsync<Record<string, string | number | null>>(
        `SELECT * FROM ${table}`,
        [],
      ))!;
      const cols = Object.keys(row);
      const changed: Record<string, string | number | null> = { ...row, recorded_at: '1999-01-01T00:00:00.000Z' };
      await expect(
        db.runAsync(
          `INSERT OR REPLACE INTO ${table} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`,
          cols.map((k) => changed[k]),
        ),
      ).rejects.toThrow(/append-only/);
      expect(await db.getFirstAsync(`SELECT * FROM ${table} WHERE id = ?`, [row.id])).toEqual(row);
    },
  );

  it('rejects a quantity that is not whole kg of at least 1, or a unit other than kg', async () => {
    const { db, c } = await seeded();
    const insert = (id: string, quantity: number, unit: string) =>
      db.runAsync(
        `INSERT INTO catches (id, device_id, recorded_at, trip_id, vessel_id, captain_id, species_id,
           species_local_name, quantity, unit, tier, short_ref)
         SELECT ?, device_id, recorded_at, trip_id, vessel_id, captain_id, species_id,
           species_local_name, ?, ?, 'S', 'X' FROM catches WHERE id = ?`,
        [id, quantity, unit, c.id],
      );
    await expect(insert('a', 0, 'kg')).rejects.toThrow(/CHECK/);
    await expect(insert('b', 1.5, 'kg')).rejects.toThrow(/CHECK/);
    await expect(insert('c', 15, 't')).rejects.toThrow(/CHECK/);
    await expect(insert('d', 15, 'kg')).resolves.toBeTruthy();
    await expect(insert('e', 1, 'kg')).resolves.toBeTruthy();
  });

  it('accepts a null species_id for "Other" but always needs the local name', async () => {
    const { db, c } = await seeded();
    const insert = (id: string, name: string | null) =>
      db.runAsync(
        `INSERT INTO catches (id, device_id, recorded_at, trip_id, vessel_id, captain_id, species_id,
           species_local_name, quantity, unit, tier, short_ref)
         SELECT ?, device_id, recorded_at, trip_id, vessel_id, captain_id, NULL,
           ?, 15, 'kg', 'S', 'X' FROM catches WHERE id = ?`,
        [id, name, c.id],
      );
    await expect(insert('a', null)).rejects.toThrow(/NOT NULL/);
    await expect(insert('b', 'pweza mdogo')).resolves.toBeTruthy();
  });

  it('identifies a trip by its trip_start id', async () => {
    const { db, trip } = await seeded();
    expect(trip.trip_id).toBe(trip.id);
    await expect(
      db.runAsync(
        `INSERT INTO trip_starts (id, device_id, recorded_at, trip_id, vessel_id, captain_id,
           crew_departed, departure_at)
         SELECT 'other-id', device_id, recorded_at, 'another-trip', vessel_id, captain_id, 4, departure_at
           FROM trip_starts WHERE id = ?`,
        [trip.id],
      ),
    ).rejects.toThrow(/CHECK/);
  });

  it('keeps crew_departed within 1-24 and crew_returned within 0-24', async () => {
    const { db, repo, trip } = await seeded();
    const start = (id: string, crew: number) =>
      db.runAsync(
        `INSERT INTO trip_starts (id, device_id, recorded_at, trip_id, vessel_id, captain_id,
           crew_departed, departure_at)
         SELECT ?, device_id, recorded_at, ?, vessel_id, captain_id, ?, departure_at
           FROM trip_starts WHERE id = ?`,
        [id, id, crew, trip.id],
      );
    await expect(start('s0', 0)).rejects.toThrow(/CHECK/);
    await expect(start('s25', 25)).rejects.toThrow(/CHECK/);
    const site = (await repo.getLandingSites())[0].id;
    const close = (id: string, crew: number) =>
      db.runAsync(
        `INSERT INTO trip_closes (id, device_id, recorded_at, trip_id, arrival_at, crew_returned,
           landing_site_id, catch_ids, total_quantity, unit)
         VALUES (?, 'd', 'r', ?, 'r', ?, ?, '[]', 0, 'kg')`,
        [id, trip.trip_id, crew, site],
      );
    await expect(close('c-1', -1)).rejects.toThrow(/CHECK/);
    await expect(close('c25', 25)).rejects.toThrow(/CHECK/);
    await expect(close('c0', 0)).resolves.toBeTruthy();
  });

  it('allows only one linear correction chain per catch', async () => {
    const { db, repo, c } = await seeded();
    const first = await repo.correctCatch({ catchId: c.id, previousCorrectionId: null, quantity: 2500 });
    // A second "first" correction would fork the chain.
    await expect(
      db.runAsync(
        `INSERT INTO catch_corrections (id, device_id, recorded_at, catch_id, previous_correction_id,
           species_id, species_local_name, quantity, unit)
         SELECT 'fork', device_id, recorded_at, catch_id, NULL, species_id, species_local_name, 3000, 'kg'
           FROM catch_corrections WHERE id = ?`,
        [first.id],
      ),
    ).rejects.toThrow(/UNIQUE/);
  });

  it('rejects a correction linked to a correction of another catch', async () => {
    const { db, repo, c } = await seeded();
    const other = await repo.logCatch({ speciesId: c.species_id!, quantity: 1, gps: null });
    const first = await repo.correctCatch({ catchId: c.id, previousCorrectionId: null, quantity: 2500 });
    await expect(
      db.runAsync(
        `INSERT INTO catch_corrections (id, device_id, recorded_at, catch_id, previous_correction_id,
           species_id, species_local_name, quantity, unit)
         VALUES ('x', 'd', 'r', ?, ?, ?, 'tewa', 1, 'kg')`,
        [other.id, first.id, c.species_id],
      ),
    ).rejects.toThrow(/another catch/);
  });
});
