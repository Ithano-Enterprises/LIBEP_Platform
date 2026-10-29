import fixture from "../../../contract/fixtures/mobile-v0.2-batch.json" with { type: "json" };
import { ContractError, isDeviceTimestamp, validateLogbookBatch } from "./logbook_contract.ts";

const limits = { maxRecords: 50, maxCrew: null };
const copy = () => structuredClone(fixture);
function assert(value: unknown, message = "Assertion failed"): asserts value {
  if (!value) throw new Error(message);
}
function fails(input: unknown, status: number, field: string | null, recordId: string | null) {
  try {
    validateLogbookBatch(input, limits);
  } catch (error) {
    assert(error instanceof ContractError);
    assert(
      error.status === status && error.field === field && error.recordId === recordId,
      JSON.stringify(error.toJSON()),
    );
    return error;
  }
  throw new Error("Expected validation failure");
}
Deno.test("current mobile fixture validates without changing raw data or order", () => {
  const batch = copy();
  const before = JSON.stringify(batch);
  assert(validateLogbookBatch(batch, limits) === batch);
  assert(JSON.stringify(batch) === before);
});
Deno.test("zero-catch close and unequal returning crew remain representable", () => {
  const batch = copy();
  const close = batch.records[3].data;
  close.catch_ids = [];
  close.total_quantity = "0";
  close.crew_returned = 0;
  close.crew_change_reason = null;
  validateLogbookBatch(batch, limits);
});
Deno.test("decimal strings are not converted to lossy JS numbers", () => {
  const batch = copy();
  batch.records[1].data.quantity = "900719925474099312345";
  assert(validateLogbookBatch(batch, limits).records[1].data.quantity === "900719925474099312345");
});
Deno.test("nullable replacements keep cleared notes and unmatched species", () => {
  const data = validateLogbookBatch(copy(), limits).records[2].data;
  assert(data.species_id === null && data.note === null && data.hold_code === null);
  assert(data.species_local_name === fixture.records[1].data.species_local_name);
});
Deno.test("bad device clock is preserved and does not reorder corrections", () => {
  assert(
    validateLogbookBatch(copy(), limits).records[2].data.recorded_at === "1970-01-01T00:00:00.000Z",
  );
});
for (
  const value of [null, [], "batch", {}, { contract_version: 1, records: {} }, {
    contract_version: 1,
    records: [],
    secret: true,
  }]
) {
  Deno.test(`reject malformed envelope ${JSON.stringify(value)}`, () => {
    try {
      validateLogbookBatch(value, limits);
    } catch (e) {
      assert(e instanceof ContractError && e.status === 400);
      return;
    }
    throw new Error("Invalid envelope accepted");
  });
}
Deno.test("version is explicit and is not coerced", () => {
  for (const version of [0, 2, "1", null]) {
    fails({ contract_version: version, records: [] }, 400, "contract_version", null);
  }
});
Deno.test("empty queue is valid at shape level and row budget is caller supplied", () => {
  validateLogbookBatch({ contract_version: 1, records: [] }, limits);
  const batch = copy();
  validateLogbookBatch(batch, { ...limits, maxRecords: 4 });
  try {
    validateLogbookBatch(batch, { ...limits, maxRecords: 3 });
  } catch (e) {
    assert(e instanceof ContractError && e.status === 413);
    return;
  }
  throw new Error("Oversize batch accepted");
});
Deno.test("invalid limits fail as configuration errors", () => {
  for (
    const config of [{ maxRecords: 0, maxCrew: null }, { maxRecords: 50, maxCrew: 0 }, {
      maxRecords: 1.5,
      maxCrew: null,
    }]
  ) {
    try {
      validateLogbookBatch(copy(), config);
    } catch (e) {
      assert(e instanceof RangeError);
      continue;
    }
    throw new Error("Invalid configuration accepted");
  }
});
const invalidCases: [number, string, unknown][] = [
  [0, "id", "not-a-uuid"],
  [0, "device_id", null],
  [0, "crew_departed", 0],
  [0, "crew_departed", 1.5],
  [0, "crew_departed", Number.MAX_SAFE_INTEGER + 1],
  [0, "trip_id", fixture.records[1].data.id],
  [0, "captain_id", ""],
  [0, "device_clock_skew_ms", 0.5],
  [0, "recorded_at", "2026-02-30T00:00:00.000Z"],
  [1, "quantity", 15],
  [1, "quantity", "15.4"],
  [1, "quantity", "0"],
  [1, "quantity", "1e3"],
  [1, "quantity", "-1"],
  [1, "unit", "t"],
  [1, "tier", "W"],
  [1, "species_local_name", "   "],
  [1, "latitude", 91],
  [1, "longitude", -181],
  [1, "gps_accuracy_m", -1],
  [1, "water_temp_c", Infinity],
  [1, "hold_code", "E"],
  [2, "previous_correction_id", fixture.records[2].data.id],
  [3, "crew_returned", -1],
  [3, "total_quantity", "-1"],
  [3, "distance_km", -1],
  [3, "catch_ids", ["bad-id"]],
];
for (const [index, field, value] of invalidCases) {
  Deno.test(`reject record ${index} ${field}=${String(value)}`, () => {
    const batch = copy();
    const data = batch.records[index].data as Record<string, unknown>;
    data[field] = value;
    fails(batch, 422, field, field === "id" ? null : fixture.records[index].data.id);
  });
}
Deno.test("coordinates must be both present or both absent", () => {
  const batch = copy();
  (batch.records[1].data as Record<string, unknown>).latitude = 0;
  fails(batch, 422, "longitude", fixture.records[1].data.id);
  (batch.records[1].data as Record<string, unknown>).longitude = 0;
  validateLogbookBatch(batch, limits);
});
Deno.test("all declared fields must be supplied even when nullable", () => {
  const batch = copy();
  delete (batch.records[2].data as Record<string, unknown>).note;
  fails(batch, 422, "note", fixture.records[2].data.id);
});
Deno.test("server fields and old crew_count are rejected without echoing arbitrary input", () => {
  for (const name of ["created_at", "crew_count", "private-secret-in-property-name"]) {
    const batch = copy();
    (batch.records[0].data as Record<string, unknown>)[name] = "secret-value";
    const e = fails(batch, 422, "data", fixture.records[0].data.id);
    assert(!JSON.stringify(e.toJSON()).includes(name));
    assert(!JSON.stringify(e.toJSON()).includes("secret-value"));
  }
});
Deno.test("unknown record kinds and wrappers identify the record when possible", () => {
  const batch = copy();
  batch.records[0].kind = "plant_weighing";
  fails(batch, 422, "kind", fixture.records[0].data.id);
  fails({ contract_version: 1, records: [null] }, 422, "record", null);
  fails({ contract_version: 1, records: [{ kind: "catch", data: null }] }, 422, "data", null);
});
Deno.test("crew ceiling is explicit policy, not silently fixed at the app's provisional 24", () => {
  const batch = copy();
  batch.records[0].data.crew_departed = 25;
  validateLogbookBatch(batch, limits);
  try {
    validateLogbookBatch(batch, { ...limits, maxCrew: 24 });
  } catch (e) {
    assert(e instanceof ContractError && e.field === "crew_departed");
    return;
  }
  throw new Error("Explicit ceiling ignored");
});
Deno.test("calendar validation rejects rollover and missing timezone, accepts leap day", () => {
  assert(isDeviceTimestamp("2024-02-29T23:59:59.999Z"));
  for (
    const v of [
      "2023-02-29T00:00:00.000Z",
      "2026-01-01T24:00:00.000Z",
      "2026-01-01",
      "2026-01-01T00:00:00.000",
    ]
  ) {
    assert(!isDeviceTimestamp(v));
  }
});
Deno.test("RFC3339 offset and fractional precision are accepted without rewriting timestamps", () => {
  for (
    const value of [
      "2026-10-28T09:00:00+03:00",
      "2026-10-28T06:00:00.123456Z",
      "2026-10-28t06:00:00z",
    ]
  ) {
    const batch = copy();
    batch.records[0].data.recorded_at = value;
    assert(validateLogbookBatch(batch, limits).records[0].data.recorded_at === value);
  }
  for (const value of ["2026-10-28T00:00:00+24:00", "2026-10-28T00:00:00+03:60"]) {
    assert(!isDeviceTimestamp(value));
  }
});
