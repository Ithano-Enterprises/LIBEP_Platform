import type { SyncBatch } from './payload';
import type { Transport, TransportResponse } from './transport';

// MOCK transport: no network. Behaves like the proposed /sync-batch: stores
// records by ID, answers inserted the first time and already_present on an
// identical resend, 409 for different content under the same ID. Tests
// script failures to exercise retries.

export type MockStep =
  | 'ok'
  | 'offline' // connection fails before the server sees the batch
  | 'commit_then_drop' // server stores the batch, the answer is lost
  | { status: number; body?: TransportResponse['body']; retryAfterMs?: number };

export function createMockTransport(script: MockStep[] = []) {
  const stored = new Map<string, string>();
  const batches: SyncBatch[] = [];
  const steps = [...script];

  function commit(batch: SyncBatch): TransportResponse {
    // Validate everything first, then store (all-or-nothing, as proposed).
    for (const r of batch.records) {
      const id = String(r.data.id);
      const prev = stored.get(id);
      if (prev !== undefined && prev !== JSON.stringify(r)) {
        return {
          status: 409,
          body: { contract_version: 1, error: { code: 'CONFLICT', retryable: false, record_id: id, field: null } },
        };
      }
    }
    const results = batch.records.map((r) => {
      const id = String(r.data.id);
      const had = stored.has(id);
      stored.set(id, JSON.stringify(r));
      return { id, status: had ? 'already_present' : 'inserted' };
    });
    return { status: 200, body: { contract_version: 1, results } };
  }

  const transport: Transport = {
    async send(batch) {
      batches.push(batch);
      const step = steps.shift() ?? 'ok';
      if (step === 'offline') throw new Error('MOCK: offline');
      if (step === 'commit_then_drop') {
        commit(batch);
        throw new Error('MOCK: response lost');
      }
      if (step === 'ok') return commit(batch);
      return { status: step.status, body: step.body ?? null, retryAfterMs: step.retryAfterMs };
    },
  };

  return { transport, stored, batches };
}
