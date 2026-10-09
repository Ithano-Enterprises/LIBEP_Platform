# LIBEP backend contract proposal v0.1

Status: PROPOSED, NOT ACCEPTED. Prepared 2026-10-06.

A separate schema specification has not been identified by the backend owner or in the sources listed in the [Phase 1 review](libep-phase-1-contract-review.md). This proposal supplies a concrete replacement candidate; it does not claim that the missing specification never existed. Ryan should confirm the replacement and the team should record an additive decision before implementing it. ADR 0001 remains authoritative.

All new names and types below are proposed. The existing names `id`, `recorded_at`, `created_at`, `device_clock_skew_ms`, `species_freetext`, `v_catches_effective`, `v_catch_kg` and `v_reconciliation_queue` are preserved. The proposal does not rename any known specification columns. Discovery of an older specification requires comparison before adoption.

## 1. Boundary

Define an M1 contract for an offline catch ledger and an M4a integration boundary. Minimal fisher identifiers support M1; they do not implement the later full vessel/fisher registry. Use Supabase PostgreSQL and Deno Edge Functions. All application mutations enter POST /sync-batch. Reads use authorized read views. There is no direct application insert/update/delete access to base tables.

Proposal participants: Aaron (backend), Ryan (product and decision review), Benjamin (mobile and shared infrastructure), Nate (plant). No approval is implied by listing a participant.

## 2. Proposed common conventions

- Client-created entity IDs: UUIDv4, validated on input; no random server replacement on retry.
- Timestamps: PostgreSQL timestamptz; API accepts RFC 3339 values with an explicit timezone. Store the represented instant. Reject ambiguous local timestamps.
- created_at: assigned by the database on first insertion; clients cannot supply it.
- recorded_at: supplied by the device and preserved, even when its clock is wrong. Implausible-time alert thresholds are [TO CONFIRM]; do not silently adjust dates.
- device_clock_skew_ms: nullable bigint, integer milliseconds defined as device time minus trusted server time at measurement. Null means unmeasured, never zero by default. Measurement protocol and timestamp of that measurement are [TO CONFIRM].
- Measured numbers: PostgreSQL numeric and decimal strings in JSON. Precision/range limits are [TO CONFIRM: actual instruments and entry limits]; do not select arbitrary truncating precision.
- Reject unknown properties in each v1 record object. Preserve user-entered local species text separately from any normalized matching key.
- Error responses/logs must not contain credentials or other fishers' data. Operational log retention and location-data retention are [TO CONFIRM].

## 3. Proposed relational inventory

Every row below is a proposed design, not migration-ready SQL. PK means primary key; FK means foreign key. Required fields are NOT NULL unless identified as nullable. References and authorization rules must be enforced server-side, not just in the app.

| Table | Proposed columns | Constraints and remaining decisions |
|---|---|---|
| devices | id uuid PK; auth_user_id uuid UNIQUE FK auth.users; created_at timestamptz | Separate auth principal from fisher; auth_user_id is server-managed. Enrollment and credential lifecycle must be resolved before provisioning. |
| device_events | id uuid PK; device_id uuid FK devices; event_type text; recorded_at timestamptz; created_at timestamptz; actor_device_id uuid FK devices | Append-only enable/revoke history. Allowed event types and authoritative ordering must be finalized. Bootstrap actor is an explicit unresolved exception, not a hidden endpoint. |
| fishers | id uuid PK; created_at timestamptz | Minimal identity only. Display names, identifiers and personal data fields are [TO CONFIRM]; avoid collecting them without a product need. |
| device_fisher_events | id uuid PK; device_id uuid FK devices; fisher_id uuid FK fishers; event_type text; created_at timestamptz; actor_device_id uuid FK devices | Append-only grant/revoke events; effective authorization computed at request time. Rules for shared devices and multiple fishers are [TO CONFIRM]. |
| species | id uuid PK; local_name text; created_at timestamptz | Approved source, language distinctions, aliases and uniqueness policy are [TO CONFIRM]. Do not seed fabricated fish names. |
| measurement_units | id uuid PK; code text UNIQUE; display_name text; created_at timestamptz | Allowed real-world units and source are [TO CONFIRM]. |
| catches | id uuid PK; device_id uuid FK devices; fisher_id uuid FK fishers; recorded_at timestamptz; created_at timestamptz; device_clock_skew_ms bigint nullable; species_local_name text; species_id uuid nullable FK species; quantity numeric; unit_id uuid FK measurement_units; latitude numeric nullable; longitude numeric nullable; gps_accuracy_m numeric nullable; effort fields [TO CONFIRM] | device_id set from authenticated context. Latitude/longitude are both present or both null; bounds -90..90/-180..180; accuracy nonnegative when supplied. Quantity positive for a catch row is proposed; zero-catch effort reporting requires a product decision. Exact mandatory effort columns block finalization. |
| species_freetext | id uuid PK; catch_id uuid UNIQUE FK catches; original_text text; created_at timestamptz | Proposed interpretation of the established name as a table. Created transactionally for unmatched input; a deterministic client ID or server-derived ID strategy must be agreed before wire implementation. |
| catch_corrections | id uuid PK; catch_id uuid FK catches; device_id uuid FK devices; previous_correction_id uuid nullable FK catch_corrections; recorded_at timestamptz; created_at timestamptz; device_clock_skew_ms bigint nullable; reason text; replacement catch fields matching the final catches dictionary | Full replacement of correctable business fields, not arbitrary SQL/JSON patches. Original id, device provenance and created_at are immutable. Correctable fields and whether fisher attribution can change are [TO CONFIRM]. |
| species_reconciliations | id uuid PK; species_freetext_id uuid FK species_freetext; species_id uuid FK species; previous_reconciliation_id uuid nullable; device_id uuid FK devices; reason text; recorded_at timestamptz; created_at timestamptz | Auditable new decisions; explicit permission required. Unmatched corrected species also need transactional queue handling; finalize after correction fields are agreed. |
| unit_conversion_versions | id uuid PK; unit_id uuid FK measurement_units; species_id uuid nullable FK species; kg_per_unit numeric; evidence_reference text; created_at timestamptz | Factor must be positive. Applicability may require more context than unit/species. Do not assume a basket or count has a universal factor. Effective dating and factor selection are [TO CONFIRM]. |

