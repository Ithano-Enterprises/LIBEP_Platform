import type { Clock } from '../repository';
import type { SqlDb } from '../sql';
import type { CatchCorrection, CatchRecord, PlantWeighing, SyncStateValue, TripClose, TripStart } from '../types';
import { buildBatch, orderRecords, type QueuedRecord } from './payload';
import { nextState, type SyncEvent } from './stateMachine';
import type { SyncResult, Transport } from './transport';

// Sends records waiting on the device to /sync-batch and records what the
// server answered. Only device-only sync_state rows change here; saved
// records are never edited (ADR 0001). Response handling follows the
// backend contract proposal §5:
// - inserted / already_present → sent (a retried send is harmless)
// - connection lost, 5xx → keep waiting, resend the same IDs later
// - 429 → keep waiting, retry after the server's delay
// - 413 → split the batch without changing record IDs
// - 409 / 422 naming a record → hold that record for resolution
// - 400 / 401 / 403 → keep the queue, needs a fix outside the app

/** [TO CONFIRM: batch row limit] */
export const MAX_BATCH = 50;

/** Retry delay after a failed send. [TO CONFIRM: retry schedule] */
export function backoffMs(attempts: number): number {
  return Math.min(5_000 * 2 ** Math.max(0, attempts - 1), 5 * 60_000);
}

export type SyncOutcome =
  | { kind: 'idle' }
  | { kind: 'sent'; acked: number; unacked: number }
  | { kind: 'retry'; afterMs: number; reason: string }
  | { kind: 'held'; recordId: string | null; code: string }
  | { kind: 'blocked'; status: number; code: string | null };

/** What the server reports back about this device's records (contract §3). */
export type DeviceFeed = {
  acks?: SyncResult[];
  reviews?: { catch_id: string; status: 'being_checked' | 'cleared'; message: string | null }[];
  weighings?: PlantWeighing[];
};

