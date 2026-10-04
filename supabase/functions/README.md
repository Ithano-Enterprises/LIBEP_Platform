# Edge Functions

Deno / TypeScript. One folder per function.

Planned: `sync-batch` (`POST /sync-batch`), the single write path for the
logbook. It accepts a batch of client-generated records and inserts with
`ON CONFLICT (id) DO NOTHING`, so a retried batch is harmless.

CI runs `deno fmt --check`, `deno lint` and `deno check` on every `.ts` file
here once any exist.
