import type { SqlDb, SqlValue } from './sql';
import type {
  CatchCorrection,
  CatchRecord,
  DeviceProfile,
  Entry,
  Gps,
  HoldCode,
  LandingSite,
  MenuItem,
  Preferences,
  RecordBase,
  RecordKind,
  Species,
  SyncStateValue,
  TonnageClass,
  TripClose,
  TripStart,
} from './types';

// The only way screens read or write data. Writes are local and
// append-only; each record is stored with its sync state in one
// transaction. The sync layer (later) reads sync_state and posts to
// /sync-batch.

export type Clock = {
  now(): Date;
  /** Measured device clock skew. Recorded as is, never used to correct times. */
  skewMs(): number | null;
};

export type RepoDeps = { uuid(): string; clock: Clock };

export class DataError extends Error {
  constructor(
    public code:
      | 'no_device_profile'
      | 'trip_already_open'
      | 'no_open_trip'
      | 'invalid_quantity'
      | 'invalid_crew'
      | 'unknown_species'
      | 'invalid_species_name'
      | 'unknown_catch'
      | 'stale_correction',
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'DataError';
  }
}

export const DEFAULT_PREFERENCES: Preferences = { lang: 'sw', mode: 'night', unit: 't' };

/** Quantity in whole kg, at least 1 (contract §2). */
export function isValidQuantity(q: number): boolean {
  return Number.isInteger(q) && q >= 1;
}

/** Species for a catch: from the menu, or "Other" with the local name as typed. */
export type SpeciesChoice = { speciesId: string } | { speciesId: null; speciesLocalName: string };

/** Display reference, e.g. 3F2A-008. [TO CONFIRM: short_ref format] */
export function makeShortRef(id: string, seq: number): string {
  return `${id.replace(/-/g, '').slice(0, 4).toUpperCase()}-${String(seq).padStart(3, '0')}`;
}

