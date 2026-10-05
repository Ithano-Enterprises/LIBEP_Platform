# 0002. Repo layout and source control

Status: accepted (2026-10-02). Decision 2 superseded by [ADR 0003](0003-team-roles-apps-and-stack.md), decisions 4 and 5 by [ADR 0004](0004-public-repo-and-rulesets.md)

## Context

Five people, one platform with six planned stages, only the fisher logbook
being built now. The UI is generated in Lovable, which needs to own a repo
root and pushes straight to its default branch. The GitHub organization is on
the Free plan and the repo is private, so branch protection, required
reviews, required status checks and CODEOWNERS are not enforced by GitHub.

## Decision

1. **Platform monorepo.** All stages share this repo, one schema, one species
   list. Later stages are roadmap milestones until they start.
2. **Lovable UI in a separate repo.** This repo holds schema, Edge Functions
   and the hand-built offline layer, all behind PRs.
3. **`main` + `Develop`.** `main` is production, `Develop` is integration and
   the default branch. Squash merge into `Develop`, merge commit into `main`.
4. **Compensating controls instead of branch protection**: a local pre-push
   hook, PR check workflows, and a workflow that opens an issue on any direct
   push to `main` or `Develop`.
5. **Reviewer routing by workflow**, configured in `.github/reviewers.json`.

## Consequences

- Protection is detective, not preventive. A determined or careless push to
  `main` still lands; it is just visible within a minute.
- Two repos must stay in step. How the Lovable repo consumes
  `packages/offline-sync` is an open decision (needs its own ADR).
- If the org moves to the Team plan or the repo goes public, replace items 4
  and 5 with a ruleset and CODEOWNERS and delete the workarounds.
