# Database acceptance tests

Add transactional pgTAP tests as `*_test.sql` files here when migrations land.
Run `supabase test db --local` after replaying migrations on the local database.
CI runs the same tests after a clean replay. With no SQL tests yet, CI explicitly
reports that database behavior is untested; a successful replay is not evidence
of correct authorization, immutability or retry behavior.

Each test should use synthetic fixtures and end with a rollback. Include tests
under application roles and the backend service role, not only the database
owner. In particular, exercise append-only triggers, unauthorized reads through
views, conflicting IDs, retries and concurrent correction behavior as the
accepted contract introduces them. Use integration tests for concurrent sessions.

Do not create tests that assert an unapproved schema proposal. No schema exists
yet, so this directory intentionally contains no pretend application tests.
