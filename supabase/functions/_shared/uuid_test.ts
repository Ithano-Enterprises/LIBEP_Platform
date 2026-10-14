import { isUuidV4 } from "./uuid.ts";

const valid = "5d9a5c8c-ec93-4bd1-8f03-5f21727e07e3";

Deno.test("accepts UUIDv4 variant values and both hexadecimal cases", () => {
  for (const variant of ["8", "9", "a", "b"]) {
    const id = valid.slice(0, 19) + variant + valid.slice(20);
    if (!isUuidV4(id) || !isUuidV4(id.toUpperCase())) throw new Error(`Rejected ${id}`);
  }
});

Deno.test("rejects UUID versions other than v4", () => {
  for (const version of ["0", "1", "2", "3", "5", "6", "7", "8", "9", "f"]) {
    if (isUuidV4(valid.slice(0, 14) + version + valid.slice(15))) {
      throw new Error(`Accepted version ${version}`);
    }
  }
});

Deno.test("rejects invalid UUID variants", () => {
  for (const variant of ["0", "1", "2", "3", "4", "5", "6", "7", "c", "d", "e", "f"]) {
    if (isUuidV4(valid.slice(0, 19) + variant + valid.slice(20))) {
      throw new Error(`Accepted variant ${variant}`);
    }
  }
});

Deno.test("rejects malformed and decorated IDs without sanitizing them", () => {
  const invalid = [
    "",
    "00000000-0000-0000-0000-000000000000",
    valid.slice(1),
    valid + "0",
    valid.replaceAll("-", ""),
    valid.replace("5", "g"),
    `{${valid}}`,
    `urn:uuid:${valid}`,
    ` ${valid}`,
    `${valid} `,
    `${valid}\n`,
    `${valid}\r\n`,
    `${valid}\0`,
  ];
  for (const id of invalid) {
    if (isUuidV4(id)) throw new Error(`Accepted malformed ID: ${JSON.stringify(id)}`);
  }
});

Deno.test("rejects non-string values without coercing them", () => {
  for (const value of [undefined, null, 42, true, [], {}, { toString: () => valid }]) {
    if (isUuidV4(value)) throw new Error("Accepted a non-string ID");
  }
});

Deno.test("accepts platform-generated UUIDv4 values", () => {
  for (let i = 0; i < 100; i++) {
    if (!isUuidV4(crypto.randomUUID())) throw new Error("Rejected generated UUIDv4");
  }
});
