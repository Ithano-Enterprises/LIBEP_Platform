import fixture from "../../../contract/fixtures/mobile-v0.2-batch.json" with { type: "json" };
import { createSyncHandler, type SyncDependencies } from "./handler.ts";
import { createBackend } from "./backend.ts";
import { handlerFromEnvironment } from "./index.ts";
const user = "00000000-0000-4000-8000-000000000101";
function assert(v: unknown): asserts v {
  if (!v) throw new Error("Assertion failed");
}
function request(body: unknown = fixture, headers: Record<string, string> = {}) {
  return new Request("https://test.invalid/sync-batch", {
    method: "POST",
    headers: { authorization: "Bearer user-token", "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}
function setup(overrides: Partial<SyncDependencies> = {}) {
  const calls: string[] = [];
  const deps: SyncDependencies = {
    enabled: true,
    maxBytes: 10000,
    limits: { maxRecords: 50, maxCrew: 24 },
    verifyUser: (_token) => {
      calls.push("verify");
      return Promise.resolve(user);
    },
    commit: (uid, records) => {
      assert(uid === user);
      calls.push("commit");
      return Promise.resolve({
        status: 200,
        body: {
          contract_version: 1,
          results: records.map((r) => ({
            id: (r as { data: { id: string } }).data.id,
            status: "inserted",
          })),
        },
      });
    },
    ...overrides,
  };
  return { handler: createSyncHandler(deps), calls };
}
Deno.test("handler verifies identity before validating and committing one batch", async () => {
  const { handler, calls } = setup();
  const r = await handler(request());
  assert(r.status === 200);
  assert(calls.join() === "verify,commit");
  assert((await r.json()).results.length === 4);
  assert(r.headers.get("cache-control") === "no-store");
});
Deno.test("disabled endpoint never reads credentials or invokes persistence", async () => {
  const { handler, calls } = setup({ enabled: false });
  assert((await handler(request())).status === 503);
  assert(calls.length === 0);
});
Deno.test("method and browser origins are denied before verification", async () => {
  for (
    const req of [
      new Request("https://test.invalid/"),
      request(fixture, { origin: "https://example.test" }),
    ]
  ) {
    const { handler, calls } = setup();
    assert([403, 405].includes((await handler(req)).status));
    assert(calls.length === 0);
  }
});
Deno.test("missing or expired credential never commits or validates body", async () => {
  const { handler, calls } = setup({ verifyUser: () => Promise.resolve(null) });
  assert((await handler(request())).status === 401);
  assert(calls.length === 0);
  const result = await setup().handler(request(fixture, { authorization: "Basic secret" }));
  assert(result.status === 401);
});
Deno.test("invalid field stops before database and identifies the offending record", async () => {
  const bad = structuredClone(fixture);
  bad.records[1].data.quantity = "0";
  const { handler, calls } = setup();
  const r = await handler(request(bad));
  const b = await r.json();
  assert(
    r.status === 422 && b.error.record_id === fixture.records[1].data.id &&
      b.error.field === "quantity",
  );
  assert(calls.join() === "verify");
});
Deno.test("byte limit is enforced before commit", async () => {
  const { handler, calls } = setup({ maxBytes: 10 });
  assert((await handler(request())).status === 413);
  assert(calls.join() === "verify");
});
Deno.test("malformed JSON media type becomes documented 400", async () => {
  const { handler, calls } = setup();
  assert((await handler(request(fixture, { "content-type": "text/plain" }))).status === 400);
  assert(calls.join() === "verify");
});
Deno.test("database conflict and revocation are preserved without acknowledgements", async () => {
  for (const status of [403, 409, 422]) {
    const body = {
      contract_version: 1,
      error: {
        code: "test_failure",
        retryable: false,
        record_id: fixture.records[1].data.id,
        field: null,
      },
    };
    const { handler } = setup({ commit: () => Promise.resolve({ status, body }) });
    const r = await handler(request());
    assert(r.status === status);
    assert(!(await r.json()).results);
  }
});
Deno.test("no success response before the database promise resolves", async () => {
  let finish!: (x: { status: number; body: unknown }) => void;
  const { handler } = setup({
    commit: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  });
  let completed = false;
  const response = handler(request()).then((r) => {
    completed = true;
    return r;
  });
  // Yield one turn so the body can be consumed and commit entered.
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert(!completed);
  finish({ status: 200, body: { contract_version: 1, results: [] } });
  assert((await response).status === 200);
});
Deno.test("unknown commit outcome returns retryable error without leaking internals", async () => {
  const { handler } = setup({
    commit: () => Promise.reject(new Error("secret-token SQL customer GPS")),
  });
  const r = await handler(request());
  const raw = await r.text();
  assert(r.status === 503);
  assert(!raw.includes("secret-token"));
  assert(JSON.parse(raw).error.retryable);
});
Deno.test("verified Auth endpoint supplies identity; body metadata cannot impersonate it", async () => {
  const calls: { url: string; init: RequestInit | undefined }[] = [];
  const fake: typeof fetch = (input, init) => {
    calls.push({ url: String(input), init });
    return Promise.resolve(Response.json(
      calls.length === 1
        ? { id: user, user_metadata: { captain_id: "forged" } }
        : { status: 200, body: { contract_version: 1, results: [] } },
    ));
  };
  const backend = createBackend("https://project.test", "server-secret", 1000, fake);
  assert(await backend.verifyUser("user-token") === user);
  await backend.commit(user, []);
  assert(calls[0].url === "https://project.test/auth/v1/user");
  assert(new Headers(calls[0].init?.headers).get("authorization") === "Bearer user-token");
  assert(JSON.parse(String(calls[1].init?.body)).p_auth_user_id === user);
  assert(new Headers(calls[1].init?.headers).get("authorization") === "Bearer server-secret");
  assert(calls.every((c) => c.init?.redirect === "error" && c.init.signal instanceof AbortSignal));
});
Deno.test("Auth rejection differs from Auth outage", async () => {
  for (const status of [401, 403]) {
    const b = createBackend(
      "https://project.test",
      "key",
      1000,
      () => Promise.resolve(new Response(null, { status })),
    );
    assert(await b.verifyUser("token") === null);
  }
  const b = createBackend(
    "https://project.test",
    "key",
    1000,
    () => Promise.resolve(new Response(null, { status: 500 })),
  );
  let rejected = false;
  try {
    await b.verifyUser("token");
  } catch {
    rejected = true;
  }
  assert(rejected);
});
Deno.test("configuration fails closed without guessing limits", async () => {
  for (const config of [{}, { LIBEP_SYNC_ENABLED: "true" }, { LIBEP_SYNC_ENABLED: "false" }]) {
    const h = handlerFromEnvironment((name) => (config as Record<string, string>)[name]);
    assert((await h(request())).status === 503);
  }
});
