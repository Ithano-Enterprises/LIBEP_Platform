/** Transport-only input checks. No token verification, domain validation or writes. */
export class RequestInputError extends Error {
  constructor(
    readonly status: 400 | 401 | 413 | 415,
    readonly code:
      | "BEARER_REQUIRED"
      | "JSON_REQUIRED"
      | "INVALID_CONTENT_LENGTH"
      | "BODY_TOO_LARGE"
      | "BODY_UNREADABLE"
      | "INVALID_JSON",
  ) {
    super(code);
    this.name = "RequestInputError";
  }
}

/** Returns an opaque credential for verification by the authentication adapter. */
export function readBearerToken(headers: Headers): string {
  const value = headers.get("authorization");
  // One RFC 6750 b64token credential; never decode a JWT and treat it as verified.
  const match = value?.match(/^Bearer +([A-Za-z0-9._~+/-]+=*)$/i);
  if (!match) throw new RequestInputError(401, "BEARER_REQUIRED");
  return match[1];
}

/**
 * Require JSON, enforce an explicit byte budget while streaming, then parse.
 * The caller must validate the returned unknown value against an accepted contract.
 * maxBytes is configuration, not an invented LIBEP product limit.
 */
export async function readBoundedJson(request: Request, maxBytes: number): Promise<unknown> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
    throw new RangeError("maxBytes must be a positive safe integer");
  }

  const reader = request.body?.getReader();
  let completed = false;
  try {
    const mediaType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
    if (mediaType !== "application/json") throw new RequestInputError(415, "JSON_REQUIRED");

    const length = request.headers.get("content-length");
    if (length !== null) {
      if (!/^\d+$/.test(length)) throw new RequestInputError(400, "INVALID_CONTENT_LENGTH");
      // Compare as bigint to avoid unsafe-number overflow for hostile headers.
      if (BigInt(length) > BigInt(maxBytes)) throw new RequestInputError(413, "BODY_TOO_LARGE");
    }

    let bytes = 0;
    let text = "";
    const decoder = new TextDecoder("utf-8", { fatal: true });
    if (reader) {
      while (true) {
        let chunk: ReadableStreamReadResult<Uint8Array>;
        try {
          chunk = await reader.read();
        } catch {
          throw new RequestInputError(400, "BODY_UNREADABLE");
        }
        if (chunk.done) {
          completed = true;
          break;
        }
        bytes += chunk.value.byteLength;
        if (bytes > maxBytes) throw new RequestInputError(413, "BODY_TOO_LARGE");
        try {
          text += decoder.decode(chunk.value, { stream: true });
        } catch {
          throw new RequestInputError(400, "INVALID_JSON");
        }
      }
    }
    try {
      text += decoder.decode();
      return JSON.parse(text);
    } catch {
      throw new RequestInputError(400, "INVALID_JSON");
    }
  } finally {
    if (reader) {
      // Do not let a rejection leave the input stream running, or let cancellation
      // failure replace the safe input error. Release the lock for all outcomes.
      if (!completed) await reader.cancel().catch(() => {});
      reader.releaseLock();
    }
  }
}