export function createSyncQueue(
  db: SqlDb,
  deps: { clock: Clock; applyPlantWeighing: (w: PlantWeighing) => Promise<void> },
  transport: Transport,
  maxBatch = MAX_BATCH,
) {
  const PENDING = `JOIN sync_state s ON s.record_id = r.id
     WHERE s.state IN ('on_device', 'waiting') AND s.last_error IS NULL`;

  /** Records not yet acknowledged and not held, in send order. */
  async function pending(): Promise<QueuedRecord[]> {
    const starts = await db.getAllAsync<TripStart>(`SELECT r.* FROM trip_starts r ${PENDING}`, []);
    const catches = await db.getAllAsync<CatchRecord>(`SELECT r.* FROM catches r ${PENDING}`, []);
    const corrections = await db.getAllAsync<CatchCorrection>(`SELECT r.* FROM catch_corrections r ${PENDING}`, []);
    const closes = await db.getAllAsync<Omit<TripClose, 'catch_ids'> & { catch_ids: string }>(
      `SELECT r.* FROM trip_closes r ${PENDING}`,
      [],
    );
    return orderRecords([
      ...starts.map((record) => ({ kind: 'trip_start' as const, record })),
      ...catches.map((record) => ({ kind: 'catch' as const, record })),
      ...corrections.map((record) => ({ kind: 'catch_correction' as const, record })),
      ...closes.map((r) => ({
        kind: 'trip_close' as const,
        record: { ...r, catch_ids: JSON.parse(r.catch_ids) as string[] },
      })),
    ]);
  }

  async function apply(recordId: string, event: SyncEvent): Promise<boolean> {
    const row = await db.getFirstAsync<{ state: SyncStateValue }>(
      'SELECT state FROM sync_state WHERE record_id = ?',
      [recordId],
    );
    if (!row) return false;
    const next = nextState(row.state, event);
    if (next === row.state) return false;
    await db.runAsync('UPDATE sync_state SET state = ?, updated_at = ? WHERE record_id = ?', [
      next,
      deps.clock.now().toISOString(),
      recordId,
    ]);
    return true;
  }

  /** The server stored it: sent, and no longer held for an earlier refusal. */
  async function ack(recordId: string): Promise<boolean> {
    const moved = await apply(recordId, 'acked');
    await db.runAsync('UPDATE sync_state SET last_error = NULL WHERE record_id = ? AND last_error IS NOT NULL', [
      recordId,
    ]);
    return moved;
  }

  async function note(ids: string[], sql: string, params: (string | null)[] = []) {
    for (const id of ids) await db.runAsync(sql, [...params, id]);
  }

  async function attempts(ids: string[]): Promise<number> {
    let max = 0;
    for (const id of ids) {
      const r = await db.getFirstAsync<{ attempts: number }>('SELECT attempts FROM sync_state WHERE record_id = ?', [id]);
      max = Math.max(max, r?.attempts ?? 0);
    }
    return max;
  }

  async function send(items: QueuedRecord[]): Promise<SyncOutcome> {
    const ids = items.map((q) => q.record.id);
    let res;
    try {
      res = await transport.send(buildBatch(items));
    } catch {
      return { kind: 'retry', afterMs: backoffMs(await attempts(ids)), reason: 'connection' };
    }

    if (res.status >= 200 && res.status < 300 && res.body?.results) {
      const inBatch = new Set(ids);
      let acked = 0;
      for (const r of res.body.results) {
        // Only IDs we sent, and only when the server says they are stored.
        if (!inBatch.has(r.id) || (r.status !== 'inserted' && r.status !== 'already_present')) continue;
        if (await ack(r.id)) acked += 1;
      }
      return { kind: 'sent', acked, unacked: ids.length - acked };
    }

    if (res.status === 413 && items.length > 1) {
      // Too big: split without changing any record ID.
      const half = Math.ceil(items.length / 2);
      const a = await send(items.slice(0, half));
      if (a.kind !== 'sent') return a;
      const b = await send(items.slice(half));
      if (b.kind !== 'sent') return b;
      return { kind: 'sent', acked: a.acked + b.acked, unacked: a.unacked + b.unacked };
    }

    if (res.status === 429) {
      return { kind: 'retry', afterMs: res.retryAfterMs ?? backoffMs(await attempts(ids)), reason: 'rate_limited' };
    }

    if ((res.status === 409 || res.status === 422) && res.body?.error) {
      const { record_id, code } = res.body.error;
      // Never overwrite or edit the record: hold it, keep everything.
      if (record_id && ids.includes(record_id)) {
        await note([record_id], 'UPDATE sync_state SET last_error = ? WHERE record_id = ?', [code]);
      }
      return { kind: 'held', recordId: record_id, code };
    }

    if (res.status >= 500) {
      return { kind: 'retry', afterMs: backoffMs(await attempts(ids)), reason: `http_${res.status}` };
    }

    return { kind: 'blocked', status: res.status, code: res.body?.error?.code ?? null };
  }

  /** One send of up to maxBatch waiting records. */
  async function runOnce(): Promise<SyncOutcome> {
    const items = (await pending()).slice(0, maxBatch);
    if (items.length === 0) return { kind: 'idle' };
    const ids = items.map((q) => q.record.id);
    for (const id of ids) await apply(id, 'queued');
    await note(ids, 'UPDATE sync_state SET attempts = attempts + 1 WHERE record_id = ?');
    return send(items);
  }

  /** Applies the device feed: late acks, review flags and plant weights. */
  async function applyFeed(feed: DeviceFeed): Promise<void> {
    for (const a of feed.acks ?? []) {
      if (a.status === 'inserted' || a.status === 'already_present') await ack(a.id);
    }
    for (const r of feed.reviews ?? []) await apply(r.catch_id, r.status === 'being_checked' ? 'review' : 'cleared');
    for (const w of feed.weighings ?? []) await deps.applyPlantWeighing(w);
  }

  /** Records held after a 409/422, with the server's code. */
  async function held(): Promise<{ record_id: string; kind: string; last_error: string }[]> {
    return db.getAllAsync('SELECT record_id, kind, last_error FROM sync_state WHERE last_error IS NOT NULL', []);
  }

  return { pending, runOnce, applyFeed, held };
}

export type SyncQueue = ReturnType<typeof createSyncQueue>;
