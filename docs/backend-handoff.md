# Shared backend handoff

This is the entry point for the mobile, plant and backend developers working in
this repository. Source ownership determines review responsibility; it does not
require the app owners to wait for Aaron to explain the code privately. Use the
shared repository, issues and reviewed contract for handoffs.

For a beginner-friendly inventory and failure report, read
[backend progress explained](backend-progress-explained.md).

## Availability and compatibility

The backend foundation is on `feat/reporting-conversion`, in draft
[PR #26](https://github.com/Ithano-Enterprises/LIBEP_Platform/pull/26), targeting
`Develop`. It includes the earlier implementation branches. It is available for
inspection and local experiments, but is not merged, released or a working API.
No application tables, authenticated endpoint or production read views exist.
A passing helper test is not evidence that an app can sync records.

| Available component | How to reuse it | What it does not provide |
|---|---|---|
| `supabase/functions/_shared/uuid.ts` | Backend UUIDv4 input validation | Ownership or deduplication |
| `supabase/functions/_shared/request_input.ts` | Backend bearer-header parsing and bounded JSON reading | Token verification, catch validation or persistence |
| `libep_private.client_record_id` | UUID domain for future database columns | A catch table or mandatory non-null values by itself |
| `libep_private.reject_ledger_mutation()` | Attach to future ledger tables with the documented triggers | Protection of application tables that do not yet exist |
| `libep_private.kg_from_factor()` | Internal exact arithmetic once a defensible factor is selected | Approved factors, public RPC or reporting views |
| Deno and pgTAP suites | Reproduce foundation checks and extend behavior coverage | End-to-end application acceptance |

Apps must not import Deno server modules or call private SQL helpers. The public
integration boundary will be a versioned HTTP contract and authorized read views.
There is no published client SDK or final request/response type definition yet.

The current contract candidate is [PR #18](https://github.com/Ithano-Enterprises/LIBEP_Platform/pull/18).
It is **proposed**, not accepted. Its incomplete catch example must not be copied
into an app as a valid payload. [ADR 0001](decisions/0001-logbook-data-model.md)
contains the accepted constraints; [issue #17](https://github.com/Ithano-Enterprises/LIBEP_Platform/issues/17)
tracks the remaining decisions.

## Start locally

For stable team work, start feature branches from reviewed `Develop`.
For inspecting the unmerged foundation, use a separate clone so existing app
work is preserved:

```sh
git clone --branch feat/reporting-conversion https://github.com/Ithano-Enterprises/LIBEP_Platform.git LIBEP-backend-preview
cd LIBEP-backend-preview
git config core.hooksPath .githooks
git rev-parse HEAD
bash scripts/check-backend-tools.sh
```

Record the commit hash with any test results: the preview branch can advance.
Use the pinned prerequisites and commands in
[backend development](setup/backend-development.md). Deno checks need neither
Docker nor credentials. Database replay needs a running Docker daemon. The
prerequisite checker reports missing tools rather than silently skipping them.
Each app keeps its own package.json and lockfile; there is no root npm workspace.

## What teammates can do in parallel

- **Benjamin, mobile:** build the navigation and screen shell, explore the
  on-device store decision, and design offline queue states behind a replaceable
  transport adapter. Preserve client UUIDv4 and device timestamps on retries.
  Treat form fields, authentication and acknowledgement parsing as blocked until
  the contract is accepted. Clearly label local fixtures as mock data.
- **Nate, plant:** build the dashboard shell and proposed receiving flow using
  visibly mocked data. Keep data access behind an adapter. Confirm receipt and
  weight-discrepancy requirements before binding screens to database columns.
- **Aaron, backend:** implement and test the accepted schema, authorization,
  transactional sync and scoped read views. Publish contract changes and examples
  in the same PR as implementation; app owners review compatibility.
- **Ryan, product:** resolve field and workflow decisions with the app owners.
  Record outcomes in the shared decision register, including any deliberate
  deferral. A person being listed here does not imply their agreement.

These are suggested parallel activities within the existing ownership model,
not new assignments or claims that app work has already begun.

## Unblock the first usable integration

| Decision or gap | Needed input / next action | Acceptance evidence |
|---|---|---|
| Mandatory effort | Ryan and Benjamin identify the actual measurements, units, required fields and zero-catch behavior | Accepted typed field dictionary and valid/invalid examples |
| Device/fisher access | Agree whether devices serve one or many fishers, enrollment, revocation and recovery; Aaron proposes enforcement | Access matrix and tests proving one device cannot read/write outside its scope |
| Corrections | Agree actors, approval, correctable fields and stale-correction handling | Accepted correction flow plus concurrent/retry tests |
| Sync contract | Aaron and Benjamin finalize atomicity, errors, limits and durable acknowledgements | Versioned request/response schema, fixtures and retry tests |
| Reporting | Confirm real species/unit sources and factor provenance; preserve unknown conversions | Scoped view definitions and tests for unknown/partial totals |
| Plant receiving | Ryan and Nate specify receipt contents, splitting and discrepancies | Agreed receiving contract before backend tables or client bindings |
| Local verification | Provide pinned Deno/Supabase via PATH or executable overrides and install/start Docker | Prerequisite check, local reset and pgTAP all pass |

Once the minimum catch/access contract is accepted, build one complete slice:
**save offline -> authenticate device -> POST /sync-batch -> commit once ->
read the authorized record**. Verify retries after a lost response, invalid
mandatory fields, revoked devices, cross-fisher access and preserved raw data.
Then extend corrections/reporting and plant receiving. This is the next useful
integration milestone; adding more isolated helpers does not complete it.

Before calling the backend ready for app use, publish:

- accepted contract version, machine-readable schema/types and valid fixtures;
- local endpoint setup, device test-account setup and environment-variable names;
- documented errors, retry/acknowledgement rules and a runnable integration test;
- read-view fields and access policy for each app;
- tested compatibility notes and rollout steps for future contract changes.

No hosted URL or credentials are supplied yet because no endpoint is deployed.
Service-role credentials stay server-side. Do not let a temporary app workaround
write directly to base tables; ADR 0001 requires the single sync write path.

## Review and integrate shared work

Review order for the existing implementation stack:
[PR #20](https://github.com/Ithano-Enterprises/LIBEP_Platform/pull/20) ->
[PR #22](https://github.com/Ithano-Enterprises/LIBEP_Platform/pull/22) ->
[PR #24](https://github.com/Ithano-Enterprises/LIBEP_Platform/pull/24) ->
[PR #26](https://github.com/Ithano-Enterprises/LIBEP_Platform/pull/26).
PR #18 is a separate contract proposal; publishing it does not accept its choices.

These PRs currently all target `Develop`. They include predecessor commits, so
later diffs are cumulative. After each squash merge, the backend owner must
refresh the next branch against `Develop`, inspect its diff, resolve conflicts
and rerun checks before asking for review. Do not blindly merge all cumulative
PRs or cherry-pick the same migrations into both apps.

For a dependent experiment, branch from a recorded preview commit and state
that dependency in its PR. After the foundation is reviewed and integrated,
move the dependent work onto current `Develop` without discarding others' work.
Prefer this short-lived arrangement only when the work cannot wait for review.

Draft PRs do not trigger this repository's automatic reviewer requests. When
checks and the local verification checklist are satisfied, mark the relevant PR
ready for review so the routing can run; another teammate must approve. Keep
unmet checks explicit rather than marking all drafts ready prematurely.

Changes to accepted fields or API behavior need a compatibility review with
both app owners. Preserve deployed migrations and add new migrations for fixes.
See [contribution rules](../CONTRIBUTING.md) and
[per-phase incomplete work](phase-status.md). This handoff changes no repository
permissions, licensing, branch protection or deployment configuration.
