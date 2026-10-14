# Backend progress explained

Verified 2026-10-09. Audience: the project owner and teammates new to this backend.

## What the backend is for

The mobile app is where a fisher records a catch. The plant dashboard is where
staff will receive fish and view records. The backend will be their shared place
to validate, store and retrieve that information, including who is allowed to
access it. Both apps should use the same rules rather than maintain competing
versions of the catch data.

**We have built and tested foundation components. We have not yet built the
working catch-storage and sync service.** No application schema, authenticated
sync endpoint or production reporting views have been deployed. The work is
pushed for review, not merged into the team's integration branch.

## What has been done and how it helps

| Work completed | Beginner explanation | Benefit to the other developers | Current limit |
|---|---|---|---|
| Draft data contract in PR #18 | A proposed agreement about the information the apps send and receive | Gives mobile and dashboard developers one design to review together | Required fields and several workflows still need agreement; examples are not final API payloads |
| Automated verification | GitHub runs checks whenever a PR changes | Teammates can see whether shared code still passes its checks | Tests cover helpers, not a complete app journey |
| UUIDv4 validation | Checks the format of IDs generated on a phone | Supports the agreed approach of keeping the same ID when sending a record again | Does not itself prevent duplicates or prove ownership |
| Database ID domain | A reusable database rule for valid IDs | Future tables can enforce the same rule as the API | Application tables still need to be created and use it |
| Append-only guard | A database function that rejects changes/deletions when correctly attached to a table | Helps keep the original catch record available for audit | Tested on a temporary test table; no real catch table is protected yet |
| Request-input helpers | Read JSON safely, limit its size, and extract the bearer credential from a header | Provides common input handling for the future sync endpoint | Extracting a credential does not verify it; there is no login or authorization implementation here |
| Exact conversion arithmetic | Multiplies measured quantity by a supplied kg factor using exact decimal arithmetic | Gives future reports a reusable calculation without unwanted rounding | Does not select real conversion factors or provide a reporting view; unknown inputs remain unknown |
| Shared handoff and corrected setup docs | Explain where the code is, how to test it and what is unfinished | Teammates can inspect and extend the work without a private walkthrough | They cannot connect an app to an API that has not been implemented |
| Portable tool locations | Scripts accept the executable paths on each developer's machine | Developers can run checks even when tools are downloaded outside their normal PATH | Tools must still exist; this does not install or start Docker |

A migration is a versioned SQL file that builds or changes the database.
An endpoint is a URL the apps call. A view is a controlled way to read database
records. CI means the automated checks that run on GitHub.

## What failed, what was fixed, and what remains

| Observed problem | Cause | Action taken | Result |
|---|---|---|---|
| Local checker reported Deno missing | Downloaded executable was outside PATH | Added `DENO_BIN` support to the test runner and prerequisite checker; resolve its location before changing directory | Formatting, lint, type checking and all 22 Deno tests pass locally |
| Local checker reported Supabase missing | Downloaded executable was outside PATH | Added `SUPABASE_BIN` support to the prerequisite checker | CLI 2.116.0 can be checked without changing machine-wide PATH |
| Supabase failed even on `--version` | Sandbox blocked its local CLI settings/telemetry file under `~/.supabase` | Requested and received filesystem access to that directory, then reran the version check | Version command succeeds; no hosted database command was run |
| Local database replay cannot run | No usable Docker installation/daemon is available here | Kept the check failing with a clear installation/startup instruction; retained CI database verification | Still incomplete locally. Install/start Docker, then run local reset and SQL tests |
| README said no backend code existed | Documentation lagged behind the foundation commits | Updated README, setup/status documents and the shared handoff | Current branch now describes helpers and missing application features accurately |
| Automatic reviewer requests were skipped | The PR workflow deliberately skips draft PRs | Documented the ready-for-review and teammate-approval process | Expected behavior, not a failing test; review is still outstanding |

At inspection, all checks on published handoff commit `c5c8f63` passed, including
[database replay and backend tests](https://github.com/Ithano-Enterprises/LIBEP_Platform/actions/runs/37798056926).
The SQL suite contains 33 assertions; the Deno suite contains 22 tests. Those
results do not prove authentication, real catch persistence or application sync.
The tooling change in this report must also pass its new PR checks before merge.

The full local prerequisite check is still supposed to return a failure while
Docker is missing. Suppressing that failure would conceal an unmet requirement.
The new `DOCKER_BIN` override supports an existing Docker executable outside PATH;
it cannot supply an absent Docker installation.

## How the other developers can build on this

The source is available in the shared repository on `feat/reporting-conversion`,
through [PR #26](https://github.com/Ithano-Enterprises/LIBEP_Platform/pull/26).
See [the handoff](backend-handoff.md) for preview checkout and test instructions.
No change to repository licensing or collaborator permissions is implied.

1. Mobile and dashboard developers can inspect the foundations and review the
   proposed contract now. They can develop screen shells with clearly marked
   mock data and keep API calls in a replaceable data-access module.
2. Agree a versioned data contract before connecting real forms and reports to
   database fields. That contract must include valid examples, error responses,
   permissions and retry behavior.
3. Keep backend SQL and server helpers in `supabase/`. Apps will call the shared
   API and authorized read views; they should not copy server code into each app,
   call private SQL helpers or carry a service-role secret.
4. After teammate review, integrate the foundation PRs in order: #20, #22, #24,
   then #26. Refresh the later branches after each squash merge and rerun checks.
   `Develop` becomes the shared base once reviewed changes land there.
5. Build and verify one full journey together before calling the backend usable:
   save a catch offline, authenticate the device, send the batch, store it once,
   acknowledge it, and read it back only to an authorized caller.

## What is still needed, by phase

| Phase | Incomplete work |
|---|---|
| 1 — data agreement | Mandatory effort fields/units; device-to-fisher access; correction rules; reference data; receiving requirements; accepted contract |
| 2 — development setup | Docker/local database replay, teammate review and adoption of required CI checks |
| 3 — database | Actual catch/identity/reference/correction tables, attached guards and access policies |
| 4 — synchronization | Verified device identity, authorization, record validation, atomic persistence, durable acknowledgements and retry/concurrency behavior |
| 5 — corrections/reporting | Approved correction workflow, effective records, supported factors, scoped views, species reconciliation and partial-total reporting |
| Integration/release | Both apps connected to the real service, outage/recovery tests, reviewed deployment configuration and release |

The first product decisions to settle are: what fishing effort must be recorded,
whether one device may serve several fishers, and who can correct a saved catch
with what approval. These are missing requirements, not software tests that
failed. Record the answers in [issue #17](https://github.com/Ithano-Enterprises/LIBEP_Platform/issues/17)
and the contract proposal before turning them into enforced database rules.
