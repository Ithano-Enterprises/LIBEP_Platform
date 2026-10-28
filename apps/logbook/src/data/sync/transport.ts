import type { SyncBatch } from './payload';

// How a batch reaches the server. Only a mock exists until the backend is
// live; the real one will POST to /sync-batch. A thrown error means the
// connection failed and the outcome is unknown (resend the same IDs).

export type SyncResult = { id: string; status: 'inserted' | 'already_present' | string };

export type TransportResponse = {
  status: number;
  body: {
    contract_version?: number;
    results?: SyncResult[];
    error?: { code: string; retryable: boolean; record_id: string | null; field: string | null };
  } | null;
  /** From a Retry-After header (429). */
  retryAfterMs?: number;
};

export interface Transport {
  send(batch: SyncBatch): Promise<TransportResponse>;
}
