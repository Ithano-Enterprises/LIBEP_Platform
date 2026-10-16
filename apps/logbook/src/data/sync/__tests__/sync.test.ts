import { devSpecies } from '../../../dev/fixtures/reference';
import { seedDevReference } from '../../../dev/fixtures/seed';
import { openTestRepo } from '../../../test/sqlite';
import { createMockTransport, type MockStep } from '../mockTransport';
import { buildBatch, CONTRACT_VERSION, type QueuedRecord } from '../payload';
import { backoffMs } from '../queue';
import { nextState } from '../stateMachine';

const speciesId = (n: string) => devSpecies.find((s) => s.local_name === n)!.id;

/** A trip with two catches, a correction and the close: one of each kind. */
async function trip() {
  const ctx = await openTestRepo();
  await seedDevReference(ctx.db);
  const start = await ctx.repo.startTrip({ crewCount: 4, departureAt: ctx.deps.clock.now() });
  ctx.deps.tick(60_000);
  const c1 = await ctx.repo.logCatch({
    speciesId: speciesId('tewa'),
    quantity: 2.4,
    gps: { latitude: -2.27, longitude: 40.93, gps_accuracy_m: 15 },
  });
  ctx.deps.tick(60_000);
  const c2 = await ctx.repo.logCatch({ speciesId: speciesId('kibua'), quantity: 3, gps: null });
  ctx.deps.tick(60_000);
  const fix = await ctx.repo.correctCatch({ catchId: c1.id, previousCorrectionId: null, quantity: 2.6 });
  ctx.deps.tick(60_000);
  const close = await ctx.repo.closeTrip({
    tripId: start.trip_id,
    arrivalAt: ctx.deps.clock.now(),
    crewCount: 4,
    landingSiteId: (await ctx.repo.getLandingSites())[0].id,
    distanceKm: null,
  });
  return { ...ctx, start, c1, c2, fix, close, ids: [start.id, c1.id, c2.id, fix.id, close.id] };
}

const states = async (repo: Awaited<ReturnType<typeof trip>>['repo'], ids: string[]) =>
  Promise.all(ids.map((id) => repo.getSyncState(id)));

/** Rows of every record table, to prove sync never edits them. */
async function snapshot(db: Awaited<ReturnType<typeof trip>>['db']) {
  const out: unknown[] = [];
  for (const t of ['trip_starts', 'catches', 'catch_corrections', 'trip_closes']) {
    out.push(await db.getAllAsync(`SELECT * FROM ${t} ORDER BY id`, []));
  }
  return JSON.stringify(out);
}

describe('state machine', () => {
  it('moves forward only: on_device → waiting → sent ↔ being_checked', () => {
    expect(nextState('on_device', 'queued')).toBe('waiting');
    expect(nextState('waiting', 'acked')).toBe('sent');
    expect(nextState('on_device', 'acked')).toBe('sent'); // late ack from the feed
    expect(nextState('sent', 'review')).toBe('being_checked');
    expect(nextState('being_checked', 'cleared')).toBe('sent');
    // No going back
    expect(nextState('sent', 'queued')).toBe('sent');
    expect(nextState('being_checked', 'acked')).toBe('being_checked');
    expect(nextState('waiting', 'review')).toBe('waiting');
    expect(nextState('on_device', 'cleared')).toBe('on_device');
  });
});

describe('payload', () => {
  it('matches the contract: envelope, kinds, fields, decimal strings, dependency order', async () => {
    const { repo, start, c1, c2, fix, close } = await trip();
    const queue = repo.syncQueue(createMockTransport().transport);
    const pending = await queue.pending();
    // Shuffled input still comes out in dependency order.
    const batch = buildBatch([...pending].reverse() as QueuedRecord[]);
    expect(batch.contract_version).toBe(CONTRACT_VERSION);
    expect(batch.records.map((r) => r.kind)).toEqual([
      'trip_start',
      'catch',
      'catch',
      'catch_correction',
      'trip_close',
    ]);
    const [s, a, b, corr, cl] = batch.records.map((r) => r.data);
    expect(s).toEqual({ ...start });
    expect(Object.keys(a).sort()).toEqual(Object.keys(c1).sort());
    expect(a).toMatchObject({ id: c1.id, quantity: '2.4', unit: 't', tier: 'S', species_local_name: 'tewa' });
    expect(b).toMatchObject({ id: c2.id, quantity: '3.0', latitude: null });
    expect(corr).toMatchObject({ id: fix.id, catch_id: c1.id, previous_correction_id: null, quantity: '2.6' });
    expect(cl).toMatchObject({ id: close.id, total_quantity: '5.6', catch_ids: close.catch_ids });
    for (const r of batch.records) {
      expect(r.data).toEqual(expect.objectContaining({ device_id: start.device_id, device_clock_skew_ms: null }));
      expect(typeof r.data.recorded_at).toBe('string');
    }
  });
});

