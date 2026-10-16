import { createMockTransport, type MockStep } from '../data/sync/mockTransport';
import { buildBatch, KIND_ORDER } from '../data/sync/payload';
import { backoffMs, MAX_BATCH } from '../data/sync/queue';
import { nextState } from '../data/sync/stateMachine';
import type { SyncBatch } from '../data/sync/payload';
import type { SyncStateValue } from '../data/types';
import { devLandingSite } from '../dev/fixtures/reference';
import { count, drain, LEDGER_TABLES, ledgerSnapshot, seeded, sid } from './helpers';

// Area 5: offline and sync through the queue and the mock transport only
// (no network). Server answers follow the backend contract proposal §5.

const MIN = 60_000;

/** A store with nothing sent yet: one closed trip, 3 catches, a correction chain of 2. */
async function store() {
  const ctx = await seeded();
  // The dev seed's previous trip: mark it acked so only new records queue.
  await ctx.db.runAsync("UPDATE sync_state SET state = 'sent'", []);
  const trip = await ctx.repo.startTrip({ crewCount: 4, departureAt: ctx.deps.clock.now() });
  const catches = [];
  for (const [f, q] of [['tewa', 2], ['nguru', 1.5], ['tafi', 0.4]] as const) {
    ctx.deps.tick(10 * MIN);
    catches.push(await ctx.repo.logCatch({ speciesId: sid(f), quantity: q, gps: null }));
  }
  ctx.deps.tick(MIN);
  const c1 = await ctx.repo.correctCatch({ catchId: catches[0].id, previousCorrectionId: null, quantity: 2.2 });
  ctx.deps.tick(MIN);
  const c2 = await ctx.repo.correctCatch({ catchId: catches[0].id, previousCorrectionId: c1.id, quantity: 2.3 });
  ctx.deps.tick(MIN);
  const close = await ctx.repo.closeTrip({ tripId: trip.trip_id, arrivalAt: ctx.deps.clock.now(), crewCount: 4, landingSiteId: devLandingSite.id, distanceKm: null });
  const ids = [trip.id, ...catches.map((c) => c.id), c1.id, c2.id, close.id];
  return { ...ctx, trip, catches, c1, c2, close, ids };
}

async function states(ctx: Awaited<ReturnType<typeof store>>) {
  return Promise.all(ctx.ids.map((id) => ctx.repo.getSyncState(id)));
}

const sentIds = (b: SyncBatch) => b.records.map((r) => String(r.data.id));

describe('state machine', () => {
  it('on_device → waiting → sent → being_checked → (cleared) sent, and never backwards', () => {
    let s: SyncStateValue = 'on_device';
    s = nextState(s, 'queued');
    expect(s).toBe('waiting');
    expect(nextState(s, 'review')).toBe('waiting');
    s = nextState(s, 'acked');
    expect(s).toBe('sent');
    expect(nextState(s, 'queued')).toBe('sent');
    s = nextState(s, 'review');
    expect(s).toBe('being_checked');
    expect(nextState(s, 'queued')).toBe('being_checked');
    expect(nextState(s, 'acked')).toBe('being_checked');
    s = nextState(s, 'cleared');
    expect(s).toBe('sent');
    expect(nextState('on_device', 'cleared')).toBe('on_device');
  });

  it('through the queue and the feed, with the ledger untouched', async () => {
    const ctx = await store();
    const before = await ledgerSnapshot(ctx.db);
    expect(new Set(await states(ctx))).toEqual(new Set(['on_device']));
    const mock = createMockTransport(['offline']);
    const q = ctx.repo.syncQueue(mock.transport);
    expect((await q.runOnce()).kind).toBe('retry');
    expect(new Set(await states(ctx))).toEqual(new Set(['waiting']));
    await drain(q);
    expect(new Set(await states(ctx))).toEqual(new Set(['sent']));
    await q.applyFeed({ reviews: [{ catch_id: ctx.catches[1].id, status: 'being_checked', message: null }] });
    expect(await ctx.repo.getSyncState(ctx.catches[1].id)).toBe('being_checked');
    // A resend or late ack never moves a checked record back.
    await q.applyFeed({ acks: [{ id: ctx.catches[1].id, status: 'already_present' }] });
    expect(await ctx.repo.getSyncState(ctx.catches[1].id)).toBe('being_checked');
    await q.applyFeed({ reviews: [{ catch_id: ctx.catches[1].id, status: 'cleared', message: null }] });
    expect(await ctx.repo.getSyncState(ctx.catches[1].id)).toBe('sent');
    expect(await ledgerSnapshot(ctx.db)).toEqual(before);
  });
});

