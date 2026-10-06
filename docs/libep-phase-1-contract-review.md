# LIBEP Phase 1: backend contract review

Status: DRAFT — discovery completed within the sources below; contract decisions remain open.
Prepared: 2026-10-06.
Repository: https://github.com/Ithano-Enterprises/LIBEP_Platform
Reviewed Develop commit: `9d0fbcefa1e13f5747493426061f1cc0eee3d3d3`.
Backend owner: @aaronandrew146-stack.

This document is a review proposal, not an accepted ADR or executable schema. It does not supersede locked decisions. No field names beyond those explicitly established below should be treated as approved database or API names.

## 1. Scope and evidence

The first backend supports M1 fisher logbook and the parallel M4a minimal receiving slice. Full vessel registry, port handover, processing, dispatch, market features, AWS and equipment integration are later work.

Sources:

- [README](https://github.com/Ithano-Enterprises/LIBEP_Platform/blob/9d0fbcefa1e13f5747493426061f1cc0eee3d3d3/README.md)
- [Roadmap](https://github.com/Ithano-Enterprises/LIBEP_Platform/blob/9d0fbcefa1e13f5747493426061f1cc0eee3d3d3/docs/ROADMAP.md)
- [Team](https://github.com/Ithano-Enterprises/LIBEP_Platform/blob/9d0fbcefa1e13f5747493426061f1cc0eee3d3d3/docs/TEAM.md)
- [ADR 0001: locked data model](https://github.com/Ithano-Enterprises/LIBEP_Platform/blob/9d0fbcefa1e13f5747493426061f1cc0eee3d3d3/docs/decisions/0001-logbook-data-model.md)
- [ADR 0003: apps and stack](https://github.com/Ithano-Enterprises/LIBEP_Platform/blob/9d0fbcefa1e13f5747493426061f1cc0eee3d3d3/docs/decisions/0003-team-roles-apps-and-stack.md)
- [AI contribution rules](https://github.com/Ithano-Enterprises/LIBEP_Platform/blob/9d0fbcefa1e13f5747493426061f1cc0eee3d3d3/CLAUDE.md)
- [Contribution guide](https://github.com/Ithano-Enterprises/LIBEP_Platform/blob/9d0fbcefa1e13f5747493426061f1cc0eee3d3d3/CONTRIBUTING.md)

Discovery checked the current Develop tree, all returned issue/PR descriptions and issue comments. The discovery baseline contained Develop and main only. The provided repo instruction manual was already reviewed and is a contribution guide, not a schema specification. These checks do not establish that no external specification exists. GitHub Project boards and external team documents have not been inspected. The milestones endpoint was unavailable through the connector.

There are no schema migrations or application implementations in the reviewed tree. The original schema specification referenced by ADR 0001 was not located in these sources. Phase 1 cannot be marked complete until that specification is obtained, or the team explicitly establishes a replacement through its decision process.

## 2. Confirmed contract invariants

| ID | Locked requirement | Consequence for implementation |
|---|---|---|
| C01 | Device-level authentication; fisher identity is data, not auth.uid() | Model authenticated devices separately from fishers. Exact enrollment and authorization mapping are unresolved. |
| C02 | Offline-first, client UUIDv4 primary keys | Preserve the client's record ID across every retry. |
| C03 | Inserts use ON CONFLICT (id) DO NOTHING | A repeated ID cannot replace the original record. Conflict ownership and acknowledgement semantics still need definition. |
| C04 | Preserve recorded_at, created_at, device_clock_skew_ms | Never rewrite a fisher's recorded time to compensate for skew. Types, timestamp provenance and skew measurement remain to be specified. |
| C05 | Catches are append-only; corrections are separate records | Do not implement catch updates or deletes as a correction mechanism. |
| C06 | Database triggers enforce immutability | RLS alone cannot protect the ledger from a service-role write path. |
| C07 | Readers use v_catches_effective | Define correction precedence and view access before app integration. |
| C08 | Store the quantity in the measured unit; conversion in v_catch_kg | Preserve raw quantity and unit. Confirm approved conversion data. |
| C09 | Local species names; species_freetext and v_reconciliation_queue | Preserve unmatched input and support subsequent human reconciliation. The exact shape of species_freetext must come from the specification. |
| C10 | Effort fields mandatory | Obtain the actual field list, units and validation rules; do not invent them. |
| C11 | POST /sync-batch is the single write path | Both apps use the agreed write contract; no separate client database-write route. |
| C12 | Three migration passes, split by concern, no spec column renames | Confirm the contents and dependencies of each pass before SQL implementation. |

## 3. Data dictionary completion worksheet

This is the inventory to reconcile with the missing specification, not a proposed set of final table names.

| Concept or established name | Known now | Required before implementation |
|---|---|---|
| Record id | UUIDv4 generated on client | Uniqueness scope, collision acknowledgement and ownership rules |
| recorded_at | Original device-recorded time preserved | Type, timezone serialization, allowed range and missing-value policy |
| created_at | Stored alongside recorded time | Confirm server receipt semantics and whether clients may supply it |
| device_clock_skew_ms | Stored, not corrected | Sign convention, measurement source, nullable/unknown handling |
| Fisher identity | Separate from authenticated device | Exact identifier, minimal M1 identity model, device-to-fisher relationship |
| Device identity | Authentication principal | Enrollment, credential renewal, lost/replaced device and revocation behavior |
| Quantity and unit | Preserve original measurement | Exact names, precision, allowed units, zero/negative and maximum-value rules |
| Species | Local name; unmatched input retained | Exact fields, reference list source, matching policy and reconciliation permissions |
| Effort | Mandatory | Exact names, types, units, allowed values and per-trip/per-catch relationship |
| GPS | Mobile captures location | Accuracy, coordinate types, no-fix handling and access/retention requirements |
| Corrections | Separate from original catch | Table name, target linkage, allowed corrected fields, actor, reason, ordering and authorization |
| Effective-catch view | v_catches_effective | Output columns, precedence, joins and authorization behavior |
| Kilogram view | v_catch_kg | Conversion provenance, versioning and unavailable/ambiguous-factor handling |
| Reconciliation view | v_reconciliation_queue | Queue criteria, resolution record and permitted readers/writers |
| Plant receiving | Receive fish, confirm weights, issue receipts, view records | Catch-to-delivery relationship, partial/combined deliveries, verified-weight fields, receipt contents and recipient |

For every final field record: exact name, type, nullability, unit, source, default, constraints, relationship, reader/writer permissions and acceptance test. Do not publish realistic personal or operational data as examples in this public repository.

## 4. Proposed sync semantics for review

Everything in this section is a recommendation, not an accepted requirement. It fills implementation questions without changing the locked insert-only model.

1. Authenticate the device and verify its current authorization before processing writes. Do not trust a payload's claimed device identity as authorization.
2. Validate the entire envelope, each record and all permitted fisher/resource relationships before committing anything.
3. Prefer an atomic batch for the first contract: either all new valid records commit, or none do. Existing authorized identical records can be treated as retries. This requires a transactional database operation; sequential independent inserts are not sufficient.
4. For an existing ID, compare ownership and canonical business content. A true retry can be acknowledged; a different payload must not overwrite the row or be reported as successfully saved. Avoid disclosing whether an inaccessible record exists.
5. A success response must identify durable acknowledgements for the submitted records. If the response is lost, clients resend the same IDs. The mobile queue removes a record only after durable acknowledgement.
6. Separate temporary failures from validation/conflict failures. Retry temporary failures with backoff; retain permanent failures locally with an actionable error. Authentication renewal and revoked-device handling need a distinct path.
7. Confirm exact JSON envelope, supported record kinds, ordering/dependencies, versioning, response fields, HTTP statuses, batch limits and error codes before implementing clients or the endpoint.
8. Confirm how reference data, device enrollment and reconciliation writes fit the single write-path rule. Do not silently add administrative mutation endpoints.

Decision required: atomic versus partial success. Atomic batches simplify acknowledgement but one invalid record blocks the batch; partial success requires an exact per-record retry/acknowledgement contract. Backend and mobile owners must select and document one behavior.

## 5. Authorization worksheet

| Actor | Access to settle | Proposed baseline, subject to review |
|---|---|---|
| Fisher device | Which fishers/catches it may submit and read | Only explicitly authorized relationships; fisher ID alone confers no access |
| Plant operator/device | Receiving, weights, receipts and catch lookup | Only assigned operational scope; access to fisher records must be explicitly defined |
| Reconciler | Species matching and correction privileges | Explicit permission and auditable new records |
| Project administrator | Enrollment, revocation and reference maintenance | Separate administrative capability, never distributed service-role credentials |
| Backend service | Validated writes | Service-role credentials stay server-side; database guards still enforce append-only behavior |

Outstanding: role storage, scope boundaries, multi-device access, device loss, offline credential expiry, retention, exports and view security. A view must not expose data that its caller could not otherwise read; verify with real database roles rather than only service-role tests.

## 6. Decision register

Suggested participants below are review owners, not newly assigned GitHub tasks. All items are OPEN.

| ID | Decision / evidence needed | Suggested participants | Blocks |
|---|---|---|---|
| D01 | Original schema specification location/version, or agreed replacement process | Aaron, Ryan | Exact schema and migration-pass contents |
| D02 | Exact catch and effort fields, units and constraints | Aaron, Ryan, Benjamin | Catch migration and mobile validation |
| D03 | Device enrollment, fisher mapping, scope, renewal and revocation | Aaron, Benjamin | Authentication, read policies and sync authorization |
| D04 | Batch atomicity, duplicate mismatch behavior, payload and acknowledgements | Aaron, Benjamin, Nate | Edge Function and both write clients |
| D05 | Correction actors, reasons, fields, concurrent changes and ordering | Aaron, Ryan, Nate | Corrections and effective view |
| D06 | Species and unit sources, conversion provenance, reconciliation roles | Aaron, Ryan | Reference schema, kg and reconciliation views |
| D07 | GPS no-fix/accuracy and clock-skew measurement/unknown policy | Aaron, Benjamin, Ryan | Location/time validation |
| D08 | Minimum receiving contract, weight confirmation and receipt requirements | Aaron, Nate, Ryan | M4a integration |
| D09 | Confirm contents of migration passes 1, 2 and 3 | Aaron, informed by D01-D08 | Migration implementation order |

The backend owner has not identified a separate existing specification. A [replacement contract proposal](libep-backend-contract-proposal.md) has therefore been drafted for review. This supports drafting, but does not prove that an older specification does not exist or resolve the domain decisions. D01 now requires confirmation of the replacement process; D02, D03 and D08 are the next product/integration inputs.

## 7. Acceptance scenarios to turn into tests

These are planned tests, not tests already executed. Scenarios that depend on a proposed policy are finalized after that policy is accepted.

| ID | Scenario | Required observable outcome |
|---|---|---|
| T01 | Replay migrations on an empty local database | All migrations apply without manual changes; expected constraints, views and guards exist |
| T02 | Upload the same authorized record repeatedly and concurrently | One original row; stable durable acknowledgement |
| T03 | Lose the network response after commit and resend | No duplicate; client can safely acknowledge the original ID |
| T04 | Reuse an ID with different data or ownership | No overwrite, no unauthorized disclosure and no false acknowledgement of changed data |
| T05 | Submit a batch containing valid and invalid records | Exactly the agreed atomic/partial behavior; no ambiguous acknowledgements |
| T06 | Missing or invalid effort, unit, quantity or timestamp | Agreed validation error; no silent coercion or fabricated defaults |
| T07 | Invalid, expired or revoked device credentials | Agreed rejection/renewal behavior; no unauthorized insertion |
| T08 | Device submits or reads outside its allowed fisher/plant scope | Denied, including reads through views and conflict/error responses |
| T09 | Update/delete an original catch using the backend service role | Trigger rejects the operation |
| T10 | Submit a correction | Original remains intact; correction remains attributable; effective view follows agreed precedence |
| T11 | Concurrent or retried corrections | No duplicate correction; deterministic agreed effective result |
| T12 | Unmatched local species | Original text retained; appears in reconciliation queue |
| T13 | Reconcile species or apply unit conversion | Auditable source; raw measurements unchanged; agreed unknown-factor behavior |
| T14 | Record time with skew, unknown skew or no GPS fix | Original data preserved; agreed acceptance/error behavior |
| T15 | Plant receives a retry or partial/combined delivery | Correct agreed linkage and receipt behavior; no duplicate receipt/weight record |

## 8. Review and follow-on work

This proposal targets `Develop` on `docs/backend-contract`. Track contract acceptance separately from publishing this draft. Keep the contract task open until its decisions are resolved; implementation tasks should cite the accepted contract version and relevant test IDs.

Proposed follow-on work, not approved migration-pass contents:

- Local backend tooling and executable test harness.
- First schema pass once D09 is resolved.
- Authentication/authorization and sync implementation.
- Remaining approved schema passes and read views.
- Mobile/plant integration and failure-mode tests.

## 9. Phase 1 completion gate

- [ ] Original specification obtained/versioned, or replacement process explicitly agreed.
- [ ] Exact field dictionary completed with no invented spec names.
- [ ] D01-D09 resolved or explicitly deferred with affected implementation excluded.
- [ ] Device/role permission matrix and read/write paths accepted.
- [ ] Request/response examples and failure/retry behavior agreed with both app owners.
- [ ] Three migration passes mapped to dependencies and acceptance scenarios.
- [ ] Ryan reviews product assumptions; Benjamin and Nate review their integration contracts.
- [ ] Contract is published through the agreed repository review workflow.

Current result: evidence and review packet prepared. Phase 1 is still in progress. This documentation introduces no migrations, endpoint implementation or hosted resources.
