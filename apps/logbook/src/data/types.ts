// Shapes of the local data, named after the frontend data contract (v0.1).

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
  trip_id: string;
  vessel_id: string;
  captain_id: string;
  crew_count: number;
  departure_at: string;
};

export type Gps = { latitude: number; longitude: number; gps_accuracy_m: number | null };

export type CatchRecord = RecordBase & {
  trip_id: string;
  vessel_id: string;
  captain_id: string;
  species_id: string;
  species_local_name: string;
  quantity: number;
  unit: 't';
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
  species_id: string;
  quantity: number;
  unit: 't';
  hold_code: HoldCode | null;
  note: string | null;
};

export type TripClose = RecordBase & {
  trip_id: string;
  arrival_at: string;
  crew_count: number;
  landing_site_id: string;
  distance_km: number | null;
  catch_ids: string[];
  total_quantity: number;
  unit: 't';
};

/** A catch as shown in lists: latest correction applied, with its sync state. */
export type Entry = CatchRecord & {
  head_correction_id: string | null;
  correction_count: number;
  sync_state: SyncStateValue;
};

export type Preferences = { lang: 'sw' | 'en'; mode: 'night' | 'day'; unit: 't' | 'kg' };
