# Database invariant foundation

These migrations implement only ADR 0001's UUIDv4 syntax constraint and reusable
append-only trigger guard. They do not create catches, identities, permissions,
correction tables or a sync endpoint. Phase 1 domain decisions remain open.

`libep_private.client_record_id` is a UUID domain checking version and variant.
Future ID columns still require primary-key / NOT NULL constraints. PostgreSQL
normalizes accepted UUID input; API syntax validation remains a separate check.
Neither the domain nor the trigger establishes caller authorization.

When an accepted ledger table is introduced, attach
`libep_private.reject_ledger_mutation()` using both a BEFORE UPDATE OR DELETE
row trigger and a BEFORE TRUNCATE statement trigger. The current migrations
provide the function but protect no production table until those triggers are
attached. The schema and function are not exposed to application roles.

The pgTAP test creates a disposable fixture inside a rolled-back transaction. It
checks valid insertion, rejected versions/variants, conflict-safe retries and
UPDATE/DELETE/TRUNCATE rejection as service_role with explicit DML privileges.
The guard does not claim to stop an owner disabling triggers or changing DDL.
No cross-request/concurrency, RLS, read-view or device-sync behavior is covered.

Run `supabase db reset --local` followed by `supabase test db --local` on a
Docker-capable local stack. CI runs the same replay and tests. Missing Docker on
the current development machine is still a local-verification limitation.