Effort must become typed, validated columns once the actual measurements are confirmed. An unrestricted JSON object is not a substitute for deciding mandatory effort fields. This unresolved area is why no example below is presented as a valid catch record.

## 4. Corrections and effective reads

Proposed correction concurrency rule: clients submit the last correction ID they saw (null for the original). In one transaction, lock the catch, check the authorized current correction, and append only if the expected predecessor matches. A stale predecessor returns a conflict; the device retains its proposed correction for review. Do not choose the winner using device timestamps. A replay of the same correction ID/content is acknowledged before evaluating its now-stale predecessor.

The same original catch remains present permanently. Triggers reject updates/deletes on catches, corrections and audit-event tables through normal DML, including service-role requests. This protects application writes; it is not a claim that a database owner cannot change database definitions.

Proposed read views:

| View | Purpose | Required behavior |
|---|---|---|
| v_catches_effective | Authorized original catch plus accepted correction | One row per catch; include original catch ID and effective correction ID for provenance |
| v_catch_kg | Effective measurement plus defensible conversion | Retain raw quantity/unit; return null converted kg and an explicit unresolved status when no unambiguous supported conversion exists |
| v_reconciliation_queue | Unmatched effective species awaiting resolution | Preserve original text and catch linkage; access limited to assigned scope |

Define exact view output columns after the effort/correction/conversion decisions. Explicitly test invoker behavior, grants and RLS with unprivileged roles. Views must not bypass scope restrictions. Plant receiving reads may require a distinct authorized view, whose fields are [TO CONFIRM].

## 5. Proposed sync envelope and response

These examples define envelope shapes only. Empty records are shown deliberately: catch field requirements are not complete yet. Examples use placeholders for IDs; they are not executable requests.

```json
{
  "contract_version": 1,
  "records": []
}
```

Proposed record wrapper:

```json
{
  "kind": "catch",
  "data": {
    "id": "<client UUIDv4>",
    "fisher_id": "<authorized fisher UUID>",
    "recorded_at": "<RFC 3339 device timestamp>",
    "device_clock_skew_ms": null,
    "species_local_name": "<actual local species name>",
    "species_id": null,
    "quantity": "<measured decimal>",
    "unit_id": "<approved unit UUID>"
  }
}
```

The record example is INCOMPLETE: mandatory effort columns and agreed GPS fields must be added before acceptance. device_id and created_at are server-managed. Final record kinds beyond catch and catch_correction are [TO CONFIRM], especially enrollment, reconciliation and receiving operations.

Proposed first-release transaction policy: all records in a batch are validated and authorized before new rows commit. Commit atomically, including associated unmatched-species entries. Apply deduplication using ID conflict-safe inserts and ownership/content checks under transactional concurrency control. A transaction/RPC used internally by the Edge Function is not a second client write path; deny direct unprivileged execution.

