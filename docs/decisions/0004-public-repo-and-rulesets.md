# 0004. Public repo, enforced branch rulesets

Status: accepted (2026-10-05). Supersedes decisions 4 and 5 of
[ADR 0002](0002-repo-and-source-control.md) as the primary control.

## Context

ADR 0002 assumed a private repo on the GitHub Free plan, where branch
protection is not enforced, and built detective substitutes: a pre-push
hook, a direct-push alert and a reviewer workflow. The repo was made public
on 2026-10-05. GitHub enforces rulesets on public repos at no cost.

## Decision

1. **The repo is public.**
2. **Rulesets on `main` and `Develop`**, created by
   `scripts/setup-rulesets.ps1`: no deletion, no force push, changes only
   through a pull request, the `Title, branch name, target branch` check
   must pass. `Develop` accepts squash merges only, `main` merge commits only.
3. **Required approvals are 0 until a second person has access**, then 1.
   GitHub does not allow approving your own pull request, so 1 would block
   the only contributor.
4. **Only the always-running check is required.** The Database and Apps
   checks are path-filtered and stay advisory.
5. **No bypass list.** The rules apply to admins too.
6. **The hook, the alert workflow and the reviewer workflow stay** as a
   second layer.

## Consequences

- Schema decisions, roadmap, team roles and stakeholder names are readable
  by anyone. Nothing confidential may be committed, including in docs.
- Anyone can open issues and pull requests from forks. They cannot push or
  merge.
- There is no licence file, so the code is visible but not licensed for
  reuse. `[TO CONFIRM: whether to add a licence]`
- A pull request with a failing Database or Apps check can still be merged.
  To close this, change those workflows to run on every pull request and
  report success when their paths are untouched, then add them to the
  required checks in the script. Do this when real schema or app code exists.
- If the repo is made private again on the Free plan, the rulesets stop
  being enforced silently. The alert workflow is the tripwire for that.
