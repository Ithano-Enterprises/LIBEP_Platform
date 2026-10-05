# Contributing

## Branches

| Branch | Role | Who merges into it |
|---|---|---|
| `main` | Production. What the hosted Supabase project runs | Only `Develop` (release PR) or `hotfix/*` |
| `Develop` | Integration. Default branch, PRs target it | Feature branches, via PR |
| `feat/*` `fix/*` `chore/*` `docs/*` `refactor/*` `test/*` `ci/*` `research/*` | Your work | You |
| `hotfix/*` | Urgent production fix, branched from `main` | PR to `main`, then merge `main` back into `Develop` |

`Develop` has a capital D. Branch names are lowercase after the prefix:
`feat/sync-batch-validation`.

## The loop

1. `git switch Develop && git pull`
2. `git switch -c feat/short-description`
3. Commit small. Push. Open a PR into `Develop`.
4. CI must be green. Once a second person has access, one teammate must
   also approve.
5. **Squash merge** into `Develop`. Delete the branch.
6. Releases: open a PR `Develop` -> `main` and use a **merge commit**, not
   squash. Squashing a release makes `main` and `Develop` diverge and every
   later release PR shows phantom conflicts.

## PR titles

PR titles follow Conventional Commits, because the squash commit takes the PR
title and that becomes the history:

```
feat(schema): add catches ledger and corrections table
fix(sync): reject batches with missing effort fields
docs: add offline queue ADR
```

Types: `feat fix chore docs refactor test ci build perf revert`.
CI rejects anything else.

## Migrations

- One concern per file, named `YYYYMMDDHHMMSS_snake_case.sql`
  (`supabase migration new <name>` does this for you).
- **A merged migration is never edited.** Fix it with a new migration. CI
  fails any PR that modifies or deletes a migration already on the base branch.
- `supabase db reset` must pass locally before you push. CI runs it again.
- `supabase db push` to the hosted project happens only from `main`, only
  after the release PR merges.
- Never run `supabase db reset --linked`. It wipes the hosted database.

## What is enforced

The repo is public, so GitHub enforces branch rulesets on `main` and
`Develop`. They are created by `scripts/setup-rulesets.ps1`.

| Rule | Enforced by | Strength |
|---|---|---|
| No direct push to `main` / `Develop` | Ruleset | Blocked by GitHub |
| No force push, no branch deletion | Ruleset | Blocked by GitHub |
| PR title, branch name, target branch | Ruleset + `pr-checks` workflow | Merge is locked until it passes |
| Squash only into `Develop`, merge commit only into `main` | Ruleset | Other merge buttons are disabled |
| Approvals before merge | Ruleset | Currently 0, see below |
| Migrations valid and immutable | `db-migrations` workflow | Red check. Does **not** lock the merge |
| App lint, typecheck, tests | `apps` workflow | Red check. Does **not** lock the merge |
| Reviewer requested | `assign-reviewers` workflow | Requests review |

Two gaps, both deliberate:

- **Approvals are 0** while one person has access, because GitHub does not
  let you approve your own PR. When a second person is added, run
  `.\scripts\setup-rulesets.ps1 -Approvals 1`.
- **Database and Apps checks cannot lock a merge.** They only run when
  `supabase/` or `apps/` change, and a required check that never starts
  would block every other PR forever. Do not merge on red. This gets closed
  when there is real schema and app code to protect (see ADR 0004).

The local `pre-push` hook and the `direct-push-alert` workflow are kept as
a second layer: the hook gives a clearer message than GitHub's rejection,
and the alert fires if a ruleset is ever switched off.

Because `Develop` is squash-only, a back-merge of `main` into `Develop`
after a hotfix is squashed too. That is fine; the content ends up identical.

## Reviewers

Routing is in `.github/reviewers.json`: path prefix -> the role that owns it
(see `docs/TEAM.md`). The PR author is skipped; if the owner is the author,
the technical lead is requested, then the project lead. Any PR touching
`supabase/` requests the backend developer, whoever wrote it. `CODEOWNERS`
is not used yet; the workflow predates the repo going public and still
does the job.

## Apps

Each app under `apps/` is standalone: its own `package.json`, its own
committed `package-lock.json`, npm as the package manager. CI runs the npm
scripts named `lint`, `typecheck` and `test` if they exist. Use those names.

## Secrets

Never commit `.env`. Copy `.env.example`. The Supabase service role key never
goes into either app.
