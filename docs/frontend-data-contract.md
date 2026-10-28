# Captain app — frontend data contract (v0.2, proposal)

Author: Benja (captain app, `apps/logbook`). Status: **PROPOSED**, for the backend team to review.
Purpose: what the captain app stores on the device, sends, and needs back. It follows the repo's existing rules (ADR 0001 and the backend contract proposal): client UUIDv4 IDs, `recorded_at` + `device_clock_skew_ms`, an append-only ledger, corrections as linked records, quantity stored with its unit, and a single write path `POST /sync-batch`.

Until the backend exists, the app runs on local SQLite with seeded reference data. Only the app's sync layer will change when the API is ready.

---

## 1. Reference data (backend registers it later; the app seeds it locally for now)

| Entity | Fields | Notes |
|---|---|---|
| `vessels` | `id` uuid, `name` text, `registration` text (e.g. KE-LAM-MKW-T20-014 [TO CONFIRM: registration format]), `tonnage_class` int (10/20/50/100), `home_landing_site_id` uuid, `owner_name` text [TO CONFIRM] | Registered per landing site by the team |
| `landing_sites` | `id` uuid, `name` text (e.g. Mokowe), `bmu` text [TO CONFIRM] | |
| `captains` | `id` uuid, `display_name` text | The repo's "fisher". One captain per device per vessel in Phase 1 |
| `species` | `id` uuid, `local_name` text (never translated), `english_gloss` text | |
| `species_menu` | `tonnage_class` int, `species_id` uuid, `sort` int | The menu shown per vessel class [TO CONFIRM by client] |
| `hold_codes` | `code` A–D, `species_id` uuid | [TO CONFIRM: species group or physical hold] |
| `measurement_units` | `code` = `kg` (also `t`) | The captain enters whole kg; records are stored and sent in kg. `t` is a display option only, and may appear on plant weights from the feed |

## 2. Records the app creates (append-only, sent through `/sync-batch`)

All records carry: `id` (client UUIDv4), `device_id`, `recorded_at` (RFC 3339 with timezone), `device_clock_skew_ms` (nullable).

### Trip identity and lifecycle
One UUID per trip, made on the device at trip start: `trip_id` = `trip_start.id`. The app's local schema enforces this (`CHECK (trip_id = id)`).
Lifecycle: the captain starts the trip (`trip_start`), the captain closes it on arrival (`trip_close`), then the landing site processes the catch, issues the receipt and settles the trip (`trip_settled`, section 3). Archived is a status; nothing is deleted and records stay append-only.

### `trip_start` (new record kind)
`trip_id` (= `id`), `vessel_id`, `captain_id`, `crew_departed` int (1–24 [TO CONFIRM: crew limit]), `departure_at` [TO CONFIRM: source].

### `catch`
`trip_id`, `vessel_id`, `captain_id`, `species_id` (nullable, see "Other" below), `species_local_name` (required), `quantity` integer kg (minimum 1, sent as a decimal string with no fraction, e.g. `"15"`), `unit` = `kg`, `tier` = `S` (always, captain estimate), `hold_code`, `latitude`, `longitude`, `gps_accuracy_m`, `zone` [placeholder], `season` [placeholder], `water_temp_c` (nullable, sensor TBC), `note` (nullable, optional), `short_ref` (display only, e.g. XXXX-008).
Rules: one row per catch event, never merged; quantity is a whole number of kg, at least 1. Tonnes are a display option only, never the stored value. Species come from the menu by default; with "Other" the captain types the local name, sent exactly as typed with `species_id` = null (the backend routes it to `species_freetext` and the reconciliation queue).

### `catch_correction`
`catch_id`, `previous_correction_id` (nullable), `reason` (nullable), and the replacement fields (`species_id` (nullable), `species_local_name`, `quantity` (integer kg), `unit` = `kg`, `hold_code`, `note`).
Rule: allowed only while no plant weighing exists for that catch (answers D05 from the captain side). The server rejects it afterwards.

### `trip_close` (new record kind)
The captain's event. `trip_id`, `arrival_at`, `crew_returned` int (0–24 [TO CONFIRM: crew limit]), `crew_change_reason` (text, nullable), `landing_site_id`, `distance_km` (nullable), `catch_ids[]`, `total_quantity` integer kg + `unit` = `kg` (display check only; the server recomputes it).
Rule: if `crew_returned` differs from `crew_departed`, the app asks the captain to confirm and offers the optional reason (e.g. a crew member dropped at another landing site). The close is never blocked. The server flags the trip for the landing site.

## 3. What the app needs back (server → device)

Proposed as a read feed for the device's own records, either `GET /device-feed?since=<cursor>` or included in each `/sync-batch` response.

| Item | Fields | Shown as |
|---|---|---|
| Record ack | `id`, `status` (`inserted` / `already_present` / error) | Entry state → **Sent** |
| Review flag | `catch_id`, `status` = `being_checked` / `cleared`, `message` (nullable) | Entry state → **Being checked** [definition TO CONFIRM] |
| Plant weighing | `trip_id`, `species_id`, `catch_id` (nullable), `weight` + `unit`, `weighed_at` | **W** tier figure [granularity TO CONFIRM: per catch or per species per trip] |
| Corrections closed | `catch_id` or `trip_id`, `closed_at` | Hides **Correct**, shows "weighed at plant" |
| `trip_settled` (PROPOSED) | `trip_id`, `landing_site_id`, `settled_at` [TO CONFIRM: fields] | Set by the landing site, not the captain. Closes corrections for the trip |
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

## 6. Open for reconciliation

From the review of v0.1 (RWKarimi). Not changed in v0.2; to be settled in the reconciliation with `docs/libep-backend-contract-proposal.md`.

- **Fields the backend proposal would reject.** "The backend proposal rejects unknown properties and sets device_id from the authenticated device." Points raised: `device_id` is server-managed there; `unit` as a text code vs. `unit_id` as a UUID; `captain_id` vs. `fisher_id` ("Pick one before any SQL"); `tier`, `hold_code`, `short_ref`, `zone`, `season`, `water_temp_c`, `note`, `trip_id`, `vessel_id` "need to be added there or dropped from the wire".
- **`trip_close.catch_ids[]`.** "Those catches carry trip_id but aren't in the close record's list, giving two sources of truth for trip membership. Suggest catch.trip_id as the only source and dropping the list."
- **Personal data.** "vessels.owner_name and captains.display_name go beyond the backend proposal's minimal identity. Keep them only if there's a product need, and state it."
- **`tier`.** "tier can only hold S on a catch, so it carries no information on the wire. … Suggest dropping it from the catch record and deriving the tier on display." The meaning of `tier` and `hold_code` is on the agenda for Friday.
