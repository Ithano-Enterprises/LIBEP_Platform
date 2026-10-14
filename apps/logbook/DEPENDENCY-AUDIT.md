# Dependency audit: logbook app

Triage of `npm audit` for `apps/logbook`, done for the PR #29 review on
2026-10-14 (Expo SDK 57, react-native 0.86.3, Node 20.20 / npm 10.8).

## Counts

| Command | Moderate | High | Critical | Total |
|---|---|---|---|---|
| `npm audit --json` | 12 | 46 | 0 | 58 |
| `npm audit --omit=dev --json` | 12 | 23 | 0 | 35 |

These numbers count packages in the dependency graph, not separate flaws.
Every entry traces back to **four advisories** in four leaf packages. The
other entries, including `expo`, `react-native`, `jest`, `jest-expo`,
`metro` and `@expo/cli`, are flagged only because they depend on one of
those four.

The `--omit=dev` graph still contains Jest and Metro packages. That is
because `react-native` declares `@react-native/jest-preset` as an optional
peer, and Metro comes in through `@react-native/community-cli-plugin`. So
"not a devDependency" does not mean "ships in the app". The bundle check
below answers that question.

## Advisories

| Package | Advisory | Dependency path (`npm ls` / `npm explain`) | Ships in app bundle? | Fix / decision |
|---|---|---|---|---|
| node-forge 1.4.0 | [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv), high: RSA PKCS#1 v1.5 signature check accepts extra nested DigestAlgorithm elements (`<=1.4.0`) | expo › @expo/cli › node-forge; expo › @expo/cli › @expo/code-signing-certificates › node-forge | **No.** Expo CLI (Node) tooling only | **Deferred.** No patched release exists (1.4.0 is the latest). Take the fix when an Expo SDK 57 patch of `@expo/cli` picks one up. |
| uuid 7.0.3 | [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq), moderate: missing buffer bounds check in v3/v5/v6 when `buf` is passed (`<11.1.1`) | expo › @expo/config-plugins › xcode@3.0.1 › uuid | **No.** iOS prebuild tooling only | **Deferred.** The fix needs uuid ≥ 11.1.1, a major bump outside `xcode`'s `^7` range. Forcing it with `overrides` could break prebuild, so no override. |
| braces 3.0.3 | [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), high: stack-exhaustion DoS through deeply nested patterns (`<=3.0.3`) | micromatch@4.0.8 › braces, reached from jest › @jest/core, @jest/transform, jest-haste-map and metro › metro-file-map | **No.** Test runner and Metro bundler tooling, fed only our own glob patterns | **Deferred.** No patched release exists (3.0.3 is the latest). |
| sprintf-js 1.0.3 | [GHSA-hp3w-g68c-fv3c](https://github.com/advisories/GHSA-hp3w-g68c-fv3c), moderate: DoS through unbounded precision specifiers (`<=1.1.3`) | jest-expo › babel-jest › babel-plugin-istanbul › @istanbuljs/load-nyc-config › js-yaml@3 › argparse@1 › sprintf-js (also via @react-native/jest-preset) | **No.** Test coverage tooling only | **Deferred.** Every published version is in the affected range (latest is 1.1.3). |

## Evidence

- **Bundle contents.** `npx expo export --platform android --source-maps`,
  then the source map was read. 32 packages ship. None of node-forge, uuid,
  xcode, braces, micromatch, sprintf-js, argparse, js-yaml, metro or jest is
  among them. The only `@expo/cli` file in the bundle is Metro's module
  loader (`build/metro-require/require.js`), which does not use node-forge.
- **Expo compatibility.** `npx expo install --check` reports "Dependencies
  are up to date", so there is no SDK 57 patch or minor update to apply.
- **Rejected fixes.** `npm audit fix --force` proposes expo 44,
  react-native 0.84, jest 30, jest-expo 58 and @types/jest 30. These are
  major downgrades or framework upgrades outside SDK 57, so none were
  applied.

## Follow-up

Re-run this triage on each Expo SDK 57 patch release and before any
release build. Take an update as soon as `npx expo install --check`
offers a patched node-forge, braces or sprintf-js.
