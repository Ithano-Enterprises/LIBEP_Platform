# logbook

Fisher phone app. React Native with Expo, hand-built.

Owner: mobile app developer. Not started.

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
