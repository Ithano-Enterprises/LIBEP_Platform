# Atomic logbook intake and device scope

Status: implementation for review; disabled by default, not deployed. Backend owner
approved atomic batches on 2026-10-29. The latest instruction keeps device
enrolment pending Ryan. The device lookup schema is a candidate for review.
This does not claim Ryan/mobile/plant approval of all remaining policies.

## Implemented decisions

- One device Auth principal maps to one immutable fisher/vessel assignment.
  The wire name `captain_id` maps to database `fisher_id` explicitly.
- Devices need an enabled event. Append-only enable/revoke history is ordered
  by a server sequence; device timestamps cannot change permission order.
- The entire batch commits or rolls back, including receipt and free-text side
  rows. Error responses name the offending record when known.
- IDs are globally unique across the supported ledger kinds. Same device, kind
  and canonical content is `already_present`; changed content is `id_conflict`.
  Decimal spellings and timestamp instants compare semantically. Original JSON
  remains in `sync_records.raw_data`, separate from canonical comparison data.
- Requests may retry after a lost response without overwriting or duplicating.
- A device cannot upload for a different captain, vessel or device. New writes
  against a trip must be from its original device; replacement-device recovery
  is deliberately not implicit.
- Departure/return discrepancies flag the close but never block it. Declared
  and independently computed totals are stored separately. No alerting or
  settlement workflow is implied.
- `catches.trip_id` is membership authority. The current app's `catch_ids` is a
  retained snapshot, checked for foreign-trip references, not a second membership
  table. The candidate field can be removed only with a coordinated contract change.

## Database components

New migrations add minimal private reference IDs, devices, device events ; trip starts, catches, trip closes, unmatched species,
and shared idempotency receipts. No real reference data or administrator is seeded.
No existing migration is edited.

`libep_private.apply_logbook_batch` is a SECURITY DEFINER function with fixed
`search_path`, explicit verified-user/device/scope checks and restricted EXECUTE.
`public.sync_logbook_batch` is an INVOKER wrapper granted only to `service_role`.
Apps cannot call the wrapper or access base tables. All new tables enable RLS;
there are no permissive client policies. The service role has no direct ledger
DML grants; the private function supplies the narrow mutation capability.

The verified auth user ID is a trusted server-adapter argument, not a payload
field. The Edge Function obtains it from Auth `/auth/v1/user`; it does not decode
JWT claims and trust user-editable metadata. The Supabase gateway JWT check remains
on. The server role credential never reaches either app.

Uploads lock their device row before examining current events. Device-event
inserts lock the same row, serializing revocation with uploads. A request ordered
before revocation may finish; subsequent requests are refused. Global UUID
collisions are resolved with `INSERT ... ON CONFLICT DO NOTHING` and content checks.
Parallel-session load/concurrency verification is still required before rollout.

All identity/event/ledger/receipt/side rows have update/delete/truncate guards.
Reference and device maintenance is not exposed to clients.

## HTTP path

`POST /sync-batch` checks enablement, method/origin policy, bearer verification,
bounded JSON, candidate validation, then invokes the transaction once. No 200 is
constructed before the transaction result arrives. Unknown transport failures
return a safe retryable 503 because commit outcome may be unknown. The client
must retain IDs and records. Error responses never expose database exceptions or
credentials.

Read-side endpoints are not present. No device can retrieve another captain's
records through these tables; useful authorised reads still require B5 work.
This denial is not a completed read-view implementation.

## Configuration and staging gate

There are no production defaults. All values require agreement in a staging runbook:

- `LIBEP_SYNC_ENABLED=true` explicitly enables the handler; otherwise 503.
- `LIBEP_SYNC_MAX_BYTES`, `LIBEP_SYNC_MAX_RECORDS`, `LIBEP_SYNC_MAX_CREW`,
  `LIBEP_SYNC_TIMEOUT_MS`: positive safe integers, explicitly configured.
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`: server environment only.

Absent/invalid configuration fails closed. No hosted config or secrets were changed.
The adapter has bounded upstream request timeouts; full inbound request deadline,
rate limiting, operational metrics and log retention remain incomplete.

## Device enrolment remains pending Ryan

There is no enrolment adapter, administrator allowlist, public registration RPC,
credential provisioning or recovery implementation. The earlier draft adapter
was removed after the owner's latest instruction to wait for Ryan. No real
identity/reference rows are seeded and no service/client role can directly
insert or change device assignments or events.

The schema represents the candidate current-device lookup needed to test atomic
intake and scoped rejection. Tests use explicitly synthetic users, assignments and
events. Its captain/vessel assignment and event shape still require Ryan's review;
they must not be presented as an agreed enrolment design or enabled in staging.

Initial administrator bootstrap, reference import, proof of device ownership,
Auth account creation, credential delivery/renewal, revocation operations and
lost-phone recovery require an agreed runbook through the single write path.
Do not provision devices by copying test SQL.

## Intentionally unavailable

- New `catch_correction` records return 422 `record_kind_not_enabled`; correction
  actors, plant/settlement closure and recovery require joint agreement. The
  validator recognises their shape but storage does not advertise support.
- New catches after a trip close return 409 `trip_closed`. This is a conservative
  staging restriction while late-arrival policy is unresolved, not a settled
  product decision. Identical retries still succeed before that check.
- Plant weights, settlements, receipts, effective/reporting/reconciliation views,
  scoped device feeds, bootstrap, reference import and production deployment.
- Plant weight decimals must remain separate from whole-kg captain estimates.

The current mobile app therefore cannot be switched to this endpoint as-is.
Before enablement Benjamin must implement dependency-aware holds after 409/422,
pause/resume after 400/401/403, and isolation of synthetic fixtures from hosted
services. Correction-bearing batches must not be silently dropped or rewritten.

## Verification

- Deno: formatting, lint, typecheck and 83 permission-free tests.
- `supabase/tests/atomic_sync_test.sql`: 54 pgTAP assertions, plus the earlier 33.
- Local embedded PostgreSQL: the same 54 SQL scenarios
  through local assertion shims. This is not a real Supabase/Docker replay.
- Mobile payload compatibility remains checked against PR #43 at `946b10d`.
- GitHub CI runs real migration replay, pgTAP and pinned Deno checks. Record its
  result/commit in the PR; do not infer live/device acceptance from green CI.
