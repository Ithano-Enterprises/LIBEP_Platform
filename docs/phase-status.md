# Backend phase status

## Phase 1: contract review — incomplete

Published proposal: [PR #18](https://github.com/Ithano-Enterprises/LIBEP_Platform/pull/18).
Tracking: [issue #17](https://github.com/Ithano-Enterprises/LIBEP_Platform/issues/17).

Completed: proposed relational contract, decision register, sync examples and
15 planned acceptance scenarios. These remain proposals, not accepted ADRs.

Incomplete: mandatory effort fields; device enrollment, fisher mapping and
access rules; corrections; reference/conversion data; GPS/skew policy; receiving
and receipt requirements; migration-pass acceptance; product/app-owner review.
These block schema and application integration work that depends on them.

## Phase 2: development and test foundation — in progress

Tracking: [issue #19](https://github.com/Ithano-Enterprises/LIBEP_Platform/issues/19).

Local verification: Deno formatting, lint, typecheck and all six unit tests pass.
Shell syntax, PR conventions and migration immutability checks also pass.

Implemented on this branch: pinned Deno tasks; permission-free unit tests for
UUIDv4 validation; local prerequisite checker; local setup instructions;
CI database-test discovery and behavioral unit-test execution on every PR.

Incomplete:
- Docker is not installed on the current development machine, so local database
  startup/reset and database acceptance tests have not been run here.
- Full schema acceptance cases await the accepted contract; Phase 3 adds only
  invariant-helper tests, not application behavior coverage.
- Required-check enforcement and review approval settings are unchanged.
- App integration, outage/recovery tests and hosted deployment are not covered
  by the six unit tests.
- Phase 2 PR #20 passed GitHub PR checks, Deno tests and database replay.
  Teammate review and local Docker verification are still incomplete.

## Phase 3: database foundation — partial implementation

Tracking: [issue #21](https://github.com/Ithano-Enterprises/LIBEP_Platform/issues/21).

Implemented: private UUIDv4 domain, reusable append-only trigger function and
16 pgTAP assertions on a disposable table. Seventeen checks also passed in a
local embedded PostgreSQL runtime (PGlite), which is not Supabase/Docker replay.
These implement locked invariants without choosing catch fields or permissions.

Incomplete: actual catch/identity/correction/reference tables, production trigger
attachment, RLS/read views, effort fields and accepted migration-pass scope.
These remain blocked by the Phase 1 contract decisions. Local Supabase replay
also remains blocked by missing Docker. This branch depends on Phase 2 PR #20;
it should not merge before that foundation is reviewed and adopted.

## Phase 4: reliable sync — transport groundwork only

Tracking: [issue #23](https://github.com/Ithano-Enterprises/LIBEP_Platform/issues/23).

Implemented: bearer credential syntax extraction and bounded streamed JSON input
with safe input errors. Sixteen new transport tests pass; 22 total Deno tests pass
locally. No sync endpoint is deployed and no application writes are implemented.

Incomplete: token verification, device permissions, accepted record schema,
atomic persistence, duplicate-content policy, durable acknowledgements, request
cancellation/timeouts, rate limits, browser-origin policy and real integration.
These depend on the unresolved Phase 1 contract and remaining Phase 3 schema.

This work is stacked after PR #22 and PR #20. Review and merge dependencies first.
The Phase 3 commit passed Supabase CI replay and all 16 pgTAP assertions; the
Phase 4 head must independently pass CI before review completion.

## Later phases

Sync, corrections/views, app integration and pilot release retain the dependencies
in the roadmap. Continue independent tooling work when useful; carry unresolved
items forward explicitly and never report a partial phase as complete.
