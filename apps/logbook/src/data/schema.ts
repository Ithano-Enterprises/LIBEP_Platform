import type { SqlDb } from './sql';

// Local SQLite schema, following the frontend data contract (v0.1) and
// ADR 0001. Each migration runs once, tracked by PRAGMA user_version.
// A shipped migration is never edited; add a new one.

const RECORD_TABLES = ['trip_starts', 'catches', 'catch_corrections', 'trip_closes'] as const;

// Records are append-only on the device too (ADR 0001 §4). Triggers, not
// application code, so nothing can bypass them.
const appendOnlyTriggers = RECORD_TABLES.map(
  (t) => `
CREATE TRIGGER ${t}_no_update BEFORE UPDATE ON ${t}
BEGIN SELECT RAISE(ABORT, 'append-only: ${t} rows cannot be updated'); END;
CREATE TRIGGER ${t}_no_delete BEFORE DELETE ON ${t}
BEGIN SELECT RAISE(ABORT, 'append-only: ${t} rows cannot be deleted'); END;`,
).join('\n');

export const MIGRATIONS: readonly string[] = [
  // 1: reference data, device-only tables, append-only records, effective view
  `
-- Reference data. Seeded locally until the backend serves it.
CREATE TABLE landing_sites (
  id   TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  bmu  TEXT
);

CREATE TABLE vessels (
  id                   TEXT PRIMARY KEY NOT NULL,
  name                 TEXT NOT NULL,
  registration         TEXT NOT NULL,
  tonnage_class        INTEGER NOT NULL CHECK (tonnage_class IN (10, 20, 50, 100)),
  home_landing_site_id TEXT NOT NULL REFERENCES landing_sites (id),
  owner_name           TEXT
);

CREATE TABLE captains (
  id           TEXT PRIMARY KEY NOT NULL,
  display_name TEXT NOT NULL
);

CREATE TABLE species (
  id            TEXT PRIMARY KEY NOT NULL,
  local_name    TEXT NOT NULL UNIQUE,
  english_gloss TEXT
);

CREATE TABLE species_menu (
  tonnage_class INTEGER NOT NULL CHECK (tonnage_class IN (10, 20, 50, 100)),
  species_id    TEXT NOT NULL REFERENCES species (id),
  sort          INTEGER NOT NULL,
  PRIMARY KEY (tonnage_class, species_id)
);

CREATE TABLE hold_codes (
  species_id TEXT PRIMARY KEY NOT NULL REFERENCES species (id),
  code       TEXT NOT NULL CHECK (code IN ('A', 'B', 'C', 'D'))
);

CREATE TABLE measurement_units (
  code TEXT PRIMARY KEY NOT NULL
);
INSERT INTO measurement_units (code) VALUES ('t'), ('kg');

-- Device only, never sent.
CREATE TABLE device_profile (
  id         INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
  device_id  TEXT NOT NULL,
  captain_id TEXT REFERENCES captains (id),
  vessel_id  TEXT REFERENCES vessels (id)
);

CREATE TABLE preferences (
  key   TEXT PRIMARY KEY NOT NULL CHECK (key IN ('lang', 'mode', 'unit')),
  value TEXT NOT NULL
);

-- Records the app creates. Append-only, sent through /sync-batch.
CREATE TABLE trip_starts (
  id                   TEXT PRIMARY KEY NOT NULL,
  device_id            TEXT NOT NULL,
  recorded_at          TEXT NOT NULL,
  device_clock_skew_ms INTEGER,
  trip_id              TEXT NOT NULL UNIQUE,
  vessel_id            TEXT NOT NULL REFERENCES vessels (id),
  captain_id           TEXT NOT NULL REFERENCES captains (id),
  crew_count           INTEGER NOT NULL CHECK (crew_count BETWEEN 1 AND 24),
  departure_at         TEXT NOT NULL
);

CREATE TABLE catches (
  id                   TEXT PRIMARY KEY NOT NULL,
  device_id            TEXT NOT NULL,
  recorded_at          TEXT NOT NULL,
  device_clock_skew_ms INTEGER,
  trip_id              TEXT NOT NULL REFERENCES trip_starts (trip_id),
  vessel_id            TEXT NOT NULL REFERENCES vessels (id),
  captain_id           TEXT NOT NULL REFERENCES captains (id),
  species_id           TEXT NOT NULL REFERENCES species (id),
  species_local_name   TEXT NOT NULL,
  quantity             REAL NOT NULL CHECK (quantity > 0),
  unit                 TEXT NOT NULL CHECK (unit = 't') REFERENCES measurement_units (code),
  tier                 TEXT NOT NULL CHECK (tier = 'S'),
  hold_code            TEXT CHECK (hold_code IN ('A', 'B', 'C', 'D')),
  latitude             REAL,
  longitude            REAL,
  gps_accuracy_m       REAL,
  zone                 TEXT,
  season               TEXT,
  water_temp_c         REAL,
  note                 TEXT,
  short_ref            TEXT NOT NULL
);
CREATE INDEX catches_trip ON catches (trip_id);

CREATE TABLE catch_corrections (
  id                     TEXT PRIMARY KEY NOT NULL,
  device_id              TEXT NOT NULL,
  recorded_at            TEXT NOT NULL,
  device_clock_skew_ms   INTEGER,
  catch_id               TEXT NOT NULL REFERENCES catches (id),
  previous_correction_id TEXT REFERENCES catch_corrections (id),
  reason                 TEXT,
  species_id             TEXT NOT NULL REFERENCES species (id),
  quantity               REAL NOT NULL CHECK (quantity > 0),
  unit                   TEXT NOT NULL CHECK (unit = 't') REFERENCES measurement_units (code),
  hold_code              TEXT CHECK (hold_code IN ('A', 'B', 'C', 'D')),
  note                   TEXT
);
-- One linear chain per catch: no two corrections share a predecessor.
CREATE UNIQUE INDEX catch_corrections_chain
  ON catch_corrections (catch_id, ifnull(previous_correction_id, ''));

CREATE TRIGGER catch_corrections_same_catch BEFORE INSERT ON catch_corrections
WHEN NEW.previous_correction_id IS NOT NULL
 AND NOT EXISTS (SELECT 1 FROM catch_corrections p
                 WHERE p.id = NEW.previous_correction_id AND p.catch_id = NEW.catch_id)
BEGIN SELECT RAISE(ABORT, 'previous_correction_id belongs to another catch'); END;

CREATE TABLE trip_closes (
  id                   TEXT PRIMARY KEY NOT NULL,
  device_id            TEXT NOT NULL,
  recorded_at          TEXT NOT NULL,
  device_clock_skew_ms INTEGER,
  trip_id              TEXT NOT NULL UNIQUE REFERENCES trip_starts (trip_id),
  arrival_at           TEXT NOT NULL,
  crew_count           INTEGER NOT NULL CHECK (crew_count BETWEEN 1 AND 24),
  landing_site_id      TEXT NOT NULL REFERENCES landing_sites (id),
  distance_km          REAL CHECK (distance_km IS NULL OR distance_km >= 0),
  catch_ids            TEXT NOT NULL,
  total_quantity       REAL NOT NULL,
  unit                 TEXT NOT NULL CHECK (unit = 't') REFERENCES measurement_units (code)
);

${appendOnlyTriggers}

-- Device only: outbound sync state per record. The only mutable rows that
-- describe a record.
CREATE TABLE sync_state (
  record_id  TEXT PRIMARY KEY NOT NULL,
  kind       TEXT NOT NULL CHECK (kind IN ('trip_start', 'catch', 'catch_correction', 'trip_close')),
  state      TEXT NOT NULL DEFAULT 'on_device'
             CHECK (state IN ('on_device', 'waiting', 'sent', 'being_checked')),
  updated_at TEXT NOT NULL
);

-- Each catch with its latest correction applied (head of the chain).
CREATE VIEW v_catches_effective AS
SELECT
  c.id, c.trip_id, c.vessel_id, c.captain_id, c.device_id,
  c.recorded_at, c.device_clock_skew_ms, c.short_ref, c.tier,
  coalesce(h.species_id, c.species_id)         AS species_id,
  coalesce(hs.local_name, c.species_local_name) AS species_local_name,
  coalesce(h.quantity, c.quantity)             AS quantity,
  coalesce(h.unit, c.unit)                     AS unit,
  CASE WHEN h.id IS NULL THEN c.hold_code ELSE h.hold_code END AS hold_code,
  CASE WHEN h.id IS NULL THEN c.note ELSE h.note END           AS note,
  c.latitude, c.longitude, c.gps_accuracy_m,
  c.zone, c.season, c.water_temp_c,
  h.id AS head_correction_id,
  (SELECT count(*) FROM catch_corrections x WHERE x.catch_id = c.id) AS correction_count
FROM catches c
LEFT JOIN catch_corrections h
  ON h.catch_id = c.id
 AND NOT EXISTS (SELECT 1 FROM catch_corrections n WHERE n.previous_correction_id = h.id)
LEFT JOIN species hs ON hs.id = h.species_id;
`,
];

export async function migrate(db: SqlDb): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version', []);
  const from = row?.user_version ?? 0;
  for (let v = from; v < MIGRATIONS.length; v++) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(MIGRATIONS[v]);
      await db.execAsync(`PRAGMA user_version = ${v + 1}`);
    });
  }
}
