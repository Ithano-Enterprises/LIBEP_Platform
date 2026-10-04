# Instructions for AI coding agents

Read `docs/decisions/` before changing schema or sync code. Those decisions
are locked. Do not reopen them in a PR; raise an issue instead.

## Hard rules

- Never invent figures, dates, species, metrics, or stakeholder claims. Mark
  gaps as `[TO CONFIRM: ...]`.
- Never edit a migration that exists on `Develop` or `main`. Add a new one.
- No column renames from the schema spec.
- All writes go through the `sync-batch` Edge Function. No other write path.
- Never run `supabase db reset --linked` or `supabase db push` on a user's
  behalf without them asking for that exact command.
- Never commit to `main` or `Develop`. Work on a `feat/` `fix/` etc. branch
  and open a PR into `Develop` with a Conventional Commit title.

## Layout

- `supabase/`: schema and Edge Functions. Owner: backend / tech lead.
- `apps/logbook/`: React Native (Expo) fisher app. Offline store and sync
  queue live inside this app.
- `apps/plant-dashboard/`: plant receiving website, minimal slice only.
- `infra/`: empty by decision. Do not add AWS resources.
- Apps are standalone npm projects. Do not add a root workspace.

## Locked data-model decisions (summary of ADR 0001)

- Device-level auth. Fisher identity is data, not `auth.uid()`.
- Offline-first. Client-generated UUIDv4 primary keys, inserts use
  `ON CONFLICT (id) DO NOTHING`.
- Store `recorded_at`, `created_at`, `device_clock_skew_ms`. Never correct skew.
- Append-only ledger. Corrections go in a corrections table and are read via
  `v_catches_effective`. Enforced by triggers, not RLS, because Edge Functions
  use the service role key and that bypasses RLS.
- Quantity stored in the unit measured. Conversion in `v_catch_kg`.
- Species stored as local name. Unmatched species go to `species_freetext`
  and surface in `v_reconciliation_queue`.
- Effort fields are mandatory.