describe('correction chain order', () => {
  it('a correction follows the correction it points at, even when the clock went back', async () => {
    const ctx = await openTestRepo();
    await seedDevReference(ctx.db);
    await ctx.repo.startTrip({ crewCount: 4, departureAt: ctx.deps.clock.now() });
    const c = await ctx.repo.logCatch({ speciesId: speciesId('tewa'), quantity: 5, gps: null });
    ctx.deps.tick(30 * 60_000);
    const f1 = await ctx.repo.correctCatch({ catchId: c.id, previousCorrectionId: null, quantity: 4 });
    ctx.deps.tick(-60 * 60_000); // phone clock set back
    const f2 = await ctx.repo.correctCatch({ catchId: c.id, previousCorrectionId: f1.id, quantity: 3 });
    ctx.deps.tick(5 * 60_000);
    const f3 = await ctx.repo.correctCatch({ catchId: c.id, previousCorrectionId: f2.id, quantity: 2 });
    expect(f2.recorded_at < f1.recorded_at).toBe(true);
    const batch = buildBatch(await ctx.repo.syncQueue(createMockTransport().transport).pending());
    const order = batch.records.filter((r) => r.kind === 'catch_correction').map((r) => r.data.id);
    expect(order).toEqual([f1.id, f2.id, f3.id]);
  });
});

