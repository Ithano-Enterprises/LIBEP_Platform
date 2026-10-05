# Team and ownership

Five roles. "Owns" means: is requested as reviewer on PRs touching those
paths (`.github/reviewers.json`) and is the person to ask.

| # | Role | Main responsibility | Owns in this repo | GitHub user |
|---|---|---|---|---|
| 1 | Project lead and UX designer | Decide what to build, plan the screens, assign tasks, collect feedback from fishermen and plant staff | `docs/`, roadmap, issues and milestones | Ryan Karimi `[RWKarimi]` |
| 2 | Mobile app developer | Build the fisherman's phone app: catch entry, GPS, offline saving and syncing | `apps/logbook/` | `[TO CONFIRM]` |
| 3 | Backend developer / technical lead | Build the APIs, database and business rules. Connect the apps and prevent duplicate or incorrect records | `supabase/` | `[TO CONFIRM]` |
| 4 | Plant dashboard developer | Build the website for receiving fish, confirming weights, issuing receipts and viewing operational records | `apps/plant-dashboard/` | `[TO CONFIRM]` |
| 5 | Cloud, integration and testing developer | Set up AWS and the local site server, connect equipment, manage deployments and test outages and recovery | `.github/`, `.githooks/`, `scripts/`, `infra/`, releases to hosted Supabase | `[TO CONFIRM]` |

## Rules that follow from this

- **The schema has one owner.** Both apps depend on it, so any PR touching
  `supabase/` requests the backend developer, whoever wrote it.
- **Release PRs (`Develop` -> `main`)** are opened by role 5 and approved by
  role 3.
- **Nobody approves their own PR.** The routing skips the author; if the
  owner is the author, the fallback (technical lead, then project lead) is
  requested.
