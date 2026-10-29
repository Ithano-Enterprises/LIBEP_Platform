import {
  ContractError,
  validateLogbookBatch,
  type ValidationLimits,
} from "../_shared/logbook_contract.ts";
import { readBearerToken, readBoundedJson, RequestInputError } from "../_shared/request_input.ts";

type CommitReply = { status: number; body: unknown };
export type SyncDependencies = {
  enabled: boolean;
  maxBytes: number;
  limits: ValidationLimits;
  verifyUser(token: string): Promise<string | null>;
  commit(userId: string, records: unknown[]): Promise<CommitReply>;
};
const json = (body: unknown, status: number) =>
  Response.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });
const error = (status: number, code: string, retryable = false) =>
  json({
    contract_version: 1,
    error: { code, retryable, record_id: null, field: null },
  }, status);

/** No account enrolment, permissive CORS, invented defaults or success-before-commit. */
export function createSyncHandler(deps: SyncDependencies) {
  return async (request: Request): Promise<Response> => {
    if (!deps.enabled) return error(503, "sync_not_enabled", false);
    if (request.method !== "POST") return error(405, "method_not_allowed");
    if (request.headers.has("origin")) return error(403, "browser_origin_not_allowed");
    try {
      const userId = await deps.verifyUser(readBearerToken(request.headers));
      if (!userId) return error(401, "invalid_credential");
      const batch = validateLogbookBatch(
        await readBoundedJson(request, deps.maxBytes),
        deps.limits,
      );
      // RPC rechecks current device state and scope under its transaction lock.
      const result = await deps.commit(userId, batch.records);
      if (![200, 400, 403, 409, 422].includes(result.status)) throw new Error("Invalid RPC status");
      return json(result.body, result.status);
    } catch (e) {
      if (e instanceof ContractError) return json(e.toJSON(), e.status);
      if (e instanceof RequestInputError) {
        // Mobile handles malformed inputs as 400; avoid introducing an unhandled 415.
        const status = e.status === 415 ? 400 : e.status;
        return error(status, e.code.toLowerCase());
      }
      // A transport failure can occur after commit. Retrying unchanged IDs is safe.
      // Never expose token, database error, response body or user location data.
      return error(503, "sync_unavailable", true);
    }
  };
}
