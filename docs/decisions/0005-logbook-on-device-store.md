# 0005. Logbook on-device store: expo-sqlite

Status: proposed

## Context

The logbook is offline-first ([ADR 0001](0001-logbook-data-model.md)).
Every record is written on the phone first and sent later through
`POST /sync-batch`, which may be retried blindly. [ADR 0003](0003-team-roles-apps-and-stack.md)
made the app React Native with Expo and left the on-device store open:
React Native has no IndexedDB or service worker. `apps/logbook/README.md`
lists it as `[TO CONFIRM: expo-sqlite or other]`.

The store has to hold:

- reference data seeded locally until the backend serves it (vessels, landing
  sites, species menus)
- the device's own append-only records, with client UUIDv4 ids,
  `recorded_at` and `device_clock_skew_ms`
- a per-record sync state for the outbound queue
- queries the screens need offline: trip lists, filters by state, and
  per-species totals

It must work in Expo Go during development, so testers need no custom build.

## Decision

1. **Use `expo-sqlite`** as the on-device store for the logbook.
2. **Local tables mirror the records sent to `/sync-batch`** and use the same
   field names. Device-only fields (sync state, UI preferences) live in
   separate columns or tables and are never sent.
3. **Append-only on the device too.** `BEFORE UPDATE` / `BEFORE DELETE`
   triggers on the record tables raise an error, as the server's triggers do.
   A correction is a new record linked to the original. The only mutable data
   is the device-only sync state and preferences.
4. **One data access layer** (`apps/logbook/src/data/`). Screens never run
   SQL. When the backend is ready, only the sync layer changes.
5. **Writes are local and transactional.** A record and its queue entry are
   written in one SQLite transaction, so a crash cannot leave a record that
   never syncs.

Alternatives considered:

- AsyncStorage / MMKV: key-value only, so no transactions across records and
  no queries for lists and totals.
- WatermelonDB, Realm: need a custom native build instead of Expo Go, and add
  a sync model of their own on top of `/sync-batch`.

## Consequences

- The app gets a local schema with its own migrations, versioned in the app.
  It is separate from `supabase/migrations/` and must be kept in line with
  the server schema by review.
- Blind retry stays safe: the queue resends by id and the server ignores
  duplicates (`ON CONFLICT (id) DO NOTHING`).
- Data lives only on the phone until it syncs. A lost or broken phone loses
  unsent records. `[TO CONFIRM: whether an export or backup path is needed]`
- `[TO CONFIRM: whether the local database must be encrypted at rest]`
- `[TO CONFIRM: how long synced records are kept on the device]`
