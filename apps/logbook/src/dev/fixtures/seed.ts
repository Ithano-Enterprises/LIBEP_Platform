// DEV FIXTURE: seeds placeholder reference data, links this device to the
// fixture captain and vessel, and opens a trip. Development builds only.

import type { Repository } from '../../data/repository';
import type { SqlDb } from '../../data/sql';
import {
  devCaptain,
  devHoldCodes,
  devLandingSite,
  devMenus,
  devOpenTrip,
  devSpecies,
  devVessel,
} from './reference';

export async function seedDevFixtures(db: SqlDb, repo: Repository, now: Date): Promise<boolean> {
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
    const idByName = new Map(devSpecies.map((x) => [x.local_name, x.id]));
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
          idByName.get(name)!,
          i,
        ]);
      }
    }
    for (const [name, code] of Object.entries(devHoldCodes)) {
      await db.runAsync('INSERT INTO hold_codes (species_id, code) VALUES (?, ?)', [idByName.get(name)!, code]);
    }
    await db.runAsync('UPDATE device_profile SET captain_id = ?, vessel_id = ? WHERE id = 1', [
      devCaptain.id,
      devVessel.id,
    ]);
  });

  if (!(await repo.getOpenTrip())) {
    await repo.startTrip({
      crewDeparted: devOpenTrip.crewDeparted,
      departureAt: new Date(now.getTime() - devOpenTrip.departedMinutesAgo * 60_000),
    });
  }
  return true;
}
