import type { CatchCorrection, CatchRecord, RecordKind, TripClose, TripStart } from '../types';

// The POST /sync-batch body. Envelope from the backend contract proposal
// (§5): { contract_version, records: [{ kind, data }] }. Record fields from
// the frontend data contract (§2). Measured quantities go as decimal
// strings, as the proposal asks for numbers in JSON.
// [TO CONFIRM: device_id is in each record per the frontend contract; the
// backend proposal says it is server-managed]

export const CONTRACT_VERSION = 1;

export type QueuedRecord =
  | { kind: 'trip_start'; record: TripStart }
  | { kind: 'catch'; record: CatchRecord }
  | { kind: 'catch_correction'; record: CatchCorrection }
  | { kind: 'trip_close'; record: TripClose };

export type SyncBatch = {
  contract_version: number;
  records: { kind: RecordKind; data: Record<string, unknown> }[];
};

/** Records a later one depends on go first (a trip before its catches, etc.). */
export const KIND_ORDER: Record<RecordKind, number> = {
  trip_start: 0,
  catch: 1,
  catch_correction: 2,
  trip_close: 3,
};

const decimal = (n: number) => n.toFixed(1);

function toData(q: QueuedRecord): Record<string, unknown> {
  switch (q.kind) {
    case 'trip_start':
      return { ...q.record };
    case 'catch':
      return { ...q.record, quantity: decimal(q.record.quantity) };
    case 'catch_correction':
      return { ...q.record, quantity: decimal(q.record.quantity) };
    case 'trip_close':
      return { ...q.record, catch_ids: [...q.record.catch_ids], total_quantity: decimal(q.record.total_quantity) };
  }
}

/** Dependency order, then the order they were recorded. */
export function orderRecords(records: QueuedRecord[]): QueuedRecord[] {
  return [...records].sort(
    (a, b) =>
      KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.record.recorded_at.localeCompare(b.record.recorded_at),
  );
}

export function buildBatch(records: QueuedRecord[]): SyncBatch {
  return {
    contract_version: CONTRACT_VERSION,
    records: orderRecords(records).map((q) => ({ kind: q.kind, data: toData(q) })),
  };
}
