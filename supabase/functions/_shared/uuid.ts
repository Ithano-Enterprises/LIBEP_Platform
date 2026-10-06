/**
 * ADR 0001 requires client-generated UUIDv4 record IDs.
 * Validate without trimming, coercing, or generating a replacement ID.
 * This checks syntax only; it does not establish ownership or uniqueness.
 */
export function isUuidV4(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