export function createRepository(db: SqlDb, deps: RepoDeps) {
  async function base(): Promise<RecordBase> {
    const profile = await db.getFirstAsync<{ device_id: string }>(
      'SELECT device_id FROM device_profile WHERE id = 1',
      [],
    );
    if (!profile) throw new DataError('no_device_profile');
    return {
      id: deps.uuid(),
      device_id: profile.device_id,
      recorded_at: deps.clock.now().toISOString(),
      device_clock_skew_ms: deps.clock.skewMs(),
    };
  }

  async function insert(table: string, row: Record<string, SqlValue>): Promise<void> {
    const cols = Object.keys(row);
    await db.runAsync(
      `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
      cols.map((c) => row[c]),
    );
  }

  async function track(recordId: string, kind: RecordKind): Promise<void> {
    await insert('sync_state', {
      record_id: recordId,
      kind,
      state: 'on_device',
      updated_at: deps.clock.now().toISOString(),
    });
  }

  async function getDeviceProfile(): Promise<DeviceProfile | null> {
    const row = await db.getFirstAsync<{
      device_id: string;
      captain_id: string;
      display_name: string;
      vessel_id: string;
      vessel_name: string;
      registration: string;
      tonnage_class: TonnageClass;
      home_landing_site_id: string;
      owner_name: string | null;
      site_name: string;
      bmu: string | null;
    }>(
      `SELECT d.device_id, c.id AS captain_id, c.display_name,
              v.id AS vessel_id, v.name AS vessel_name, v.registration, v.tonnage_class,
              v.home_landing_site_id, v.owner_name, s.name AS site_name, s.bmu
         FROM device_profile d
         JOIN captains c ON c.id = d.captain_id
         JOIN vessels v ON v.id = d.vessel_id
         JOIN landing_sites s ON s.id = v.home_landing_site_id
        WHERE d.id = 1`,
      [],
    );
    if (!row) return null;
    return {
      device_id: row.device_id,
      captain: { id: row.captain_id, display_name: row.display_name },
      vessel: {
        id: row.vessel_id,
        name: row.vessel_name,
        registration: row.registration,
        tonnage_class: row.tonnage_class,
        home_landing_site_id: row.home_landing_site_id,
        owner_name: row.owner_name,
      },
      home_site: { id: row.home_landing_site_id, name: row.site_name, bmu: row.bmu },
    };
  }

  async function requireProfile(): Promise<DeviceProfile> {
    const p = await getDeviceProfile();
    if (!p) throw new DataError('no_device_profile');
    return p;
  }

  async function getSpeciesMenu(tonnageClass: TonnageClass): Promise<MenuItem[]> {
    return db.getAllAsync<MenuItem>(
      `SELECT s.id, s.local_name, s.english_gloss, m.sort, h.code AS hold_code
         FROM species_menu m
         JOIN species s ON s.id = m.species_id
         LEFT JOIN hold_codes h ON h.species_id = s.id
        WHERE m.tonnage_class = ?
        ORDER BY m.sort`,
      [tonnageClass],
    );
  }

  async function getLandingSites(): Promise<LandingSite[]> {
    return db.getAllAsync<LandingSite>('SELECT id, name, bmu FROM landing_sites ORDER BY name', []);
  }

  async function getOpenTrip(): Promise<TripStart | null> {
    return db.getFirstAsync<TripStart>(
      `SELECT s.* FROM trip_starts s
        WHERE NOT EXISTS (SELECT 1 FROM trip_closes c WHERE c.trip_id = s.trip_id)
        ORDER BY s.recorded_at DESC LIMIT 1`,
      [],
    );
  }

  async function startTrip(input: { crewDeparted: number; departureAt: Date }): Promise<TripStart> {
    // [TO CONFIRM: crew limit 24]
    if (!Number.isInteger(input.crewDeparted) || input.crewDeparted < 1 || input.crewDeparted > 24) {
      throw new DataError('invalid_crew');
    }
    const profile = await requireProfile();
    if (await getOpenTrip()) throw new DataError('trip_already_open');
    const b = await base();
    const record: TripStart = {
      ...b,
      trip_id: b.id, // one UUID per trip: the trip_start id (contract §2)
      vessel_id: profile.vessel.id,
      captain_id: profile.captain.id,
      crew_departed: input.crewDeparted,
      departure_at: input.departureAt.toISOString(),
    };
    await db.withTransactionAsync(async () => {
      await insert('trip_starts', record);
      await track(record.id, 'trip_start');
    });
    return record;
  }

  async function findSpecies(speciesId: string): Promise<Species & { hold_code: HoldCode | null }> {
    const s = await db.getFirstAsync<Species & { hold_code: HoldCode | null }>(
      `SELECT s.id, s.local_name, s.english_gloss, h.code AS hold_code
         FROM species s LEFT JOIN hold_codes h ON h.species_id = s.id
        WHERE s.id = ?`,
      [speciesId],
    );
    if (!s) throw new DataError('unknown_species');
    return s;
  }

  /** Resolves a species choice to what a record stores. "Other" has no hold code. */
  async function resolveSpecies(
    choice: SpeciesChoice,
  ): Promise<{ species_id: string | null; species_local_name: string; hold_code: HoldCode | null }> {
    if (choice.speciesId === null) {
      // Sent exactly as typed; only a blank name is refused.
      if (!choice.speciesLocalName.trim()) throw new DataError('invalid_species_name');
      return { species_id: null, species_local_name: choice.speciesLocalName, hold_code: null };
    }
    const s = await findSpecies(choice.speciesId);
    return { species_id: s.id, species_local_name: s.local_name, hold_code: s.hold_code };
  }

  async function logCatch(
    input: SpeciesChoice & {
      quantity: number;
      gps: Gps | null;
      note?: string | null;
    },
  ): Promise<CatchRecord> {
    if (!isValidQuantity(input.quantity)) throw new DataError('invalid_quantity');
    const profile = await requireProfile();
    const trip = await getOpenTrip();
    if (!trip) throw new DataError('no_open_trip');
    const species = await resolveSpecies(input);
    const b = await base();
    const count = await db.getFirstAsync<{ n: number }>('SELECT count(*) AS n FROM catches', []);
    const record: CatchRecord = {
      ...b,
      trip_id: trip.trip_id,
      vessel_id: profile.vessel.id,
      captain_id: profile.captain.id,
      species_id: species.species_id,
      species_local_name: species.species_local_name,
      quantity: input.quantity,
      unit: 'kg',
      tier: 'S',
      hold_code: species.hold_code,
      latitude: input.gps?.latitude ?? null,
      longitude: input.gps?.longitude ?? null,
      gps_accuracy_m: input.gps?.gps_accuracy_m ?? null,
      zone: null, // [TO CONFIRM: zone source] placeholder in the contract
      season: null, // [TO CONFIRM: season source] placeholder in the contract
      water_temp_c: null, // [TO CONFIRM: sensor] nullable in the contract
      note: input.note?.trim() || null,
      short_ref: makeShortRef(b.id, (count?.n ?? 0) + 1),
    };
    await db.withTransactionAsync(async () => {
      await insert('catches', record);
      await track(record.id, 'catch');
    });
    return record;
  }

  /**
   * Adds a correction as a new record linked to the catch. The caller passes
   * the head it saw (previousCorrectionId); if another correction landed
   * since, it is rejected, like a stale correction on the server.
   * [TO CONFIRM: block once the plant has weighed the catch, needs the device feed]
   */
  async function correctCatch(input: {
    catchId: string;
    previousCorrectionId: string | null;
    reason?: string | null;
    /** Leave out to keep the current species; null is "Other" with speciesLocalName. */
    speciesId?: string | null;
    speciesLocalName?: string;
    quantity?: number;
    note?: string | null;
  }): Promise<CatchCorrection> {
    const current = await db.getFirstAsync<{
      species_id: string | null;
      species_local_name: string;
      quantity: number;
      hold_code: HoldCode | null;
      note: string | null;
      head_correction_id: string | null;
    }>(
      `SELECT species_id, species_local_name, quantity, hold_code, note, head_correction_id
         FROM v_catches_effective WHERE id = ?`,
      [input.catchId],
    );
    if (!current) throw new DataError('unknown_catch');
    if (current.head_correction_id !== input.previousCorrectionId) {
      throw new DataError('stale_correction');
    }
    const quantity = input.quantity ?? current.quantity;
    if (!isValidQuantity(quantity)) throw new DataError('invalid_quantity');
    const species =
      input.speciesId === undefined
        ? null
        : await resolveSpecies(
            input.speciesId === null
              ? { speciesId: null, speciesLocalName: input.speciesLocalName ?? '' }
              : { speciesId: input.speciesId },
          );
    const b = await base();
    const record: CatchCorrection = {
      ...b,
      catch_id: input.catchId,
      previous_correction_id: input.previousCorrectionId,
      reason: input.reason?.trim() || null,
      species_id: species ? species.species_id : current.species_id,
      species_local_name: species ? species.species_local_name : current.species_local_name,
      quantity,
      unit: 'kg',
      hold_code: species ? species.hold_code : current.hold_code,
      note: input.note === undefined ? current.note : input.note?.trim() || null,
    };
    await db.withTransactionAsync(async () => {
      await insert('catch_corrections', record);
      await track(record.id, 'catch_correction');
    });
    return record;
  }

  async function closeTrip(input: {
    tripId: string;
    arrivalAt: Date;
    crewReturned: number;
    /** Optional, kept only when crew_returned differs from crew_departed. */
    crewChangeReason?: string | null;
    landingSiteId: string;
    distanceKm: number | null;
  }): Promise<TripClose> {
    // [TO CONFIRM: crew limit 24]
    if (!Number.isInteger(input.crewReturned) || input.crewReturned < 0 || input.crewReturned > 24) {
      throw new DataError('invalid_crew');
    }
    const trip = await getOpenTrip();
    if (!trip || trip.trip_id !== input.tripId) throw new DataError('no_open_trip');
    const entries = await db.getAllAsync<{ id: string; quantity: number }>(
      'SELECT id, quantity FROM v_catches_effective WHERE trip_id = ? ORDER BY recorded_at',
      [input.tripId],
    );
    const total = entries.reduce((sum, e) => sum + e.quantity, 0);
    const b = await base();
    const record: TripClose = {
      ...b,
      trip_id: input.tripId,
      arrival_at: input.arrivalAt.toISOString(),
      crew_returned: input.crewReturned,
      crew_change_reason:
        input.crewReturned === trip.crew_departed ? null : input.crewChangeReason?.trim() || null,
      landing_site_id: input.landingSiteId,
      distance_km: input.distanceKm,
      catch_ids: entries.map((e) => e.id),
      total_quantity: total, // display check only; the server recomputes it
      unit: 'kg',
    };
    await db.withTransactionAsync(async () => {
      await insert('trip_closes', { ...record, catch_ids: JSON.stringify(record.catch_ids) });
      await track(record.id, 'trip_close');
    });
    return record;
  }

  async function listTripEntries(tripId: string): Promise<Entry[]> {
    return db.getAllAsync<Entry>(
      `SELECT e.*, coalesce(s.state, 'on_device') AS sync_state
         FROM v_catches_effective e
         LEFT JOIN sync_state s ON s.record_id = e.id
        WHERE e.trip_id = ?
        ORDER BY e.recorded_at DESC`,
      [tripId],
    );
  }

  async function getSyncState(recordId: string): Promise<SyncStateValue | null> {
    const row = await db.getFirstAsync<{ state: SyncStateValue }>(
      'SELECT state FROM sync_state WHERE record_id = ?',
      [recordId],
    );
    return row?.state ?? null;
  }

  async function getPreferences(): Promise<Preferences> {
    const rows = await db.getAllAsync<{ key: keyof Preferences; value: string }>(
      'SELECT key, value FROM preferences',
      [],
    );
    const prefs: Preferences = { ...DEFAULT_PREFERENCES };
    for (const r of rows) {
      if (r.key === 'lang' && (r.value === 'sw' || r.value === 'en')) prefs.lang = r.value;
      if (r.key === 'mode' && (r.value === 'night' || r.value === 'day')) prefs.mode = r.value;
      if (r.key === 'unit' && (r.value === 't' || r.value === 'kg')) prefs.unit = r.value;
    }
    return prefs;
  }

  async function setPreference<K extends keyof Preferences>(key: K, value: Preferences[K]) {
    await db.runAsync(
      'INSERT INTO preferences (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value',
      [key, value],
    );
  }

  return {
    getDeviceProfile,
    getSpeciesMenu,
    getLandingSites,
    getOpenTrip,
    startTrip,
    logCatch,
    correctCatch,
    closeTrip,
    listTripEntries,
    getSyncState,
    getPreferences,
    setPreference,
  };
}

export type Repository = ReturnType<typeof createRepository>;

/** Creates the device row on first run. The device id is a UUIDv4 kept for the life of the install. */
export async function ensureDevice(db: SqlDb, uuid: () => string): Promise<string> {
  const row = await db.getFirstAsync<{ device_id: string }>(
    'SELECT device_id FROM device_profile WHERE id = 1',
    [],
  );
  if (row) return row.device_id;
  const id = uuid();
  await db.runAsync('INSERT INTO device_profile (id, device_id) VALUES (1, ?)', [id]);
  return id;
}
