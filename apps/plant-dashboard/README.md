# plant-dashboard

Website for plant staff. Owner: plant dashboard developer. Not started.

## Scope (M4a, minimal receiving, runs in parallel with M1)

- Receive fish
- Confirm weights
- Issue receipts
- View operational records

Everything else in diagram stage 4 (waste weights, automated separation,
yield) waits for the full M4.

## Rules

- Reads and writes the same Supabase schema as the logbook. Schema changes
  go through `supabase/migrations/` and are reviewed by the backend
  developer. This app does not get its own tables by a side door.
- Do not build screens around plant equipment or processes that are still
  marked `[TO CONFIRM]` in `docs/ROADMAP.md`.

## Open

- Frontend stack `[TO CONFIRM: chosen by the plant dashboard developer,
  recorded in an ADR]`
