/** Server-side HTTP adapters; fetch is injectable for permission-free unit tests. */
export function createBackend(url: string, serverKey: string, timeoutMs: number, fetcher = fetch) {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1) throw new Error("Invalid timeout");
  const root = new URL(url);
  if (!["http:", "https:"].includes(root.protocol) || root.username || root.password) {
    throw new Error("Invalid backend URL");
  }
  return {
    async verifyUser(token: string): Promise<string | null> {
      const response = await fetcher(new URL("/auth/v1/user", root), {
        headers: { apikey: serverKey, authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(timeoutMs),
        redirect: "error",
      });
      if (response.status === 401 || response.status === 403) return null;
      if (!response.ok) throw new Error("Auth unavailable");
      const body = await response.json();
      if (
        typeof body.id !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.id)
      ) {
        throw new Error("Invalid verified identity");
      }
      return body.id;
    },
    async commit(userId: string, records: unknown[]) {
      const response = await fetcher(new URL("/rest/v1/rpc/sync_logbook_batch", root), {
        method: "POST",
        headers: {
          apikey: serverKey,
          authorization: `Bearer ${serverKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ p_auth_user_id: userId, p_records: records }),
        signal: AbortSignal.timeout(timeoutMs),
        redirect: "error",
      });
      if (!response.ok) throw new Error("Database unavailable");
      const reply = await response.json();
      if (!reply || typeof reply.status !== "number" || !reply.body) {
        throw new Error("Invalid database reply");
      }
      return reply as { status: number; body: unknown };
    },
  };
}
