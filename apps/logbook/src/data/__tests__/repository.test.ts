import { DataError, isValidQuantity, makeShortRef } from '../repository';
import { openTestRepo } from '../../test/sqlite';
import { seedDevFixtures, seedDevReference } from '../../dev/fixtures/seed';
import {
  devHoldCodes,
  devMenus,
  devOpenTripEntries,
  devPreviousTripEntries,
  devSpecies,
  devVessel,
} from '../../dev/fixtures/reference';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const speciesId = (name: string) => devSpecies.find((s) => s.local_name === name)!.id;

async function seeded() {
  const ctx = await openTestRepo();
  await seedDevReference(ctx.db);
  await ctx.repo.startTrip({ crewCount: 4, departureAt: ctx.deps.clock.now() });
  return ctx;
}

const expectCode = async (p: Promise<unknown>, code: DataError['code']) => {
  await expect(p).rejects.toBeInstanceOf(DataError);
  await expect(p).rejects.toMatchObject({ code });
};

describe('quantity rules', () => {
  it('accepts whole kg of at least 1', () => {
    expect(isValidQuantity(15)).toBe(true);
    expect(isValidQuantity(1)).toBe(true);
    expect(isValidQuantity(2400)).toBe(true);
    expect(isValidQuantity(0)).toBe(false);
    expect(isValidQuantity(-1)).toBe(false);
    expect(isValidQuantity(1.5)).toBe(false);
    expect(isValidQuantity(2.4)).toBe(false);
    expect(isValidQuantity(Number.NaN)).toBe(false);
    expect(isValidQuantity(Number.POSITIVE_INFINITY)).toBe(false);
  });

  it('builds a short display ref', () => {
    expect(makeShortRef('3f2a1b00-0000-4000-8000-000000000000', 8)).toBe('3F2A-008');
  });
});

describe('dev fixtures', () => {
  it('seed once: reference data, one closed trip and an open trip with entries', async () => {
    const ctx = await openTestRepo();
    expect(await seedDevFixtures(ctx.db, ctx.deps)).toBe(true);
    expect(await seedDevFixtures(ctx.db, ctx.deps)).toBe(false);

    const profile = await ctx.repo.getDeviceProfile();
    expect(profile?.vessel.name).toBe(devVessel.name);
    expect(profile?.home_site.name).toBe('Mokowe');

    const open = (await ctx.repo.getOpenTrip())!;
    const entries = await ctx.repo.listTripEntries(open.trip_id);
    expect(entries).toHaveLength(devOpenTripEntries.length);
    // newest first, states as in the fixture
    expect(entries.map((e) => e.sync_state)).toEqual(
      [...devOpenTripEntries].reverse().map((e) => e.state),
    );
    expect(entries.every((e) => e.recorded_at < ctx.deps.clock.now().toISOString())).toBe(true);

    const closed = await ctx.repo.listClosedTrips();
    expect(closed).toHaveLength(1);
    expect(closed[0].entries).toHaveLength(devPreviousTripEntries.length);
    expect(closed[0].start.departure_at < open.departure_at).toBe(true);
  });

  it('menus come back in the fixture order with hold codes', async () => {
    const { repo } = await seeded();
    const menu = await repo.getSpeciesMenu(20);
    expect(menu.map((m) => m.local_name)).toEqual(devMenus[20]);
    expect(menu.map((m) => m.hold_code)).toEqual(devMenus[20].map((n) => devHoldCodes[n]));
  });
});