Canonical retry comparison uses validated business values and original attribution, excluding server-assigned created_at. Equivalent decimal/time serialization is normalized for comparison without rewriting original business meaning. Exact normalization is specified in implementation tests. Duplicate IDs within a submitted batch must be either identical authorized retries or rejected; array order must not choose a winner.

Successful response proposal:

```json
{
  "contract_version": 1,
  "results": [
    {"id": "<submitted ID>", "status": "inserted"},
    {"id": "<submitted ID>", "status": "already_present"}
  ]
}
```

The client acknowledges only IDs in a successful response that are durably stored with matching authorized content. A missing response is not evidence of failure; resend unchanged records. Cross-device retry and recovery must be decided before treating a different submitting device as equivalent provenance.

Failure response proposal:

```json
{
  "contract_version": 1,
  "error": {
    "code": "VALIDATION_FAILED",
    "retryable": false,
    "record_id": "<submitted ID or null>",
    "field": "<invalid input field or null>"
  }
}
```

| Proposed HTTP status | Meaning | Client action |
|---|---|---|
| 400 | Malformed envelope or unsupported version | Retain batch; fix client/contract |
| 401 | Missing/invalid/expired authentication | Attempt permitted renewal; preserve queue |
| 403 | Revoked device or insufficient scope | Preserve queue; user/admin resolution; do not reveal inaccessible records |
| 409 | Different content for same authorized ID, or stale correction predecessor | Retain record for resolution; never silently overwrite |
| 413 | Payload exceeds agreed limit | Split batch without changing record IDs |
| 422 | Invalid record fields or relationships | Retain all unacknowledged rows; resolve invalid record before resubmission |
| 429 | Rate limit | Retry after server guidance/backoff |
| 5xx / connection loss | Transient or unknown commit outcome | Retry same IDs with backoff |

Batch row/byte limits, retry schedule, record dependency order, and exact error codes are [TO CONFIRM]. A frontend must not automatically mutate an already-saved catch to resolve validation errors; define the correction/rejection workflow consistently with append-only device behavior.

## 6. Device auth and bootstrap decision

Propose one authenticated principal per registered device, with explicit authorized fisher/scope associations. Validate current revocation and scope server-side, even if a signed credential has not expired. A mobile offline save can proceed without connectivity, but future upload may require renewal or authorized recovery.

Unresolved before implementation: enrollment proof, credential storage/renewal, recovery from lost devices, initial administrator provisioning, plant staff identity and credential revocation. The single-write-path rule must explicitly explain bootstrap and reference-data administration. No public service-role key, unprotected registration route or unapproved alternative mutation endpoint is introduced by this proposal.

## 7. M4a integration boundary

The known scope is receive fish, confirm weights, issue receipts and view operational records. Keep these as distinct business events from the original fisher measurement; a verified plant weight should not silently overwrite the fisher's declared weight.

Ask Ryan and Nate to resolve: recipient of receipt, mandatory receipt fields/numbering, multiple catches per receipt, split deliveries, unknown catch references, discrepancy handling, duplicate receipt prevention, permitted corrections and plant read scope. Until resolved, do not create invented receiving tables or promise that the M1 schema covers every receiving case.

## 8. Proposed three migration passes

This grouping is proposed for D09 review; it is not the missing original specification.

1. Identity/reference foundations and catch ledger: required typed fields, minimal device/fisher relationships, approved reference data structures, immutability guards and access restrictions. Include a provisional authorized v_catches_effective with original rows only if the team accepts this compatibility approach. Do not expose base tables to unblock apps.
2. Corrections and effective reads: correction chain, concurrency guards, preserved output contract, authorized views and correction acceptance tests. Maintain the same view contract where possible; document additive fields.
3. Reconciliation and conversion: species matching audit, unresolved queue, conversion provenance, v_catch_kg and tests for missing/ambiguous evidence. M4a writes are a separate agreed extension if their contract is not ready.

Deploy the sync endpoint only once the record kinds it advertises have their complete database support and security tests. Each pass can contain multiple small migrations and PRs. Replaying migrations successfully is necessary but not sufficient: execute the companion review's T01-T15 scenarios appropriate to each pass.

## 9. Acceptance and next action

The next review should first confirm this replacement-spec process and settle catch/effort fields, device access and minimum plant receiving requirements. Those answers determine the final SQL and valid JSON fixtures. Accept the exact contract in an additive ADR/document PR; do not edit ADR 0001 to imply these proposals were previously agreed.

No schema, endpoint or deployment has been implemented. This draft deliberately remains incomplete where product facts are unknown. Phase 1 ends when the decision register is resolved and the versioned contract is reviewed, not merely when this proposal exists.
