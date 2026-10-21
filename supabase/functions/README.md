# Edge Functions

Deno / TypeScript. One folder per deployed function.

Planned: `sync-batch` (`POST /sync-batch`), the single write path for the logbook. It accepts
client-generated records and uses conflict-safe insertion so retries cannot create duplicate
catches. The endpoint is not implemented yet.

`_shared/uuid.ts` validates the locked UUIDv4 ID requirement without coercing or replacing input.
Authentication, authorization and deduplication are separate concerns; this helper does not
establish any of them.

From this directory run `deno task verify`, or from the repository root run
`bash scripts/ci/check-backend.sh`. CI uses the same command with Deno 2.9.6. Tests currently
require no credentials, external dependencies or permissions. See
[backend setup](../../docs/setup/backend-development.md) for database checks and verification
limitations.

`_shared/request_input.ts` adds bounded JSON reading and bearer-header syntax parsing for the future
sync transport. It does not authenticate a device or validate a catch payload. See
[transport scope](../../docs/setup/sync-transport.md) for the required integration steps and
remaining gaps.
