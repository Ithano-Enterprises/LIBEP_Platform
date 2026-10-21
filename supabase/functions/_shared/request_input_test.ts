import { readBearerToken, readBoundedJson, RequestInputError } from "./request_input.ts";

const encoder = new TextEncoder();
function request(body: string, headers: Record<string, string> = {}): Request {
  return new Request("https://example.test/sync-batch", {
    method: "POST",
    body,
    headers: { "content-type": "application/json", ...headers },
  });
}
async function rejectsInput(run: () => unknown, status: number, code: string): Promise<void> {
  try {
    await run();
  } catch (error) {
    if (error instanceof RequestInputError && error.status === status && error.code === code) {
      return;
    }
    throw error;
  }
  throw new Error(`Expected ${status} ${code}`);
}

Deno.test("bearer parser returns opaque tokens and accepts case-insensitive scheme", () => {
  for (const scheme of ["Bearer", "bearer", "BEARER"]) {
    const token = readBearerToken(new Headers({ authorization: `${scheme} opaque-token._~+/==` }));
    if (token !== "opaque-token._~+/==") throw new Error("Credential changed");
  }
});
Deno.test("bearer parser rejects absent, empty, mixed and multiple credentials", async () => {
  for (
    const value of ["", "Basic value", "Bearer", "Bearer a b", "Bearer a,Bearer b", "Bearer =a"]
  ) {
    await rejectsInput(
      () => readBearerToken(new Headers({ authorization: value })),
      401,
      "BEARER_REQUIRED",
    );
  }
  await rejectsInput(() => readBearerToken(new Headers()), 401, "BEARER_REQUIRED");
});
Deno.test("bearer parser errors never include the supplied credential", () => {
  try {
    readBearerToken(new Headers({ authorization: "Basic secret-value" }));
  } catch (error) {
    if (String(error).includes("secret-value")) throw new Error("Credential leaked");
    return;
  }
  throw new Error("Malformed credentials accepted");
});
Deno.test("JSON reader accepts exact byte boundary and media type parameters", async () => {
  const body = '{"quantity":"12.50"}';
  const value = await readBoundedJson(
    request(body, { "content-type": "Application/JSON; charset=utf-8" }),
    encoder.encode(body).length,
  );
  if (JSON.stringify(value) !== body) throw new Error("Input changed");
});
Deno.test("JSON reader preserves primitive and array input for domain validation", async () => {
  for (const body of ["null", "true", "42", '"text"', "[]"]) {
    if (JSON.stringify(await readBoundedJson(request(body), 32)) !== body) {
      throw new Error("Unexpected value");
    }
  }
});
Deno.test("JSON reader rejects unsupported media types", async () => {
  for (const type of ["text/plain", "", "application/jsonp"]) {
    await rejectsInput(
      () => readBoundedJson(request("{}", { "content-type": type }), 32),
      415,
      "JSON_REQUIRED",
    );
  }
});
Deno.test("JSON reader rejects malformed content lengths", async () => {
  for (const length of ["-1", "1.5", "1e3", "no", "2,2"]) {
    await rejectsInput(
      () => readBoundedJson(request("{}", { "content-length": length }), 32),
      400,
      "INVALID_CONTENT_LENGTH",
    );
  }
});
Deno.test("JSON reader rejects declared excess without reading the stream", async () => {
  let pulled = false;
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    pull() {
      pulled = true;
    },
    cancel() {
      cancelled = true;
    },
  }, { highWaterMark: 0 });
  const req = new Request("https://example.test", {
    method: "POST",
    body,
    headers: { "content-type": "application/json", "content-length": "999999999999999999999999" },
  });
  await rejectsInput(() => readBoundedJson(req, 32), 413, "BODY_TOO_LARGE");
  if (pulled || !cancelled || body.locked) throw new Error("Body was read or not released");
});
Deno.test("JSON reader enforces actual bytes when length is absent or understates size", async () => {
  for (const headers of [{}, { "content-length": "1" }] as Record<string, string>[]) {
    await rejectsInput(
      () => readBoundedJson(request('"too big"', headers), 4),
      413,
      "BODY_TOO_LARGE",
    );
  }
});
Deno.test("JSON reader counts UTF-8 bytes rather than characters", async () => {
  await rejectsInput(() => readBoundedJson(request('"é"'), 3), 413, "BODY_TOO_LARGE");
});
Deno.test("JSON reader handles a UTF-8 character split across chunks", async () => {
  const bytes = encoder.encode('"é"');
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      for (const byte of bytes) c.enqueue(new Uint8Array([byte]));
      c.close();
    },
  });
  const req = new Request("https://example.test", {
    method: "POST",
    body,
    headers: { "content-type": "application/json" },
  });
  if (await readBoundedJson(req, bytes.length) !== "é" || body.locked) {
    throw new Error("Split decoding failed");
  }
});
Deno.test("JSON reader cancels streaming excess and releases the reader", async () => {
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(encoder.encode('"'));
      c.enqueue(encoder.encode("large"));
    },
    cancel() {
      cancelled = true;
    },
  });
  const req = new Request("https://example.test", {
    method: "POST",
    body,
    headers: { "content-type": "application/json" },
  });
  await rejectsInput(() => readBoundedJson(req, 3), 413, "BODY_TOO_LARGE");
  if (!cancelled || body.locked) throw new Error("Stream not cancelled/released");
});
Deno.test("JSON reader rejects malformed JSON and empty input", async () => {
  for (const body of ["", "{", "undefined", "{} trailing"]) {
    await rejectsInput(() => readBoundedJson(request(body), 32), 400, "INVALID_JSON");
  }
});
Deno.test("JSON reader rejects invalid and truncated UTF-8", async () => {
  for (const bytes of [new Uint8Array([0xff]), new Uint8Array([0x22, 0xc3])]) {
    const req = new Request("https://example.test", {
      method: "POST",
      body: bytes,
      headers: { "content-type": "application/json" },
    });
    await rejectsInput(() => readBoundedJson(req, 32), 400, "INVALID_JSON");
  }
});
Deno.test("JSON reader converts stream errors without exposing internal details", async () => {
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      c.error(new Error("sensitive upstream detail"));
    },
  });
  const req = new Request("https://example.test", {
    method: "POST",
    body,
    headers: { "content-type": "application/json" },
  });
  await rejectsInput(() => readBoundedJson(req, 32), 400, "BODY_UNREADABLE");
  if (body.locked) throw new Error("Reader not released");
});
Deno.test("JSON reader requires an explicit positive safe byte budget", async () => {
  for (const size of [0, -1, NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    try {
      await readBoundedJson(request("{}"), size);
    } catch (e) {
      if (e instanceof RangeError) continue;
      throw e;
    }
    throw new Error("Invalid budget accepted");
  }
});
