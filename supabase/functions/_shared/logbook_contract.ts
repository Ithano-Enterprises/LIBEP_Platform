import { isUuidV4 } from "./uuid.ts";

/** Candidate wire contract: PR #34 v0.2 and PR #43 payload.ts, not an authorization check. */
export const CONTRACT_VERSION = 1;
export const RECORD_KINDS = ["trip_start", "catch", "catch_correction", "trip_close"] as const;
export type RecordKind = typeof RECORD_KINDS[number];
export type WireRecord = { kind: RecordKind; data: Record<string, unknown> & { id: string } };
export type SyncBatch = { contract_version: 1; records: WireRecord[] };
export type ValidationLimits = { maxRecords: number; maxCrew: number | null };

export class ContractError extends Error {
  constructor(
    readonly status: 400 | 413 | 422,
    readonly code: "invalid_envelope" | "unsupported_version" | "batch_too_large" | "invalid_field",
    readonly recordId: string | null = null,
    readonly field: string | null = null,
  ) {
    super(code);
    this.name = "ContractError";
  }
  toJSON() {
    return {
      contract_version: CONTRACT_VERSION,
      error: { code: this.code, retryable: false, record_id: this.recordId, field: this.field },
    };
  }
}

type Check = (value: unknown) => boolean;
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const uuid: Check = (v) =>
  typeof v === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const text: Check = (v) => typeof v === "string";
const nonempty: Check = (v) => typeof v === "string" && v.trim().length > 0;
const finite: Check = (v) => typeof v === "number" && Number.isFinite(v);
const integer: Check = (v) => typeof v === "number" && Number.isSafeInteger(v);
const nullable = (check: Check): Check => (v) => v === null || check(v);
const between = (min: number, max: number): Check => (v) =>
  finite(v) && (v as number) >= min && (v as number) <= max;
const nonnegative: Check = (v) => finite(v) && (v as number) >= 0;
const hold: Check = (v) => typeof v === "string" && ["A", "B", "C", "D"].includes(v);
// Never convert quantities through JS Number: this layer must not silently lose precision.
const wholeKg = (allowZero: boolean): Check => (v) =>
  typeof v === "string" && /^\d+$/.test(v) && (allowZero || /[1-9]/.test(v));

/** RFC 3339 with a timezone; validate calendar fields without rewriting the raw time. */
export function isDeviceTimestamp(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const m =
    /^(\d{4})-(\d{2})-(\d{2})[Tt](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:[Zz]|([+-])(\d{2}):(\d{2}))$/
      .exec(value);
  if (!m) return false;
  const [, year, month, day, hour, minute, second, , offsetHour, offsetMinute] = m;
  const y = Number(year), mon = Number(month), d = Number(day);
  const leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  // Leap-second spelling is not emitted by the app; it requires a separate agreed policy.
  return mon >= 1 && mon <= 12 && d >= 1 && d <= days[mon - 1] &&
    Number(hour) < 24 && Number(minute) < 60 && Number(second) < 60 &&
    (offsetHour === undefined || (Number(offsetHour) < 24 && Number(offsetMinute) < 60));
}

const common: Record<string, Check> = {
  id: isUuidV4,
  device_id: uuid,
  recorded_at: isDeviceTimestamp,
  device_clock_skew_ms: nullable(integer),
};
const replacement: Record<string, Check> = {
  species_id: nullable(uuid),
  species_local_name: nonempty,
  quantity: wholeKg(false),
  unit: (v) => v === "kg",
  hold_code: nullable(hold),
  note: nullable(text),
};

