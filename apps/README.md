# apps

One folder per application. Each app is **standalone**: its own
`package.json` and its own lockfile, no root workspace. Reason: Expo's
bundler (Metro) needs extra configuration to work inside a monorepo
workspace, and the two apps share no UI code, so a workspace would add
failure modes and buy nothing. Revisit if a shared package appears.

| Folder | App | Owner (see `docs/TEAM.md`) | Milestone |
|---|---|---|---|
| `logbook/` | Fisher phone app, React Native (Expo) | Mobile app developer | M1 |
| `plant-dashboard/` | Plant receiving website | Plant dashboard developer | M4a |

CI (`.github/workflows/apps.yml`) starts running for an app as soon as its
folder contains a `package.json` and `package-lock.json`. It runs
`npm ci`, then the `lint`, `typecheck` and `test` scripts if they exist.
Name your scripts exactly that.
