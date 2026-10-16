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

/**
 * Dependency order, then the order they were recorded. A correction always
 * follows the correction it points at (previous_correction_id): device
 * clocks can go back (ADR 0001), so recorded_at alone cannot order a chain.
 */
export function orderRecords(records: QueuedRecord[]): QueuedRecord[] {
  const sorted = [...records].sort(
    (a, b) =>
      KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.record.recorded_at.localeCompare(b.record.recorded_at),
  );
  const present = new Set(sorted.map((q) => q.record.id));
  const out: QueuedRecord[] = [];
  const emitted = new Set<string>();
  const waiting = new Map<string, QueuedRecord[]>();
  const emit = (q: QueuedRecord) => {
    out.push(q);
    emitted.add(q.record.id);
    for (const next of waiting.get(q.record.id) ?? []) emit(next);
    waiting.delete(q.record.id);
  };
  for (const q of sorted) {
    const prev = q.kind === 'catch_correction' ? q.record.previous_correction_id : null;
    if (prev && present.has(prev) && !emitted.has(prev)) {
      waiting.set(prev, [...(waiting.get(prev) ?? []), q]);
    } else {
      emit(q);
    }
  }
  return out;
}

export function buildBatch(records: QueuedRecord[]): SyncBatch {
  return {
    contract_version: CONTRACT_VERSION,
    records: orderRecords(records).map((q) => ({ kind: q.kind, data: toData(q) })),
  };
}
