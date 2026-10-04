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
4. CI must be green and one teammate must approve.
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

## What is enforced and what is not

This repo is private on the GitHub Free plan, so GitHub **will not** enforce
branch protection. These are the substitutes:

| Rule | Mechanism | Strength |
|---|---|---|
| No direct push to `main` / `Develop` | Local `pre-push` hook | Blocks, but only if you ran `git config core.hooksPath .githooks` |
| Same | `direct-push-alert` workflow | Does not block. Opens an issue naming the commit and author |
| PR title, branch name, target branch | `pr-checks` workflow | Red check on the PR |
| Migrations valid and immutable | `db-migrations` workflow | Red check on the PR |
| App lint, typecheck, tests | `apps` workflow | Red check on the PR |
| Reviewer requested | `assign-reviewers` workflow | Requests review. Cannot require approval |

Nothing stops someone merging a red PR. Do not. If the team moves to the
Team plan or the repo goes public, replace all of this with a ruleset.

## Reviewers

Routing is in `.github/reviewers.json`: path prefix -> the role that owns it
(see `docs/TEAM.md`). The PR author is skipped; if the owner is the author,
the technical lead is requested, then the project lead. Any PR touching
`supabase/` requests the backend developer, whoever wrote it. `CODEOWNERS` is not used because GitHub ignores
it on private Free-plan repos.

## Apps

Each app under `apps/` is standalone: its own `package.json`, its own
committed `package-lock.json`, npm as the package manager. CI runs the npm
scripts named `lint`, `typecheck` and `test` if they exist. Use those names.

## Secrets

Never commit `.env`. Copy `.env.example`. The Supabase service role key never
goes into either app.