describe('server answers', () => {
  it('offline: retry with backoff, nothing stored, nothing lost', async () => {
    const ctx = await store();
    const mock = createMockTransport(['offline', 'offline', 'offline']);
    const q = ctx.repo.syncQueue(mock.transport);
    const waits = [];
    for (let i = 0; i < 3; i++) {
      const o = await q.runOnce();
      expect(o.kind).toBe('retry');
      waits.push((o as { afterMs: number }).afterMs);
    }
    expect(waits).toEqual([backoffMs(1), backoffMs(2), backoffMs(3)]);
    expect(waits).toEqual([5_000, 10_000, 20_000]);
    expect(mock.stored.size).toBe(0);
    // Same IDs every time.
    expect(new Set(mock.batches.map((b) => sentIds(b).join()))).toHaveProperty('size', 1);
    expect(await q.pending()).toHaveLength(ctx.ids.length);
  });

  it('backoff doubles and is capped at 5 minutes', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8, 20].map(backoffMs)).toEqual([5e3, 5e3, 1e4, 2e4, 4e4, 8e4, 16e4, 3e5, 3e5, 3e5]);
  });

  it('commit_then_drop: the resend is acknowledged as already_present and becomes sent', async () => {
    const ctx = await store();
    const mock = createMockTransport(['commit_then_drop']);
    const q = ctx.repo.syncQueue(mock.transport);
    expect((await q.runOnce()).kind).toBe('retry');
    expect(mock.stored.size).toBe(ctx.ids.length);
    const stored = new Map(mock.stored);
    const o = await q.runOnce();
    expect(o).toEqual({ kind: 'sent', acked: ctx.ids.length, unacked: 0 });
    // Idempotent: the resend was byte-identical, so nothing changed on the server.
    expect(JSON.stringify(mock.batches[1])).toBe(JSON.stringify(mock.batches[0]));
    expect(mock.stored).toEqual(stored);
    expect(new Set(await states(ctx))).toEqual(new Set(['sent']));
  });

  it('409 for one record: that record is held with its data, the others go', async () => {
    const ctx = await store();
    const mock = createMockTransport();
    // The server already has different content under the second catch's ID.
    mock.stored.set(ctx.catches[1].id, '{"other":true}');
    const q = ctx.repo.syncQueue(mock.transport);
    const before = await ledgerSnapshot(ctx.db);
    const o = await q.runOnce();
    expect(o).toEqual({ kind: 'held', recordId: ctx.catches[1].id, code: 'CONFLICT' });
    expect(await q.held()).toEqual([{ record_id: ctx.catches[1].id, kind: 'catch', last_error: 'CONFLICT' }]);
    await drain(q);
    for (const id of ctx.ids.filter((x) => x !== ctx.catches[1].id)) expect(await ctx.repo.getSyncState(id)).toBe('sent');
    expect(await ctx.repo.getSyncState(ctx.catches[1].id)).toBe('waiting');
    expect(await ledgerSnapshot(ctx.db)).toEqual(before);
    expect(await ctx.repo.getEntry(ctx.catches[1].id)).toMatchObject({ quantity: 1.5, species_local_name: 'nguru' });
  });

  it('422 naming a record: held, the rest still sent; nothing deleted', async () => {
    const ctx = await store();
    const steps: MockStep[] = [
      { status: 422, body: { contract_version: 1, error: { code: 'VALIDATION_FAILED', retryable: false, record_id: ctx.c2.id, field: 'quantity' } } },
    ];
    const mock = createMockTransport(steps);
    const q = ctx.repo.syncQueue(mock.transport);
    const rows = await Promise.all(LEDGER_TABLES.map((t) => count(ctx.db, t)));
    expect((await q.runOnce()).kind).toBe('held');
    await drain(q);
    expect(await ctx.repo.getSyncState(ctx.c2.id)).toBe('waiting');
    expect((await q.held()).map((h) => h.record_id)).toEqual([ctx.c2.id]);
    expect(await Promise.all(LEDGER_TABLES.map((t) => count(ctx.db, t)))).toEqual(rows);
    expect(await count(ctx.db, 'sync_state')).toBeGreaterThanOrEqual(ctx.ids.length);
  });

  it('409/422 naming an ID that was not in the batch holds nothing', async () => {
    const ctx = await store();
    const mock = createMockTransport([
      { status: 409, body: { error: { code: 'CONFLICT', retryable: false, record_id: '99999999-9999-4999-8999-999999999999', field: null } } },
    ]);
    const q = ctx.repo.syncQueue(mock.transport);
    await q.runOnce();
    expect(await q.held()).toEqual([]);
    await drain(q);
    expect(new Set(await states(ctx))).toEqual(new Set(['sent']));
  });

  it('413: the batch is split without changing any ID or record, all sent', async () => {
    const ctx = await store();
    const mock = createMockTransport([{ status: 413, body: null }, { status: 413, body: null }]);
    const q = ctx.repo.syncQueue(mock.transport);
    const o = await q.runOnce();
    expect(o).toEqual({ kind: 'sent', acked: ctx.ids.length, unacked: 0 });
    const [whole, half, ...rest] = mock.batches;
    expect(sentIds(half).length).toBeLessThan(sentIds(whole).length);
    expect(rest.flatMap(sentIds).concat()).toEqual(expect.arrayContaining(sentIds(whole).filter((id) => !sentIds(half).includes(id))));
    // Every record went exactly once successfully, with the same data as in the first try.
    const firstTry = new Map(whole.records.map((r) => [String(r.data.id), JSON.stringify(r)]));
    for (const [id, json] of mock.stored) expect(json).toBe(firstTry.get(id));
    expect(mock.stored.size).toBe(ctx.ids.length);
    // Split halves keep dependency order.
    const order = mock.batches.slice(2).flatMap((b) => b.records.map((r) => KIND_ORDER[r.kind]));
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it('413 on a single record: blocked, not held, not lost', async () => {
    const ctx = await seeded();
    await ctx.db.runAsync("UPDATE sync_state SET state = 'sent'", []);
    const trip = await ctx.repo.startTrip({ crewCount: 4, departureAt: ctx.deps.clock.now() });
    const mock = createMockTransport([{ status: 413, body: null }]);
    const q = ctx.repo.syncQueue(mock.transport);
    expect(await q.runOnce()).toMatchObject({ kind: 'blocked', status: 413 });
    expect(await q.held()).toEqual([]);
    expect(await q.pending()).toHaveLength(1);
    await drain(q);
    expect(await ctx.repo.getSyncState(trip.id)).toBe('sent');
  });

  it('429: waits for Retry-After, or backs off when there is none', async () => {
    const ctx = await store();
    const mock = createMockTransport([{ status: 429, body: null, retryAfterMs: 42_000 }, { status: 429, body: null }]);
    const q = ctx.repo.syncQueue(mock.transport);
    expect(await q.runOnce()).toEqual({ kind: 'retry', afterMs: 42_000, reason: 'rate_limited' });
    expect(await q.runOnce()).toEqual({ kind: 'retry', afterMs: backoffMs(2), reason: 'rate_limited' });
    expect(mock.stored.size).toBe(0);
    await drain(q);
    expect(new Set(await states(ctx))).toEqual(new Set(['sent']));
  });

  it.each([500, 502, 503, 504])('%i: retried with backoff and the same IDs', async (status) => {
    const ctx = await store();
    const mock = createMockTransport([{ status, body: null }, { status, body: null }]);
    const q = ctx.repo.syncQueue(mock.transport);
    expect(await q.runOnce()).toEqual({ kind: 'retry', afterMs: 5_000, reason: `http_${status}` });
    expect(await q.runOnce()).toEqual({ kind: 'retry', afterMs: 10_000, reason: `http_${status}` });
    await drain(q);
    expect(sentIds(mock.batches[0])).toEqual(sentIds(mock.batches[2]));
    expect(new Set(await states(ctx))).toEqual(new Set(['sent']));
  });

  it.each([400, 401, 403])('%i: the queue is kept (blocked), nothing held or lost', async (status) => {
    const ctx = await store();
    const mock = createMockTransport([{ status, body: { error: { code: 'X', retryable: false, record_id: null, field: null } } }]);
    const q = ctx.repo.syncQueue(mock.transport);
    expect(await q.runOnce()).toEqual({ kind: 'blocked', status, code: 'X' });
    expect(await q.held()).toEqual([]);
    expect(await q.pending()).toHaveLength(ctx.ids.length);
  });

  it('a 2xx only acknowledges IDs that were sent and stored', async () => {
    const ctx = await store();
    const q = ctx.repo.syncQueue({
      send: async (batch) => ({
        status: 200,
        body: {
          results: [
            { id: String(batch.records[0].data.id), status: 'inserted' },
            { id: String(batch.records[1].data.id), status: 'VALIDATION_FAILED' },
            { id: '99999999-9999-4999-8999-999999999999', status: 'inserted' },
          ],
        },
      }),
    });
    expect(await q.runOnce()).toEqual({ kind: 'sent', acked: 1, unacked: ctx.ids.length - 1 });
    expect(await ctx.repo.getSyncState(ctx.trip.id)).toBe('sent');
    expect(await q.pending()).toHaveLength(ctx.ids.length - 1);
  });

  // BUG-8 (fixed): a record held after a 409 stayed listed as held after the
  // device feed acknowledged it; an ack now clears last_error.
  it('a held record that the feed later acknowledges is no longer listed as held', async () => {
    const ctx = await store();
    const mock = createMockTransport();
    mock.stored.set(ctx.catches[1].id, '{"other":true}');
    const q = ctx.repo.syncQueue(mock.transport);
    await q.runOnce();
    await q.applyFeed({ acks: [{ id: ctx.catches[1].id, status: 'already_present' }] });
    expect(await ctx.repo.getSyncState(ctx.catches[1].id)).toBe('sent');
    expect(await q.held()).toEqual([]);
  });
});

