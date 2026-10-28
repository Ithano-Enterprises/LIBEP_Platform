import { act, render, waitFor } from '@testing-library/react-native';

import { LogbookProvider } from '../../LogbookProvider';
import { devSpecies } from '../../../dev/fixtures/reference';
import { seedDevReference } from '../../../dev/fixtures/seed';
import { openTestRepo } from '../../../test/sqlite';
import { createMockTransport } from '../mockTransport';
import { SyncLoop } from '../SyncLoop';

describe('SyncLoop', () => {
  it('a failed send leaves records waiting and schedules a retry', async () => {
    const ctx = await openTestRepo();
    await seedDevReference(ctx.db);
    const start = await ctx.repo.startTrip({ crewDeparted: 4, departureAt: ctx.deps.clock.now() });
    const c = await ctx.repo.logCatch({ speciesId: devSpecies[0].id, quantity: 1, gps: null });
    const mock = createMockTransport(['offline']);
    const outcomes: string[] = [];
    const open = () => Promise.resolve(ctx.repo);
    const { unmount } = render(
      <LogbookProvider open={open}>
        <SyncLoop transport={mock.transport} intervalMs={10} onOutcome={(o) => outcomes.push(o.kind)} />
      </LogbookProvider>,
    );
    await act(async () => {}); // open the store
    // The send fails (offline); the retry comes after the backoff (5 s), so
    // within the test the records stay waiting.
    await waitFor(async () => expect(await ctx.repo.getSyncState(c.id)).toBe('waiting'));
    expect(outcomes[0]).toBe('retry');
    unmount();
    expect(await ctx.repo.getSyncState(start.id)).toBe('waiting');
  });

  it('does nothing without a transport', async () => {
    const ctx = await openTestRepo();
    await seedDevReference(ctx.db);
    const s = await ctx.repo.startTrip({ crewDeparted: 4, departureAt: ctx.deps.clock.now() });
    const open = () => Promise.resolve(ctx.repo);
    render(
      <LogbookProvider open={open}>
        <SyncLoop transport={null} intervalMs={5} />
      </LogbookProvider>,
    );
    await act(() => new Promise((r) => setTimeout(r, 50)));
    expect(await ctx.repo.getSyncState(s.id)).toBe('on_device');
  });

  it('acks become sent', async () => {
    const ctx = await openTestRepo();
    await seedDevReference(ctx.db);
    const s = await ctx.repo.startTrip({ crewDeparted: 4, departureAt: ctx.deps.clock.now() });
    const mock = createMockTransport();
    const open = () => Promise.resolve(ctx.repo);
    render(
      <LogbookProvider open={open}>
        <SyncLoop transport={mock.transport} intervalMs={10} />
      </LogbookProvider>,
    );
    // Open the store (effects flush when act ends), then let the loop run
    // and refresh the screens inside act.
    await act(async () => {});
    await act(() => new Promise((r) => setTimeout(r, 100)));
    expect(await ctx.repo.getSyncState(s.id)).toBe('sent');
  });
});
