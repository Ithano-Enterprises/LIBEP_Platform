# Lamu Integrated Blue Economy Platform (LIBEP)

## Project description

The Lamu Integrated Blue Economy Platform (LIBEP) is a data platform for the
Lamu fishery. It follows fish from the moment they are landed to the moment
they reach a customer, and keeps one trusted record of what happened at each
step.

**This repository contains the entire LIBEP platform.** Every product that
makes up the platform is built here, starting with the fisher mobile app.

Today a trusted record does not exist at the source. Lamu's artisanal fishers
land their catch late at night or early in the morning, and the figures are
reconstructed the next morning by traders. Whatever is written down is
second-hand, hours late, and not owned by the person who caught the fish.

The first product is a **phone app for fishers** to record their own catch
at landing, on their own phone, with or without signal. Its data feeds the
virtual Mokowe platform, which feeds the wider LIBEP platform. The rest of
the platform is built in later stages, see
[docs/ROADMAP.md](docs/ROADMAP.md).

**Who it is for**

| Group | What they get |
|---|---|
| Fishers | Their own record of what they landed |
| LAMCOT, Lamu County Department of Fisheries, Beach Management Units | Catch data recorded at the source instead of reconstructed afterwards |

**Built by** Ithano Enterprises, a team of five: project lead and UX
designer, mobile app developer, backend developer and technical lead, plant
dashboard developer, and cloud, integration and testing developer. See
[docs/TEAM.md](docs/TEAM.md).

## How the data flows

The products are connected by data links, not nested inside one another.
The fisher app is not a feature of a larger product: it is a product in its
own right that passes its data on to the next one. All of them up to LIBEP
live in this repository.

```
Fisher mobile app  ->  Virtual Mokowe platform  ->  LIBEP  ->  Aurora Africa Ventures platform
```

| Product | Receives data from | Sends data to | Status |
|---|---|---|---|
| Fisher mobile app | Fishers, at landing | Virtual Mokowe platform | Current goal |
| Virtual Mokowe platform `[TO CONFIRM: one-line definition]` | Fisher mobile app | LIBEP | `[TO CONFIRM]` |
| LIBEP | Virtual Mokowe platform | Aurora Africa Ventures platform | Later, scope not yet discussed |
| Aurora Africa Ventures platform | LIBEP | | Later |

Each arrow is a data link. A product can be built, run and changed on its
own as long as the data it passes on keeps the agreed shape.

## Objectives

### Current goal

**A working mobile app for the fishermen.**

1. **Record catch at the source.** Fishers record their own catch at
   landing, replacing next-morning reconstruction by traders.
2. **Work without signal.** Every record is saved on the phone first and
   synced when a connection exists. A record is never lost or duplicated
   because the network dropped.
3. **Keep records that can be trusted.** Nothing is edited or deleted.
   Corrections are added as new entries, so the original and every change
   stay visible.
4. **Record what was actually measured.** Quantities are stored in the unit
   the fisher used and species under the local name, with conversion and
   matching done afterwards rather than forced at entry.
5. **Capture effort, not only catch.** Effort is mandatory on every record,
   so catch can be read against the work it took.

### Long-term objective

Build the larger LIBEP platform. Its scope and objectives will be discussed
and recorded at a later date.

### How success is measured

The app is working when fishermen can use it and it feeds their data
**accurately** and **efficiently** to the virtual Mokowe platform, which
links to LIBEP, which links to the Aurora Africa Ventures platform.

- Accurately: what reaches the platform is what the fisher recorded, with
  nothing lost, duplicated or altered on the way.
- Efficiently: `[TO CONFIRM: what efficient means here, for example time to
  record one catch, or delay between recording and data arriving]`

## Status

Pre-code. The repository structure, contribution rules and PR automations
are in place. No schema, app or dashboard code has been written yet.

## What lives where

| Path | Contents | Owner role | Status |
|---|---|---|---|
| `supabase/migrations/` | Postgres schema, one concern per migration | Backend / tech lead | empty, pass 1 next |
| `supabase/functions/` | Edge Functions (Deno/TypeScript). `sync-batch` is the single write path | Backend / tech lead | not started |
| `apps/logbook/` | Fisher phone app, React Native (Expo), offline-first | Mobile app developer | not started |
| `apps/plant-dashboard/` | Plant receiving website (minimal slice) | Plant dashboard developer | not started |
| `infra/` | AWS and local site server, later | Cloud / integration / testing | empty by decision |
| `docs/` | Roadmap, team, decision records, setup | Project lead | active |
| `.github/`, `scripts/` | PR template, issue forms, CI and PR automations | Cloud / integration / testing | active |

Who owns what: [docs/TEAM.md](docs/TEAM.md). Why it is laid out this way:
[ADR 0002](docs/decisions/0002-repo-and-source-control.md) and
[ADR 0003](docs/decisions/0003-team-roles-apps-and-stack.md).

## Quick start

```powershell
git clone https://github.com/Ithano-Enterprises/LIEBP_Platform.git
cd LIEBP_Platform
git config core.hooksPath .githooks   # one time, blocks direct pushes to main/Develop
git switch Develop
git switch -c feat/your-change
```

Database setup: [docs/setup/supabase-local.md](docs/setup/supabase-local.md).
