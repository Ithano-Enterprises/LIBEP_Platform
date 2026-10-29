import { createBackend } from "./backend.ts";
import { createSyncHandler } from "./handler.ts";

/** Feature remains off until staging provisioning, policy review and mobile retry fixes pass. */
export function handlerFromEnvironment(get: (name: string) => string | undefined) {
  const disabled = () =>
    Response.json({
      contract_version: 1,
      error: { code: "sync_not_enabled", retryable: false, record_id: null, field: null },
    }, { status: 503, headers: { "cache-control": "no-store" } });
  if (get("LIBEP_SYNC_ENABLED") !== "true") return disabled;
  const positive = (name: string) => {
    const raw = get(name);
    const value = Number(raw);
    if (!raw || !/^\d+$/.test(raw) || !Number.isSafeInteger(value) || value < 1) {
      throw new Error("Missing or invalid sync configuration");
    }
    return value;
  };
  try {
    const url = get("SUPABASE_URL"), key = get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return disabled;
    return createSyncHandler({
      enabled: true,
      maxBytes: positive("LIBEP_SYNC_MAX_BYTES"),
      limits: {
        maxRecords: positive("LIBEP_SYNC_MAX_RECORDS"),
        maxCrew: positive("LIBEP_SYNC_MAX_CREW"),
      },
      ...createBackend(url, key, positive("LIBEP_SYNC_TIMEOUT_MS")),
    });
  } catch {
    return disabled;
  }
}
if (import.meta.main) Deno.serve(handlerFromEnvironment((name) => Deno.env.get(name)));