describe('sending', () => {
  type Ctx = Awaited<ReturnType<typeof trip>>;
  async function run(script: MockStep[] | ((ctx: Ctx) => MockStep[]) = [], maxBatch?: number) {
    const ctx = await trip();
    const mock = createMockTransport(typeof script === 'function' ? script(ctx) : script);
    const queue = ctx.repo.syncQueue(mock.transport, maxBatch);
    return { ...ctx, mock, queue };
  }

  it('acks move every record to sent, without touching the records', async () => {
    const { db, repo, queue, ids, mock } = await run();
    const before = await snapshot(db);
    expect(await queue.runOnce()).toEqual({ kind: 'sent', acked: 5, unacked: 0 });
    expect(await states(repo, ids)).toEqual(Array(5).fill('sent'));
    expect(await queue.runOnce()).toEqual({ kind: 'idle' });
    expect(mock.batches).toHaveLength(1);
    expect(await snapshot(db)).toBe(before);
  });

  it('connection lost: records wait, and the retry resends the same IDs', async () => {
    const { repo, queue, ids, mock } = await run(['offline']);
    const r = await queue.runOnce();
    expect(r).toEqual({ kind: 'retry', afterMs: backoffMs(1), reason: 'connection' });
    expect(await states(repo, ids)).toEqual(Array(5).fill('waiting'));
    expect(await queue.runOnce()).toMatchObject({ kind: 'sent', acked: 5 });
    const sent = mock.batches.map((b) => b.records.map((x) => x.data.id));
    expect(sent[1]).toEqual(sent[0]);
  });

  it('idempotent: server stored it but the answer was lost; the resend comes back already_present', async () => {
    const { repo, queue, ids, mock } = await run(['commit_then_drop']);
    expect((await queue.runOnce()).kind).toBe('retry');
    expect(mock.stored.size).toBe(5);
    expect(await queue.runOnce()).toMatchObject({ kind: 'sent', acked: 5 });
    expect(await states(repo, ids)).toEqual(Array(5).fill('sent'));
    expect(mock.stored.size).toBe(5); // nothing doubled
  });

  it('partial ack: only acknowledged IDs become sent; unknown IDs are ignored', async () => {
    const { repo, queue, ids } = await run(({ ids }) => [
      {
        status: 200,
        body: {
          contract_version: 1,
          results: [
            { id: ids[0], status: 'inserted' },
            { id: ids[1], status: 'already_present' },
            { id: ids[2], status: 'rejected' },
            { id: 'not-ours', status: 'inserted' },
          ],
        },
      },
    ]);
    expect(await queue.runOnce()).toEqual({ kind: 'sent', acked: 2, unacked: 3 });
    expect(await states(repo, ids)).toEqual(['sent', 'sent', 'waiting', 'waiting', 'waiting']);
    expect((await queue.pending()).map((q) => q.record.id)).toEqual(ids.slice(2));
  });

  it('5xx and 429 keep the queue and say when to retry', async () => {
    const { repo, queue, ids } = await run([{ status: 503 }, { status: 429, retryAfterMs: 30_000 }]);
    expect(await queue.runOnce()).toEqual({ kind: 'retry', afterMs: backoffMs(1), reason: 'http_503' });
    expect(await queue.runOnce()).toEqual({ kind: 'retry', afterMs: 30_000, reason: 'rate_limited' });
    expect(await states(repo, ids)).toEqual(Array(5).fill('waiting'));
  });

  it('413 splits the batch without changing IDs', async () => {
    const { repo, queue, ids, mock } = await run([{ status: 413 }]);
    expect(await queue.runOnce()).toMatchObject({ kind: 'sent', acked: 5 });
    expect(mock.batches.map((b) => b.records.length)).toEqual([5, 3, 2]);
    expect(mock.batches.slice(1).flatMap((b) => b.records.map((r) => r.data.id))).toEqual(
      mock.batches[0].records.map((r) => r.data.id),
    );
    expect(await states(repo, ids)).toEqual(Array(5).fill('sent'));
  });

  it('409/422 hold the named record for resolution; the rest still go', async () => {
    const { repo, queue, ids, c2, db } = await run(({ c2 }) => [
      {
        status: 422,
        body: { contract_version: 1, error: { code: 'VALIDATION_FAILED', retryable: false, record_id: c2.id, field: 'quantity' } },
      },
    ]);
    const before = await snapshot(db);
    expect(await queue.runOnce()).toEqual({ kind: 'held', recordId: c2.id, code: 'VALIDATION_FAILED' });
    expect(await queue.held()).toEqual([{ record_id: c2.id, kind: 'catch', last_error: 'VALIDATION_FAILED' }]);
    expect(await queue.runOnce()).toMatchObject({ kind: 'sent', acked: 4 });
    expect(await states(repo, ids)).toEqual(['sent', 'sent', 'waiting', 'sent', 'sent']);
    expect(await snapshot(db)).toBe(before); // the record itself is unchanged
  });

  it('400/401/403 keep the queue untouched apart from the state', async () => {
    const { repo, queue, ids } = await run([{ status: 401 }]);
    expect(await queue.runOnce()).toEqual({ kind: 'blocked', status: 401, code: null });
    expect(await states(repo, ids)).toEqual(Array(5).fill('waiting'));
    expect(await queue.pending()).toHaveLength(5);
  });

  it('respects the batch size', async () => {
    const { queue, mock } = await run([], 2);
    await queue.runOnce();
    expect(mock.batches[0].records.map((r) => r.kind)).toEqual(['trip_start', 'catch']);
  });

  it('backoff grows and is capped', () => {
    expect([1, 2, 3].map(backoffMs)).toEqual([5_000, 10_000, 20_000]);
    expect(backoffMs(50)).toBe(300_000);
  });
});

describe('device feed', () => {
  it('review flags, late acks and plant weights', async () => {
    const { repo, start, c1, c2, ids } = await trip();
    const queue = repo.syncQueue(createMockTransport().transport);
    await queue.runOnce();
    await queue.applyFeed({
      reviews: [{ catch_id: c1.id, status: 'being_checked', message: null }],
      weighings: [
        {
          id: 'w1',
          trip_id: start.trip_id,
          species_id: c2.species_id,
          catch_id: c2.id,
          weight: 2.9,
          unit: 't',
          weighed_at: '2026-01-01T09:00:00.000Z',
        },
      ],
    });
    expect(await repo.getSyncState(c1.id)).toBe('being_checked');
    expect((await repo.getEntry(c2.id))!.plant_weight_t).toBe(2.9);
    await queue.applyFeed({ reviews: [{ catch_id: c1.id, status: 'cleared', message: null }] });
    expect(await repo.getSyncState(c1.id)).toBe('sent');
    expect(ids).toHaveLength(5);
  });

  it('a late ack from the feed marks an on-device record sent', async () => {
    const { repo, c1 } = await trip();
    const queue = repo.syncQueue(createMockTransport().transport);
    await queue.applyFeed({ acks: [{ id: c1.id, status: 'already_present' }] });
    expect(await repo.getSyncState(c1.id)).toBe('sent');
  });
});
