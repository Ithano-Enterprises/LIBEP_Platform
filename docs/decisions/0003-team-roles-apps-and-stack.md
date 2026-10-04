# 0003. Team roles, apps in this repo, Expo, parallel plant slice

Status: accepted (2026-10-02). Supersedes decision 2 of ADR 0002 and
changes its consequences.

## Context

The team is five named roles (see `docs/TEAM.md`): project lead, mobile app
developer, backend developer / technical lead, plant dashboard developer,
and cloud / integration / testing developer. ADR 0002 assumed a
Lovable-generated UI in a separate repo and only the logbook being built.

## Decision

1. **The fisher app is hand-built and lives in this repo** at
   `apps/logbook/`. Lovable is not the source of the app. The separate
   Lovable repo is dropped.
2. **The fisher app is React Native with Expo.**
3. **Minimal plant receiving (M4a) is built in parallel with the logbook**
   at `apps/plant-dashboard/`: receive fish, confirm weights, issue
   receipts, view operational records. The rest of stage 4 stays later.
4. **Supabase is the backend now. AWS and a local site server come later**,
   with plant equipment integration. `infra/` is an empty slot until then.
5. **Apps are standalone projects**, each with its own `package.json` and
   lockfile. No root workspace.
6. **Reviewer routing follows roles**, one owner per area.

## Consequences

- The offline layer is part of the Expo app, not a separate package.
  `packages/offline-sync/` is removed. A service worker and IndexedDB do not
  exist in React Native; the on-device store is an open decision for the
  mobile developer. The sync contract in ADR 0001 is unchanged: client
  UUIDs, `ON CONFLICT (id) DO NOTHING`, single write path.
- No UI code is shared between the phone app and the plant website.
- Two apps now pull on a schema that does not exist yet. The schema is the
  critical path and the backend developer is the bottleneck by design.
  Pass 1 migrations must land before either app can integrate.
- App builds and distribution to fishers' phones are new work, owned by
  role 5, and are not wired into CI yet.
- The open question in ADR 0002 about how a Lovable repo consumes the
  offline package no longer applies.