describe('trips', () => {
  it('a new trip carries ADR 0001 fields', async () => {
    const { repo, deps } = await seeded();
    const open = (await repo.getOpenTrip())!;
    expect(open.id).toMatch(UUID_V4);
    expect(open.trip_id).toBe(open.id);
    expect(open.recorded_at).toBe('2026-01-01T03:00:00.000Z');
    expect(open.device_clock_skew_ms).toBeNull();
    await expectCode(repo.startTrip({ crewDeparted: 4, departureAt: deps.clock.now() }), 'trip_already_open');
  });

  it('rejects crew departed outside 1-24', async () => {
    const { repo, deps } = await seeded();
    await expectCode(repo.startTrip({ crewDeparted: 0, departureAt: deps.clock.now() }), 'invalid_crew');
    await expectCode(repo.startTrip({ crewDeparted: 25, departureAt: deps.clock.now() }), 'invalid_crew');
  });

  it('rejects crew returned outside 0-24', async () => {
    const { repo, deps } = await seeded();
    const trip = (await repo.getOpenTrip())!;
    const site = (await repo.getLandingSites())[0];
    const close = (crewReturned: number) =>
      repo.closeTrip({ tripId: trip.trip_id, arrivalAt: deps.clock.now(), crewReturned, landingSiteId: site.id, distanceKm: null });
    await expectCode(close(-1), 'invalid_crew');
    await expectCode(close(25), 'invalid_crew');
    await expectCode(close(1.5), 'invalid_crew');
    expect((await close(0)).crew_returned).toBe(0);
  });

  it('keeps the crew change reason only when the counts differ', async () => {
    const { repo, deps } = await seeded();
    const site = (await repo.getLandingSites())[0];
    const first = (await repo.getOpenTrip())!;
    expect(first.crew_departed).toBe(4);
    const same = await repo.closeTrip({
      tripId: first.trip_id,
      arrivalAt: deps.clock.now(),
      crewReturned: 4,
      crewChangeReason: 'not needed',
      landingSiteId: site.id,
      distanceKm: null,
    });
    expect(same.crew_change_reason).toBeNull();

    const second = await repo.startTrip({ crewDeparted: 4, departureAt: deps.clock.now() });
    const differ = await repo.closeTrip({
      tripId: second.trip_id,
      arrivalAt: deps.clock.now(),
      crewReturned: 3,
      crewChangeReason: '  dropped at another landing site  ',
      landingSiteId: site.id,
      distanceKm: null,
    });
    expect(differ).toMatchObject({ crew_returned: 3, crew_change_reason: 'dropped at another landing site' });

    // The reason is optional: a mismatch never blocks the close.
    const third = await repo.startTrip({ crewDeparted: 4, departureAt: deps.clock.now() });
    const noReason = await repo.closeTrip({
      tripId: third.trip_id,
      arrivalAt: deps.clock.now(),
      crewReturned: 5,
      landingSiteId: site.id,
      distanceKm: null,
    });
    expect(noReason).toMatchObject({ crew_returned: 5, crew_change_reason: null });
  });

  it('closing a trip records its catches and total, then no trip is open', async () => {
    const { repo, deps } = await seeded();
    const trip = (await repo.getOpenTrip())!;
    const a = await repo.logCatch({ speciesId: speciesId('tewa'), quantity: 2400, gps: null });
    deps.tick(60_000);
    const b = await repo.logCatch({ speciesId: speciesId('kibua'), quantity: 15, gps: null });
    await repo.correctCatch({ catchId: a.id, previousCorrectionId: null, quantity: 2100 });

    const site = (await repo.getLandingSites())[0];
    const close = await repo.closeTrip({
      tripId: trip.trip_id,
      arrivalAt: deps.clock.now(),
      crewReturned: 4,
      landingSiteId: site.id,
      distanceKm: null,
    });
    expect(close.catch_ids).toEqual([a.id, b.id]);
    expect(close).toMatchObject({ total_quantity: 2115, unit: 'kg' });
    expect(await repo.getOpenTrip()).toBeNull();
    await expectCode(
      repo.logCatch({ speciesId: speciesId('tewa'), quantity: 1, gps: null }),
      'no_open_trip',
    );
  });
});

