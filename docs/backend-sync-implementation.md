# M1 backend implementation status — 2026-10-29

## Update: approved rules implemented for review

Aaron approved atomic batches. His latest instruction keeps device enrolment
pending Ryan; the device lookup schema remains a candidate. The new implementation and its explicit rollout boundaries are described
in [atomic sync setup](setup/atomic-sync.md). This supersedes the pending D03/D04
atomic-batch entry and initial-validator-only descriptions below. D03 enrolment
remains pending Ryan. Joint policy review,
administrative bootstrap and production provisioning remain outstanding.

- B1: minimal reference IDs, immutable assignment, candidate device events implemented; admin adapter removed, real imports and
  enrolment workflow pending Ryan.
- B2: trip starts, catches, closes, receipts and free-text side rows implemented;
  correction/plant ledger and agreed late-catch policy incomplete.
- B3/B4: atomic RPC and disabled-by-default authenticated HTTP handler implemented;
  concurrency load tests, rate limits, deployment and real integration incomplete.
- B5–B7: useful scoped views, feed/bootstrap, plant round trip and real-phone tests
  remain incomplete. No phase is declared complete from helper tests alone.

## Previous increment: contract validation

This records the initial integration inventory. Older phase reports below describe
historical work, not current merge status. No live backend endpoint exists yet.

## Baseline verified

`Develop` at `3d86cd8` contains #20 (verification), #26 (ledger invariants,
input helpers, conversion arithmetic), #29 (mobile scaffold), and #30 (proposed
on-device-store ADR). The mobile stack #31–#43 remains unmerged. #34 remains a
proposal with Ryan's change-request review outstanding. Do not treat unmerged
mobile code or the October 23 PDF as an accepted backend schema.

The existing migrations provide a UUIDv4 domain, immutable-ledger trigger and
conversion arithmetic. They do not create application tables, device grants,
RLS policies, batch persistence, feed or bootstrap endpoints.

## This increment

- Candidate validation of all four current mobile payload shapes.
- Shared, explicitly synthetic four-record fixture and actual mobile
  `buildBatch` compatibility check.
- Tests covering invalid input, precision preservation, nullable corrections,
  zero-catch closes, crew discrepancies, raw timestamps and safe errors.
- No changes to accepted ADRs, existing migrations, mobile code or deployments.
- No `Deno.serve` entry point: callers cannot deploy this validator as a falsely
  complete write API. Authentication and persistence are not simulated in production.

See [contract candidate](../contract/README.md) for exact source commits and how
other developers can consume and verify it.

## Decisions and ownership

| Decision | Current status / action |
|---|---|
| Current mobile fields | Aaron authorised preparation as a candidate on 2026-10-29: `captain_id`, `unit`, whole kg, departed/returned crew, Other species. Joint contract acceptance remains outstanding. |
| D04 batch policy | Aaron's confirmation pending: recommended atomic batch with failing record named. No persistence policy implemented yet. |
| D03 devices | Aaron's confirmation pending for admin-enrolled devices scoped to a captain/vessel; enrolment proof, renewal, recovery and Ryan review remain necessary. |
| Database names vs wire names | Proposed mapping must be explicit; candidate wire names do not rename the earlier proposed `fishers` tables. |
| Client device_id | Verify against authenticated device or remove in coordinated payload change. Never derive permission from request data. |
| Correction permissions / closure | Ryan + Benjamin: which devices may correct; plant weighing vs settlement closure. Local validation chooses neither. |
| Plant weighing granularity | Ryan + Nate/plant: per catch or species/trip. Preserve fractional plant precision. |
| Late catches and trip membership | Ryan + Aaron: late arrival policy and whether `catch_ids` remains a snapshot or is removed. `catch.trip_id` must not silently conflict with another membership source. |
| Review status | Ryan: meaning/actors for being_checked and cleared. |
| Limits | Aaron + product: row/byte/crew/text limits, timeout and rate limiting. Do not infer approved limits from test values. |
| Reference data | Approved species, vessel classes, hold meanings and conversion sources; fictional fixtures are never production seeds. |
| Feed/bootstrap | Recommended separate read endpoints, versioned reference data and scoped cursor feed; cursor consistency and permissions still to design. |
| Plant writes | Must obey ADR 0001 single write path; no separate public weighing mutation endpoint. Plant record kinds/permissions require agreement. |

## Phases and incomplete work

| Phase | Done | Incomplete / next acceptance evidence |
|---|---|---|
| B0 contract | Latest payload snapshot, candidate validator/fixture | Joint approval, remaining decisions, rejected/accepted wire examples for transaction rules |
| B1 identity/reference | Earlier UUID/helper foundation available | Application tables, provisioning, grants/revocation, approved reference sources, pgTAP |
| B2 ledger | Earlier immutable trigger available | Actual four ledgers, species_freetext, relational constraints, triggers, chain index and database tests |
| B3 persistence | None | Agreed transaction policy, retry comparison, concurrency and correction guards |
| B4 HTTP sync | Earlier bounded body/bearer syntax helpers; candidate shape validation | Token verification, current device/scope checks, endpoint, transactional RPC, rate/timeout controls, endpoint tests |
| B5 reads/security | None | Effective views, reconciliation, conversion mapping, grants/RLS and isolation tests |
| B6 integration | Shared mobile payload check | Staging, fixture isolation, real HTTP transport and offline/replay tests on a real phone |
| B7 plant round trip | None | Agreed receiving contract, authorised ingest, feed/bootstrap, weight and correction-closure tests |

Do not mark a phase complete from passing helper tests. Benjamin owns the phone
transport/screens; Nate owns the plant interface; Aaron owns the backend and
shared integration contract. Ryan retains merge responsibility.

## Verification for this increment

Run `DENO_BIN=/path/to/deno bash scripts/ci/check-backend.sh` and the Node 24
compatibility command in `contract/README.md`. Local Deno is 2.9.1; CI pins 2.9.6.
No migration changed. Local Supabase database replay remains unverified because
Docker and Supabase CLI are unavailable on this machine. CI database replay is
separate evidence, not a substitute for a real-phone or hosted acceptance test.
