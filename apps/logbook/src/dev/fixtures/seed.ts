// DEV FIXTURE: seeds placeholder reference data, links this device to the
// fixture captain and vessel, adds one closed trip from the previous day
// and (unless turned off) opens a trip with sample entries. Development
// builds only.

import { createRepository, type RepoDeps, type Repository } from '../../data/repository';
import type { SqlDb } from '../../data/sql';
import {
  devCaptain,
  devEntryStepMinutes,
  devGpsAccuracyM,
  devOpenTripEntries,
  devPreviousTripEntries,
  devTripHours,
  devHoldCodes,
  devLandingSite,
  devMenus,
  devOpenTrip,
  devSpecies,
  devVessel,
} from './reference';

const MIN = 60_000;

/** Reference data and the device link only. Returns false if already seeded. */
export async function seedDevReference(db: SqlDb): Promise<boolean> {
  const seeded = await db.getFirstAsync<{ id: string }>('SELECT id FROM vessels LIMIT 1', []);
  if (seeded) return false;
  await db.withTransactionAsync(async () => {
    const s = devLandingSite;
    await db.runAsync('INSERT INTO landing_sites (id, name, bmu) VALUES (?, ?, ?)', [s.id, s.name, s.bmu]);
    const v = devVessel;
    await db.runAsync(
      `INSERT INTO vessels (id, name, registration, tonnage_class, home_landing_site_id, owner_name)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [v.id, v.name, v.registration, v.tonnage_class, v.home_landing_site_id, v.owner_name],
    );
    await db.runAsync('INSERT INTO captains (id, display_name) VALUES (?, ?)', [
      devCaptain.id,
      devCaptain.display_name,
    ]);
    for (const x of devSpecies) {
      await db.runAsync('INSERT INTO species (id, local_name, english_gloss) VALUES (?, ?, ?)', [
        x.id,
        x.local_name,
        x.english_gloss,
      ]);
    }
    for (const [cls, names] of Object.entries(devMenus)) {
      for (const [i, name] of names.entries()) {
        await db.runAsync('INSERT INTO species_menu (tonnage_class, species_id, sort) VALUES (?, ?, ?)', [
          Number(cls),
          speciesId(name),
          i,
        ]);
      }
    }
    for (const [name, code] of Object.entries(devHoldCodes)) {
      await db.runAsync('INSERT INTO hold_codes (species_id, code) VALUES (?, ?)', [speciesId(name), code]);
    }
    await db.runAsync('UPDATE device_profile SET captain_id = ?, vessel_id = ? WHERE id = 1', [
      devCaptain.id,
      devVessel.id,
    ]);
  });
  return true;
}

/**
 * Reference data plus sample trips and entries, on first run only.
 * `openTrip: false` leaves no trip open, so Start trip (S1) can be tried.
 */
export async function seedDevFixtures(
  db: SqlDb,
  deps: RepoDeps,
  { openTrip = true }: { openTrip?: boolean } = {},
): Promise<boolean> {
  if (!(await seedDevReference(db))) return false;
  const now = deps.clock.now();

  // Records go through the normal repository, with a clock set to the
  // fixture times, so they obey the same append-only rules.
  let t = now.getTime();
  const repo = createRepository(db, {
    uuid: deps.uuid,
    clock: { now: () => new Date(t), skewMs: () => null },
  });

  const prevStart = now.getTime() - 24 * 60 * MIN - devOpenTrip.departedMinutesAgo * MIN;
  t = prevStart;
  const prev = await repo.startTrip({ crewDeparted: devOpenTrip.crewDeparted, departureAt: new Date(t) });
  await logEntries(repo, db, devPreviousTripEntries, prevStart, (ms) => (t = ms));
  t = prevStart + devTripHours * 60 * MIN;
  const prevClose = await repo.closeTrip({
    tripId: prev.trip_id,
    arrivalAt: new Date(t),
    crewReturned: devOpenTrip.crewDeparted,
    landingSiteId: devLandingSite.id,
    distanceKm: null,
  });
  await setState(db, [prev.id, prevClose.id], 'sent');
  if (!openTrip) return true;

  const openStart = now.getTime() - devOpenTrip.departedMinutesAgo * MIN;
  t = openStart;
  const open = await repo.startTrip({ crewDeparted: devOpenTrip.crewDeparted, departureAt: new Date(t) });
  await setState(db, [open.id], 'sent');
  await logEntries(repo, db, devOpenTripEntries, openStart, (ms) => (t = ms));
  return true;
}

function speciesId(name: string): string {
  const s = devSpecies.find((x) => x.local_name === name);
  if (!s) throw new Error(`DEV FIXTURE: unknown species ${name}`);
  return s.id;
}

async function logEntries(
  repo: Repository,
  db: SqlDb,
  entries: typeof devOpenTripEntries,
  start: number,
  setTime: (ms: number) => void,
) {
  for (const [i, e] of entries.entries()) {
    setTime(start + (i + 1) * devEntryStepMinutes * MIN);
    const c = await repo.logCatch({
      speciesId: speciesId(e.species),
      quantity: e.kg,
      gps: { latitude: e.lat, longitude: e.lon, gps_accuracy_m: devGpsAccuracyM },
    });
    await setState(db, [c.id], e.state);
  }
}

// sync_state is device-only and mutable; the fixture sets it directly to
// show every state. The real sync layer comes later.
async function setState(db: SqlDb, ids: string[], state: string) {
  for (const id of ids) {
    await db.runAsync('UPDATE sync_state SET state = ? WHERE record_id = ?', [state, id]);
  }
}