describe('catches', () => {
  it('stores the measured quantity in whole kg, tier S, local name and hold code', async () => {
    const { repo } = await seeded();
    const gps = { latitude: -2.27, longitude: 40.93, gps_accuracy_m: 15 }; // DEV values
    const c = await repo.logCatch({ speciesId: speciesId('nguru'), quantity: 1200, gps, note: '  ' });
    expect(c).toMatchObject({
      quantity: 1200,
      unit: 'kg',
      tier: 'S',
      species_local_name: 'nguru',
      hold_code: 'B',
      latitude: -2.27,
      gps_accuracy_m: 15,
      note: null,
    });
    expect(c.id).toMatch(UUID_V4);
    expect(c.short_ref).toMatch(/^[0-9A-F]{4}-001$/);
    expect(await repo.getSyncState(c.id)).toBe('on_device');
  });

  it('stores a 15 kg catch as 15 kg', async () => {
    const { repo } = await seeded();
    const c = await repo.logCatch({ speciesId: speciesId('tewa'), quantity: 15, gps: null });
    expect(c).toMatchObject({ quantity: 15, unit: 'kg' });
    const [entry] = await repo.listTripEntries(c.trip_id);
    expect(entry).toMatchObject({ quantity: 15, unit: 'kg' });
  });

  it('rejects bad quantities and unknown species', async () => {
    const { repo } = await seeded();
    await expectCode(repo.logCatch({ speciesId: speciesId('tewa'), quantity: 0, gps: null }), 'invalid_quantity');
    await expectCode(repo.logCatch({ speciesId: speciesId('tewa'), quantity: 1.5, gps: null }), 'invalid_quantity');
    await expectCode(repo.logCatch({ speciesId: 'nope', quantity: 1, gps: null }), 'unknown_species');
  });

  it('stores an "Other" species as typed, with no species id and no hold code', async () => {
    const { repo } = await seeded();
    const c = await repo.logCatch({ speciesId: null, speciesLocalName: 'Pweza mdogo ', quantity: 15, gps: null });
    expect(c).toMatchObject({ species_id: null, species_local_name: 'Pweza mdogo ', hold_code: null });
    const [entry] = await repo.listTripEntries(c.trip_id);
    expect(entry).toMatchObject({ species_id: null, species_local_name: 'Pweza mdogo ' });
    await expectCode(
      repo.logCatch({ speciesId: null, speciesLocalName: '   ', quantity: 15, gps: null }),
      'invalid_species_name',
    );
  });

  it('lists entries newest first with sync state', async () => {
    const { repo, deps } = await seeded();
    const trip = (await repo.getOpenTrip())!;
    const a = await repo.logCatch({ speciesId: speciesId('tewa'), quantity: 2400, gps: null });
    deps.tick(60_000);
    const b = await repo.logCatch({ speciesId: speciesId('mzia'), quantity: 1300, gps: null });
    const list = await repo.listTripEntries(trip.trip_id);
    expect(list.map((e) => e.id)).toEqual([b.id, a.id]);
    expect(list.every((e) => e.sync_state === 'on_device')).toBe(true);
  });
});

