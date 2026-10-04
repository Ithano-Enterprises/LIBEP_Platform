# 0001. Logbook data model

Status: accepted, locked

## Context

Fishers record at landing on phones that are frequently offline, with clocks
that may be wrong, and the same batch may be sent more than once. The data
feeds stakeholders (LAMCOT, Lamu County Department of Fisheries, Beach
Management Units) who need to trust it.

## Decision

1. **Device-level auth.** Fisher identity is a data field, not `auth.uid()`.
2. **Offline-first.** Primary keys are UUIDv4 generated on the client. Inserts
   use `ON CONFLICT (id) DO NOTHING`.
3. **Clock skew is recorded, never corrected.** Store `recorded_at`,
   `created_at` and `device_clock_skew_ms`.
4. **Append-only ledger.** No updates or deletes on catches. Corrections go in
   a corrections table and readers use `v_catches_effective`.
5. **Triggers enforce append-only, not RLS.** Edge Functions use the service
   role key, which bypasses RLS.
6. **Quantity in the unit measured.** Conversion to kg lives in `v_catch_kg`.
7. **Species as local name.** Unmatched names go to `species_freetext` and
   surface in `v_reconciliation_queue`.
8. **Effort fields are mandatory.**
9. **Single write path.** `POST /sync-batch` Edge Function.
10. **Migrations split by concern**, built in three passes, no column renames
    from the schema spec.

## Consequences

- A retried sync is harmless, so the client can retry blindly.
- Raw data is never lost; every correction is auditable.
- Readers must use the views, never the base tables.
- Species reconciliation is ongoing human work, by design.
