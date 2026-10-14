# Database acceptance tests

Run `supabase test db --local` after replaying migrations on the local database.
CI runs these tests after a clean replay.

`ledger_invariants_test.sql` contains 16 pgTAP assertions covering the private
UUIDv4 domain and append-only trigger against a disposable fixture. Its explicit
service-role DML grants ensure rejection is caused by the trigger rather than
missing table privileges. Everything is rolled back at the end.

These are helper-invariant tests, not catches-schema acceptance tests. Add cases
for real authorization, correction, conversion and read-view behavior as the
accepted schema lands. Use separate sessions/integration tests for concurrency,
offline retries and interrupted network requests. A passing helper suite does
not verify an unimplemented sync endpoint or production table protection.
