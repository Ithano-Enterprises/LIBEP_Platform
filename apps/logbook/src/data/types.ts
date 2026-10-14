// Shapes of the local data, named after the frontend data contract (v0.2).

export type TonnageClass = 10 | 20 | 50 | 100;
export type HoldCode = 'A' | 'B' | 'C' | 'D';
export type SyncStateValue = 'on_device' | 'waiting' | 'sent' | 'being_checked';
export type RecordKind = 'trip_start' | 'catch' | 'catch_correction' | 'trip_close';

/** Fields every record carries (ADR 0001). */
export type RecordBase = {
  id: string;
  device_id: string;
  recorded_at: string;
  device_clock_skew_ms: number | null;
};

export type LandingSite = { id: string; name: string; bmu: string | null };

export type Vessel = {
  id: string;
  name: string;
  registration: string;
  tonnage_class: TonnageClass;
  home_landing_site_id: string;
  owner_name: string | null;
};

export type Captain = { id: string; display_name: string };

export type Species = { id: string; local_name: string; english_gloss: string | null };

export type MenuItem = Species & { sort: number; hold_code: HoldCode | null };

export type DeviceProfile = {
  device_id: string;
  captain: Captain;
  vessel: Vessel;
  home_site: LandingSite;
};

export type TripStart = RecordBase & {
  /** Same as id: one UUID per trip, made at trip start. */
  trip_id: string;
  vessel_id: string;
  captain_id: string;
  crew_departed: number;
  departure_at: string;
};

export type Gps = { latitude: number; longitude: number; gps_accuracy_m: number | null };

export type CatchRecord = RecordBase & {
  trip_id: string;
  vessel_id: string;
  captain_id: string;
  /** Null for "Other"; species_local_name is then the name as typed. */
  species_id: string | null;
  species_local_name: string;
  /** Whole kg. */
  quantity: number;
  unit: 'kg';
  tier: 'S';
  hold_code: HoldCode | null;
  latitude: number | null;
  longitude: number | null;
  gps_accuracy_m: number | null;
  zone: string | null;
  season: string | null;
  water_temp_c: number | null;
  note: string | null;
  short_ref: string;
};

export type CatchCorrection = RecordBase & {
  catch_id: string;
  previous_correction_id: string | null;
  reason: string | null;
  species_id: string | null;
  species_local_name: string;
  /** Whole kg. */
  quantity: number;
  unit: 'kg';
  hold_code: HoldCode | null;
  note: string | null;
};

export type TripClose = RecordBase & {
  trip_id: string;
  arrival_at: string;
  crew_returned: number;
  /** Optional, only when crew_returned differs from crew_departed. */
  crew_change_reason: string | null;
  landing_site_id: string;
  distance_km: number | null;
  catch_ids: string[];
  /** Whole kg. */
  total_quantity: number;
  unit: 'kg';
};

/** A catch as shown in lists: latest correction applied, with its sync state. */
export type Entry = CatchRecord & {
  head_correction_id: string | null;
  correction_count: number;
  sync_state: SyncStateValue;
  /** Plant weight (W) in kg when the plant weighed this catch. Never mixed with S. */
  plant_weight_kg: number | null;
  plant_weighed_at: string | null;
};

/** A plant weighing as the device feed reports it (contract §3). */
export type PlantWeighing = {
  id: string;
  trip_id: string;
  species_id: string;
  catch_id: string | null;
  weight: number;
  unit: 't' | 'kg';
  weighed_at: string;
};

/** A catch as first saved, then its corrections in chain order. */
export type CatchHistory = { original: CatchRecord; corrections: CatchCorrection[] };

/** A closed trip with its entries, for the previous trips list. */
export type ClosedTrip = {
  start: TripStart;
  arrival_at: string;
  landing_site_id: string;
  entries: Entry[];
};

/** A catch as the grounds map needs it: effective values, trip status, plant weight. */
export type GroundsCatch = {
  id: string;
  trip_id: string;
  species_id: string;
  species_local_name: string;
  hold_code: HoldCode | null;
  quantity: number;
  latitude: number | null;
  longitude: number | null;
  recorded_at: string;
  sync_state: SyncStateValue;
  /** When the trip was closed, if it is. */
  trip_closed_at: string | null;
  plant_weight_t: number | null;
};

export type Preferences = { lang: 'sw' | 'en'; mode: 'night' | 'day'; unit: 't' | 'kg' };