describe('corrections', () => {
  it('are new linked records; the original stays and the list shows the latest', async () => {
    const { db, repo, deps } = await seeded();
    const trip = (await repo.getOpenTrip())!;
    const c = await repo.logCatch({ speciesId: speciesId('tewa'), quantity: 2400, gps: null });

    deps.tick(1000);
    const first = await repo.correctCatch({
      catchId: c.id,
      previousCorrectionId: null,
      speciesId: speciesId('kibua'),
      reason: 'wrong fish',
    });
    expect(first.previous_correction_id).toBeNull();
    expect(first.quantity).toBe(2400);
    expect(first.hold_code).toBe('B');

    deps.tick(1000);
    const second = await repo.correctCatch({
      catchId: c.id,
      previousCorrectionId: first.id,
      quantity: 2000,
    });
    expect(second.previous_correction_id).toBe(first.id);
    expect(second.species_id).toBe(speciesId('kibua'));

    const [entry] = await repo.listTripEntries(trip.trip_id);
    expect(entry).toMatchObject({
      id: c.id,
      species_local_name: 'kibua',
      quantity: 2000,
      head_correction_id: second.id,
      correction_count: 2,
    });
    const original = await db.getFirstAsync<{ quantity: number; species_local_name: string }>(
      'SELECT quantity, species_local_name FROM catches WHERE id = ?',
      [c.id],
    );
    expect(original).toEqual({ quantity: 2400, species_local_name: 'tewa' });
    expect(await repo.getSyncState(second.id)).toBe('on_device');
  });

  it('may carry an "Other" species; a later correction keeps the typed name', async () => {
    const { repo, deps } = await seeded();
    const c = await repo.logCatch({ speciesId: speciesId('tewa'), quantity: 15, gps: null });
    deps.tick(1000);
    const first = await repo.correctCatch({
      catchId: c.id,
      previousCorrectionId: null,
      speciesId: null,
      speciesLocalName: 'pweza mdogo',
    });
    expect(first).toMatchObject({ species_id: null, species_local_name: 'pweza mdogo', hold_code: null, quantity: 15 });
    deps.tick(1000);
    const second = await repo.correctCatch({ catchId: c.id, previousCorrectionId: first.id, quantity: 20 });
    expect(second).toMatchObject({ species_id: null, species_local_name: 'pweza mdogo', quantity: 20, unit: 'kg' });
    // The view reads species from the head correction, so null is not masked by the original.
    const [entry] = await repo.listTripEntries(c.trip_id);
    expect(entry).toMatchObject({ species_id: null, species_local_name: 'pweza mdogo', quantity: 20 });
    await expectCode(
      repo.correctCatch({ catchId: c.id, previousCorrectionId: second.id, speciesId: null, speciesLocalName: ' ' }),
      'invalid_species_name',
    );
  });

  it('rejects a stale correction and an unknown catch', async () => {
    const { repo } = await seeded();
    const c = await repo.logCatch({ speciesId: speciesId('tewa'), quantity: 2400, gps: null });
    await repo.correctCatch({ catchId: c.id, previousCorrectionId: null, quantity: 2500 });
    await expectCode(
      repo.correctCatch({ catchId: c.id, previousCorrectionId: null, quantity: 2600 }),
      'stale_correction',
    );
    await expectCode(
      repo.correctCatch({ catchId: 'missing', previousCorrectionId: null, quantity: 1 }),
      'unknown_catch',
    );
  });
});

describe('writes are atomic', () => {
  it('a failed write leaves neither the record nor its sync row', async () => {
    const { db, repo } = await seeded();
    await db.execAsync(
      `CREATE TRIGGER fail_sync BEFORE INSERT ON sync_state
       BEGIN SELECT RAISE(ABORT, 'boom'); END;`,
    );
    await expect(
      repo.logCatch({ speciesId: speciesId('tewa'), quantity: 1, gps: null }),
    ).rejects.toThrow(/boom/);
    const n = await db.getFirstAsync<{ n: number }>('SELECT count(*) AS n FROM catches', []);
    expect(n?.n).toBe(0);
  });
});

describe('preferences', () => {
  it('default to Kiswahili, Night and kg, and persist changes', async () => {
    const { repo } = await openTestRepo();
    expect(await repo.getPreferences()).toEqual({ lang: 'sw', mode: 'night', unit: 'kg' });
    await repo.setPreference('lang', 'en');
    await repo.setPreference('mode', 'day');
    await repo.setPreference('lang', 'sw');
    expect(await repo.getPreferences()).toEqual({ lang: 'sw', mode: 'day', unit: 'kg' });
    // t stays a view option the captain can switch to.
    await repo.setPreference('unit', 't');
    expect((await repo.getPreferences()).unit).toBe('t');
  });
});
