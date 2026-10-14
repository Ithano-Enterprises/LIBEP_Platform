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
- SQL acceptance cases await real migrations and the accepted contract.
- Required-check enforcement and review approval settings are unchanged.
- App integration, outage/recovery tests and hosted deployment are not covered
  by the six unit tests.
- CI results and teammate review must be assessed before merging this branch.

## Phase 3: database foundation — blocked by Phase 1

No migrations are introduced by Phase 2. Begin implementation only for fields,
authorization and migration passes whose contract is settled. Do not interpret
publishing a proposal or passing tooling checks as schema approval.

## Later phases

Sync, corrections/views, app integration and pilot release retain the dependencies
in the roadmap. Continue independent tooling work when useful; carry unresolved
items forward explicitly and never report a partial phase as complete.
