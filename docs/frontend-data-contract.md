# Captain app — frontend data contract (v0.1, proposal)

Author: Benja (captain app, `apps/logbook`). Status: **PROPOSED**, for the backend team to review.
Purpose: what the captain app stores on the device, sends, and needs back. It follows the repo's existing rules (ADR 0001 and the backend contract proposal): client UUIDv4 IDs, `recorded_at` + `device_clock_skew_ms`, an append-only ledger, corrections as linked records, quantity stored with its unit, and a single write path `POST /sync-batch`.

Until the backend exists, the app runs on local SQLite with seeded reference data. Only the app's sync layer will change when the API is ready.

---

## 1. Reference data (backend registers it later; the app seeds it locally for now)

| Entity | Fields | Notes |
|---|---|---|
| `vessels` | `id` uuid, `name` text, `registration` text (e.g. KE-LAM-MKW-T20-014), `tonnage_class` int (10/20/50/100), `home_landing_site_id` uuid, `owner_name` text [TO CONFIRM] | Registered per landing site by the team |
| `landing_sites` | `id` uuid, `name` text (e.g. Mokowe), `bmu` text [TO CONFIRM] | |
| `captains` | `id` uuid, `display_name` text | The repo's "fisher". One captain per device per vessel in Phase 1 |
| `species` | `id` uuid, `local_name` text (never translated), `english_gloss` text | |
| `species_menu` | `tonnage_class` int, `species_id` uuid, `sort` int | The menu shown per vessel class [TO CONFIRM by client] |
| `hold_codes` | `code` A–D, `species_id` uuid | [TO CONFIRM: species group or physical hold] |
| `measurement_units` | `code` = `t` (also `kg`) | The captain enters tonnes; the kg view still works |

## 2. Records the app creates (append-only, sent through `/sync-batch`)

All records carry: `id` (client UUIDv4), `device_id`, `recorded_at` (RFC 3339 with timezone), `device_clock_skew_ms` (nullable).

### `trip_start` (new record kind)
`trip_id`, `vessel_id`, `captain_id`, `crew_count` int (1–24), `departure_at`.

### `catch`
`trip_id`, `vessel_id`, `captain_id`, `species_id`, `species_local_name`, `quantity` numeric (1 decimal), `unit` = `t`, `tier` = `S` (always, captain estimate), `hold_code`, `latitude`, `longitude`, `gps_accuracy_m`, `zone` [placeholder], `season` [placeholder], `water_temp_c` (nullable, sensor TBC), `note` (nullable, optional), `short_ref` (display only, e.g. XXXX-008).
Rules: one row per catch event, never merged; quantity > 0; no free-text species from captains.

### `catch_correction`
`catch_id`, `previous_correction_id` (nullable), `reason` (nullable), and the replacement fields (`species_id`, `quantity`, `unit`, `hold_code`, `note`).
Rule: allowed only while no plant weighing exists for that catch (answers D05 from the captain side). The server rejects it afterwards.

### `trip_close` (new record kind)
`trip_id`, `arrival_at`, `crew_count`, `landing_site_id`, `distance_km` (nullable), `catch_ids[]`, `total_quantity` + `unit` (display check only; the server recomputes it).

## 3. What the app needs back (server → device)

Proposed as a read feed for the device's own records, either `GET /device-feed?since=<cursor>` or included in each `/sync-batch` response.

| Item | Fields | Shown as |
|---|---|---|
| Record ack | `id`, `status` (`inserted` / `already_present` / error) | Entry state → **Sent** |
| Review flag | `catch_id`, `status` = `being_checked` / `cleared`, `message` (nullable) | Entry state → **Being checked** [definition TO CONFIRM] |
| Plant weighing | `trip_id`, `species_id`, `catch_id` (nullable), `weight` + `unit`, `weighed_at` | **W** tier figure [granularity TO CONFIRM: per catch or per species per trip] |
| Corrections closed | `catch_id` or `trip_id`, `closed_at` | Hides **Correct**, shows "weighed at plant" |
| Reference data updates | vessels, sites, menus, hold codes, with a version | Refreshes the local seed |

## 4. On-device only (never sent)

- `sync_state` per record: `on_device` → `waiting` → `sent` (+ `being_checked` from the feed).
- My grounds heat map: computed locally from the captain's own catches; no server work. Entries saved at the landing site or after trip close are excluded.
- UI preferences: language (sw default / en), mode (night default / day), unit display (t / kg).

## 5. Open questions for the backend team

1. Phase 1 = the captain logging at sea per catch (this app). Is the repo README's "at landing" wording to be updated?
2. Does the plant weigh per catch, or per species per trip?
3. What does "being checked" mean, and who sets it?
4. Are `trip_start` / `trip_close` acceptable as new `/sync-batch` record kinds?
5. Should the device read feed be a separate endpoint or part of the sync response?
6. Hold codes A–D: species group or physical hold?
