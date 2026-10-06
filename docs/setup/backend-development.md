# Backend development and verification

This setup is local. Do not link a hosted project to run these checks. The first
backend code implements only the UUIDv4 validation invariant from ADR 0001; it
is not a deployed sync endpoint or an accepted schema contract.

## Prerequisites

- Git and Bash (Git Bash on Windows).
- Deno 2.9.6, matching CI.
- Supabase CLI 2.116.0, matching CI.
- A working Docker installation and daemon for database checks.

Run the read-only prerequisite check from the repository root:

```sh
bash scripts/check-backend-tools.sh
```

It reports missing commands and an unavailable Docker daemon, exits nonzero
when prerequisites are missing, and does not print keys or start/reset anything.
The tools must be available on PATH. A locally installed Deno executable also
works; Node/npm are not required by the committed backend test harness.

## Fast checks (no Docker or credentials)

```sh
bash scripts/ci/check-backend.sh
```

This formats/checks source, lints, typechecks all TypeScript files (including
helpers and tests), and runs Deno unit tests. Tests receive no environment,
network, file or subprocess permissions by default. Add narrow permissions
only to a separately identified integration test command when needed.

The first six unit tests cover the UUIDv4 syntax constraint, including wrong
versions, variant bits, malformed strings, non-string values and generated IDs.
They do not establish database uniqueness, record ownership or sync behavior.

## Database checks (Docker required)

Run from the repository root, using only the local stack:

```sh
supabase db start
supabase db reset --local
supabase test db --local
```

The reset erases the local development database and replays migrations. Preserve
any local data you need first. Never add --linked or a hosted database URL.

Add transactional pgTAP cases in supabase/tests as migrations are introduced.
There are currently no SQL acceptance cases. CI reports this explicitly instead
of presenting the empty suite as application verification. The broader local
stack needed for future endpoint integration can be started with supabase start;
that step is not needed for the credential-free unit tests.

## CI and remaining setup

The Database workflow runs on every PR so its job names are stable candidates
for required checks. It pins both runtimes, replays the database and runs any SQL
acceptance tests, then independently runs Deno checks and unit tests. Branch
rulesets are not changed by this PR. Requiring the new check names is a separate
administrative step after these jobs pass and this workflow is adopted.

No root npm workspace or package.json is introduced. App projects keep their
own tooling. These checks can run while Phase 1 remains under review, because
they do not invent catch fields, effort measurements or receipt requirements.