function schema(kind: RecordKind, maxCrew: number | null): Record<string, Check> {
  const crew = (minimum: number): Check => (v) =>
    integer(v) && (v as number) >= minimum && (maxCrew === null || (v as number) <= maxCrew);
  switch (kind) {
    case "trip_start":
      return {
        ...common,
        trip_id: isUuidV4,
        vessel_id: uuid,
        captain_id: uuid,
        crew_departed: crew(1),
        departure_at: isDeviceTimestamp,
      };
    case "catch":
      return {
        ...common,
        ...replacement,
        trip_id: isUuidV4,
        vessel_id: uuid,
        captain_id: uuid,
        tier: (v) => v === "S",
        latitude: nullable(between(-90, 90)),
        longitude: nullable(between(-180, 180)),
        gps_accuracy_m: nullable(nonnegative),
        zone: nullable(text),
        season: nullable(text),
        water_temp_c: nullable(finite),
        short_ref: nonempty,
      };
    case "catch_correction":
      return {
        ...common,
        ...replacement,
        catch_id: isUuidV4,
        previous_correction_id: nullable(isUuidV4),
        reason: nullable(text),
      };
    case "trip_close":
      return {
        ...common,
        trip_id: isUuidV4,
        arrival_at: isDeviceTimestamp,
        crew_returned: crew(0),
        crew_change_reason: nullable(text),
        landing_site_id: uuid,
        distance_km: nullable(nonnegative),
        catch_ids: (v) => Array.isArray(v) && v.every(isUuidV4),
        total_quantity: wholeKg(true),
        unit: (v) => v === "kg",
      };
  }
}

/**
 * Validates shape only, preserving local names, timestamps, IDs and decimal strings.
 * No defaults for unsettled production limits. No reference lookup, auth, persistence,
 * dependency reordering, deduplication, correction permission or total recomputation.
 */
export function validateLogbookBatch(input: unknown, limits: ValidationLimits): SyncBatch {
  if (
    !Number.isSafeInteger(limits.maxRecords) || limits.maxRecords < 1 ||
    (limits.maxCrew !== null && (!Number.isSafeInteger(limits.maxCrew) || limits.maxCrew < 1))
  ) {
    throw new RangeError("Invalid validation limits");
  }
  if (
    !object(input) || Object.keys(input).some((k) => !["contract_version", "records"].includes(k))
  ) {
    throw new ContractError(400, "invalid_envelope");
  }
  if (input.contract_version !== CONTRACT_VERSION) {
    throw new ContractError(400, "unsupported_version", null, "contract_version");
  }
  if (!Array.isArray(input.records)) {
    throw new ContractError(400, "invalid_envelope", null, "records");
  }
  if (input.records.length > limits.maxRecords) throw new ContractError(413, "batch_too_large");
  for (const record of input.records) {
    const id = object(record) && object(record.data) && isUuidV4(record.data.id)
      ? record.data.id
      : null;
    const invalid = (field: string): never => {
      throw new ContractError(422, "invalid_field", id, field);
    };
    if (!object(record) || Object.keys(record).some((k) => !["kind", "data"].includes(k))) {
      invalid("record");
    }
    if (!RECORD_KINDS.includes(record.kind)) invalid("kind");
    if (!object(record.data)) invalid("data");
    const data = record.data as Record<string, unknown>;
    const fields = schema(record.kind, limits.maxCrew);
    // Do not reflect attacker-controlled property names into errors/logs.
    if (Object.keys(data).some((k) => !Object.hasOwn(fields, k))) invalid("data");
    for (const [field, check] of Object.entries(fields)) {
      if (!Object.hasOwn(data, field) || !check(data[field])) invalid(field);
    }
    if (
      record.kind === "trip_start" &&
      (data.trip_id as string).toLowerCase() !== (data.id as string).toLowerCase()
    ) invalid("trip_id");
    if (record.kind === "catch" && (data.latitude === null) !== (data.longitude === null)) {
      invalid("longitude");
    }
    if (
      record.kind === "catch_correction" && data.previous_correction_id !== null &&
      (data.previous_correction_id as string).toLowerCase() === (data.id as string).toLowerCase()
    ) {
      invalid("previous_correction_id");
    }
  }
  return input as SyncBatch;
}
