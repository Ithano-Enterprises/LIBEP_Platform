#!/usr/bin/env node
// Run with Node 24 against the mobile branch/checkout being integrated.
// This is deliberately a buildBatch compatibility test, not a database or HTTP test.
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { deepStrictEqual } from 'node:assert';

const payloadPath = process.argv[2];
if (!payloadPath) {
  console.error('Usage: node scripts/check-logbook-contract.mjs /path/to/apps/logbook/src/data/sync/payload.ts');
  process.exit(1);
}
const fixture = JSON.parse(await readFile(new URL('../contract/fixtures/mobile-v0.2-batch.json', import.meta.url), 'utf8'));
const { buildBatch } = await import(pathToFileURL(resolve(payloadPath)).href);
const records = fixture.records.map(({ kind, data }) => {
  const record = structuredClone(data);
  for (const field of ['quantity', 'total_quantity']) {
    if (field in record) {
      const value = Number(record[field]);
      if (!Number.isSafeInteger(value)) throw new Error('Fixture cannot be represented by the mobile client');
      record[field] = value;
    }
  }
  return { kind, record };
});
// Supply reverse dependency order: the app must produce the agreed batch order.
deepStrictEqual(buildBatch(records.reverse()), fixture);
console.log('PASS: mobile buildBatch produces the shared four-record candidate fixture exactly.');
