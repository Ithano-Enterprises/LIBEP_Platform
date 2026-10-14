# logbook

Fisher phone app. React Native with Expo, hand-built.

Owner: mobile app developer. Expo SDK 57 + TypeScript. In progress.

## Scope (M1)

- Catch entry at landing
- GPS capture `[TO CONFIRM: required accuracy, and behaviour when no fix]`
- Offline saving: every record is written to on-device storage first
- Sync: outbound queue posts batches to `POST /sync-batch` and retries blindly

## Constraints that come from ADR 0001

- Primary keys are UUIDv4 generated on the device.
- Store `recorded_at` and `device_clock_skew_ms` as measured. Never correct.
- Records are never edited or deleted on the device after save. A correction
  is a new record.
- Quantity is entered in the unit the fisher measured in. No conversion here.
- Species is the local name. Unmatched names are sent as free text.
- Effort fields are mandatory in the form.

## Open, to be settled in an ADR before code

- On-device store `[TO CONFIRM: expo-sqlite or other]`
- How app builds are produced and distributed to fishers
  `[TO CONFIRM: EAS build, Play Store or direct APK]`

## Run locally

Node 22 (see `.nvmrc`), npm only.

```bash
cd apps/logbook
npm ci
npx expo start        # scan the QR code with Expo Go on the phone
```

Checks (the same ones CI runs):

```bash
npm run lint
npm run typecheck
npm test
```

## Layout

- `src/theme/tokens.ts`: Night/Day colour tokens from the design. Night is the default
- `src/i18n/strings.ts`: Kiswahili (default) and English UI strings. Fish names are never translated
- `src/ui/`: shared UI pieces and the preferences context (mode, language)
- `src/data/`: the only data access layer. Local SQLite schema (append-only
  triggers), repository functions, and the provider screens read through
- `src/dev/fixtures/`: DEV FIXTURE placeholder data, seeded in development
  builds only. Not real data. Start with `EXPO_PUBLIC_DEV_SEED=no-open-trip`
  (after clearing app data) to seed without an open trip, so S1 can be tried
- `src/screens/`: screens (S1 Start trip, S2.1 Trip home)
