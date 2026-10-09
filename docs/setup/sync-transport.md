# Phase 4: sync transport groundwork

`supabase/functions/_shared/request_input.ts` provides transport-only helpers for
future use by the single `sync-batch` write path. There is no deployed endpoint
or database mutation in this change.

## Input helpers

- `readBearerToken(headers)` extracts one syntactically valid opaque bearer
  credential. It does not verify signatures, expiry, device identity or scope.
- `readBoundedJson(request, maxBytes)` requires application/json, reads the body
  with an explicit positive byte budget, and returns `unknown`. It rejects
  declared or actual excess, malformed content lengths, invalid UTF-8 and JSON.
  Streamed bytes are authoritative even if Content-Length understates the size.
- `RequestInputError` carries a status and stable code without copying request
  content, credentials or internal exception messages into the error.

No product body limit is hardcoded. The eventual endpoint must choose and
configure the accepted limit. Call these helpers once on an unconsumed request.
Errors still need mapping to the accepted HTTP response contract.

## Required integration order

The eventual endpoint should enforce its method/origin policy, extract and
verify credentials, validate current device access, read a bounded body, validate
it against the accepted record contract, and authorize every referenced resource
before invoking a single transactional database operation. A success response
must acknowledge only durably committed records. These helpers implement none
of those domain or persistence decisions and must not be mistaken for a complete
sync implementation.

## Verification and incomplete work

Sixteen transport tests cover credential syntax, media type, declared/actual byte
limits, UTF-8 chunk boundaries, malformed/empty input, stream failures and reader
cancellation/release. Together with the UUID tests, 22 Deno tests pass locally.
Run `deno task verify` from supabase/functions.

Incomplete: actual token verification and device enrollment/revocation; accepted
catch/effort schema; per-record permissions; request/response contract; transactional
inserts and duplicate-content decisions; durable acknowledgements; rate limits;
request cancellation/timeouts; browser-origin policy; application integration;
and a real Supabase endpoint test. Those remain prerequisites for deploying
POST /sync-batch. Byte limits alone are not a request timeout or rate limiter.