describe('batch contents and order', () => {
  it('trip_start before catch before correction before trip_close, across two trips', async () => {
    const ctx = await store();
    const t2 = await ctx.repo.startTrip({ crewCount: 2, departureAt: ctx.deps.clock.now() });
    const k = await ctx.repo.logCatch({ speciesId: sid('kibua'), quantity: 3, gps: null });
    await ctx.repo.correctCatch({ catchId: k.id, previousCorrectionId: null, quantity: 3.3 });
    await ctx.repo.closeTrip({ tripId: t2.trip_id, arrivalAt: ctx.deps.clock.now(), crewCount: 2, landingSiteId: devLandingSite.id, distanceKm: 3 });
    const q = ctx.repo.syncQueue(createMockTransport().transport);
    const batch = buildBatch(await q.pending());
    const kinds = batch.records.map((r) => KIND_ORDER[r.kind]);
    expect(kinds).toEqual([...kinds].sort((a, b) => a - b));
    expect(batch.contract_version).toBe(1);
    const catchRec = batch.records.find((r) => r.kind === 'catch')!;
    expect(typeof catchRec.data.quantity).toBe('string');
    expect(catchRec.data.quantity).toMatch(/^\d+\.\d$/);
    const close = batch.records.find((r) => r.kind === 'trip_close')!;
    expect(Array.isArray(close.data.catch_ids)).toBe(true);
    expect(close.data.total_quantity).toMatch(/^\d+\.\d$/);
  });

  // BUG-9 (fixed): corrections in a batch were ordered by recorded_at only.
  // When the device clock went back (ADR 0001: clocks are wrong and never
  // corrected), the later correction went before the one it points to. They
  // now follow their previous_correction_id chain.
  it('a correction is always sent after the correction it follows, even if the clock went back', async () => {
    const ctx = await seeded();
    await ctx.db.runAsync("UPDATE sync_state SET state = 'sent'", []);
    await ctx.repo.startTrip({ crewCount: 4, departureAt: ctx.deps.clock.now() });
    const c = await ctx.repo.logCatch({ speciesId: sid('tewa'), quantity: 5, gps: null });
    ctx.deps.tick(30 * MIN);
    const c1 = await ctx.repo.correctCatch({ catchId: c.id, previousCorrectionId: null, quantity: 4 });
    ctx.deps.tick(-60 * MIN); // phone clock set back (e.g. after a battery pull)
    const c2 = await ctx.repo.correctCatch({ catchId: c.id, previousCorrectionId: c1.id, quantity: 3 });
    const mock = createMockTransport();
    await drain(ctx.repo.syncQueue(mock.transport));
    const order = mock.batches.flatMap(sentIds);
    expect(order.indexOf(c1.id)).toBeLessThan(order.indexOf(c2.id));
  });

  // Kind order protects records of different kinds from a wrong clock; only
  // records of the same kind that point at each other (BUG-9) are exposed.
  it('a catch is sent after its trip_start even when its recorded_at is earlier', async () => {
    const ctx = await seeded();
    await ctx.db.runAsync("UPDATE sync_state SET state = 'sent'", []);
    const t = await ctx.repo.startTrip({ crewCount: 4, departureAt: ctx.deps.clock.now() });
    ctx.deps.tick(-120 * MIN);
    const c = await ctx.repo.logCatch({ speciesId: sid('tewa'), quantity: 5, gps: null });
    const mock = createMockTransport();
    await drain(ctx.repo.syncQueue(mock.transport));
    const order = mock.batches.flatMap(sentIds);
    expect(order.indexOf(t.id)).toBeLessThan(order.indexOf(c.id));
  });

  it(`more than ${MAX_BATCH} records go in several batches of at most ${MAX_BATCH}, each record once`, async () => {
    const ctx = await seeded();
    await ctx.db.runAsync("UPDATE sync_state SET state = 'sent'", []);
    const trip = await ctx.repo.startTrip({ crewCount: 4, departureAt: ctx.deps.clock.now() });
    for (let i = 0; i < 120; i++) {
      ctx.deps.tick(MIN);
      await ctx.repo.logCatch({ speciesId: sid('tafi'), quantity: 0.1 * ((i % 9) + 1), gps: null });
    }
    await ctx.repo.closeTrip({ tripId: trip.trip_id, arrivalAt: ctx.deps.clock.now(), crewCount: 4, landingSiteId: devLandingSite.id, distanceKm: null });
    const mock = createMockTransport();
    const out = await drain(ctx.repo.syncQueue(mock.transport));
    expect(out.map((o) => o.kind)).toEqual(['sent', 'sent', 'sent', 'idle']);
    for (const b of mock.batches) expect(b.records.length).toBeLessThanOrEqual(MAX_BATCH);
    const all = mock.batches.flatMap(sentIds);
    expect(all).toHaveLength(122);
    expect(new Set(all).size).toBe(122);
    expect(mock.batches[mock.batches.length - 1].records.at(-1)!.kind).toBe('trip_close');
  });

  it('sync never writes a ledger row, through every kind of answer', async () => {
    const ctx = await store();
    const before = await ledgerSnapshot(ctx.db);
    const mock = createMockTransport([
      'offline',
      'commit_then_drop',
      { status: 503, body: null },
      { status: 429, body: null, retryAfterMs: 1 },
      { status: 413, body: null },
      { status: 422, body: { error: { code: 'V', retryable: false, record_id: ctx.c1.id, field: null } } },
      { status: 401, body: null },
    ]);
    const q = ctx.repo.syncQueue(mock.transport);
    for (let i = 0; i < 12; i++) await q.runOnce();
    await q.applyFeed({
      acks: [{ id: ctx.c1.id, status: 'inserted' }],
      reviews: [{ catch_id: ctx.catches[0].id, status: 'being_checked', message: 'x' }],
      weighings: [{ id: '11111111-1111-4111-8111-111111111111', trip_id: ctx.trip.trip_id, species_id: sid('tafi'), catch_id: ctx.catches[2].id, weight: 0.4, unit: 't', weighed_at: ctx.deps.clock.now().toISOString() }],
    });
    expect(await ledgerSnapshot(ctx.db)).toEqual(before);
  });
});
