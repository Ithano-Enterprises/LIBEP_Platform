import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';

import { createMockTransport } from '../data/sync/mockTransport';
import { strings } from '../i18n/strings';
import { palettes } from '../theme/tokens';
import {
  clearKeys,
  count,
  drain,
  esc,
  ledgerSnapshot,
  logAnother,
  logCatchUI,
  makeLocator,
  mountApp,
  press,
  saveCatchUI,
  seeded,
  sid,
  startTripUI,
  typeKeys,
} from './helpers';

// Area 1: end-to-end fisherman scenarios through AppScreens on a 360×740
// phone. Each test is one captain's story from a fresh store.

jest.mock('expo-network', () => ({
  useNetworkState: jest.fn(() => ({ isConnected: false, isInternetReachable: false })),
}));

const sw = strings.sw;
const MIN = 60_000;

/**
 * Calls a Pressable's onPress twice in the same frame, before React
 * re-renders. Returns what both calls settled to, so a rejected handler
 * is caught here instead of escaping the test.
 */
async function doubleTap(testID: string) {
  const host = screen.getByTestId(testID);
  // The host View's parent is the Pressable composite that owns onPress.
  let el: typeof host | null = host;
  while (el && typeof el.props.onPress !== 'function') el = el.parent;
  const onPress = el!.props.onPress as () => unknown;
  let calls: unknown[] = [];
  act(() => {
    calls = [onPress(), onPress()];
  });
  let settled: PromiseSettledResult<unknown>[] = [];
  await act(async () => {
    settled = await Promise.allSettled(calls);
  });
  return settled.filter((r): r is PromiseRejectedResult => r.status === 'rejected').map((r) => String(r.reason));
}

describe('1a normal day', () => {
  it('start → 6 catches → correction → close → sync → plant weight → corrections closed', async () => {
    const ctx = await seeded();
    const { locator } = makeLocator();
    const r = mountApp(ctx, { locator });
    await screen.findByText(sw.startToLog);

    await startTripUI(1);
    const trip = (await ctx.repo.getOpenTrip())!;
    expect(trip.crew_count).toBe(5);

    const catches: [string, string][] = [
      ['tewa', '2.4'],
      ['nguru', '1.2'],
      ['kibua', '18'],
      ['tafi', '0.5'],
      ['changu', '3'],
      ['mzia', '0.8'],
    ];
    press('primary');
    for (const [i, [fish, t]] of catches.entries()) {
      ctx.deps.tick(20 * MIN);
      await saveCatchUI(fish, t);
      if (i < catches.length - 1) await logAnother();
    }
    press('view-list');
    await screen.findByTestId('trip-total');
    // 2.4 + 1.2 + 18 + 0.5 + 3 + 0.8 = 25.9
    expect(screen.getByTestId('trip-total')).toHaveTextContent(esc('25.9 t'));
    expect(await count(ctx.db, 'catches', 'trip_id = ?', [trip.trip_id])).toBe(6);

    // Correction 18 → 1.8.
    const kibua = (await ctx.repo.listTripEntries(trip.trip_id)).find((e) => e.species_local_name === 'kibua')!;
    press(`entry-${kibua.id}`);
    await screen.findByTestId('detail-species');
    press('correct');
    await screen.findByTestId('correct-sheet');
    clearKeys();
    typeKeys('1.8');
    press('correct-save');
    await waitFor(() => expect(screen.getByTestId('detail-estimate')).toHaveTextContent(esc('1.8')));
    press('back');
    await screen.findByTestId('trip-total');
    expect(screen.getByTestId('trip-total')).toHaveTextContent(esc('9.7 t'));

    // Close.
    ctx.deps.tick(2 * 60 * MIN);
    press('close-trip');
    await screen.findByTestId('close-total');
    expect(screen.getByTestId('close-total')).toHaveTextContent(esc('9.7'));
    press('submit');
    await screen.findByTestId('read-only');
    const close = (await ctx.repo.getTripClose(trip.trip_id))!;
    expect(close.total_quantity).toBe(9.7);
    expect(close.catch_ids).toHaveLength(6);
    press('back');
    await screen.findByText(sw.startToLog);

    // Sync: everything of this trip goes, in dependency order.
    const mock = createMockTransport();
    const q = ctx.repo.syncQueue(mock.transport);
    const out = await drain(q);
    expect(out[out.length - 1].kind).toBe('idle');
    const kinds = mock.batches.flatMap((b) => b.records.filter((x) => x.data.trip_id === trip.trip_id || x.kind === 'catch_correction').map((x) => x.kind));
    expect(kinds.indexOf('trip_start')).toBeLessThan(kinds.indexOf('catch'));
    expect(kinds.lastIndexOf('catch')).toBeLessThan(kinds.indexOf('catch_correction'));
    expect(kinds.indexOf('catch_correction')).toBeLessThan(kinds.indexOf('trip_close'));
    for (const e of await ctx.repo.listTripEntries(trip.trip_id)) expect(e.sync_state).toBe('sent');

    // Plant weighs the tewa.
    const tewa = (await ctx.repo.listTripEntries(trip.trip_id)).find((e) => e.species_local_name === 'tewa')!;
    await q.applyFeed({
      weighings: [
        { id: '11111111-1111-4111-8111-111111111111', trip_id: trip.trip_id, species_id: sid('tewa'), catch_id: tewa.id, weight: 2.2, unit: 't', weighed_at: ctx.deps.clock.now().toISOString() },
      ],
    });
    await expect(
      ctx.repo.correctCatch({ catchId: tewa.id, previousCorrectionId: null, quantity: 2.0 }),
    ).rejects.toMatchObject({ code: 'corrections_closed' });

    // App reopened: the weighed entry shows W and no Sahihisha.
    r.unmount();
    mountApp(ctx, { locator });
    await screen.findByText(sw.startToLog);
    press('prev-toggle');
    press(`prev-trip-${trip.trip_id}`);
    press(`prev-entry-${tewa.id}`);
    await screen.findByTestId('detail-species');
    expect(screen.getByTestId('detail-actual')).toHaveTextContent(esc('2.2'));
    expect(screen.queryByTestId('correct')).toBeNull();
    expect(screen.getByTestId('corr-closed')).toBeTruthy();
  });
});

describe('1b captain who looks but does not start', () => {
  it('opens S1 from an empty home and goes back: no trip row, no sync row', async () => {
    const ctx = await seeded();
    mountApp(ctx);
    await screen.findByText(sw.startToLog);
    const trips = await count(ctx.db, 'trip_starts');
    const syncRows = await count(ctx.db, 'sync_state');
    press('primary');
    await screen.findByTestId('crew-stepper');
    press('crew-plus');
    press('back');
    await screen.findByText(sw.startToLog);
    expect(await count(ctx.db, 'trip_starts')).toBe(trips);
    expect(await count(ctx.db, 'sync_state')).toBe(syncRows);
    expect(await ctx.repo.getOpenTrip()).toBeNull();
    // Primary still offers "Anza safari".
    expect(screen.getByTestId('primary')).toHaveTextContent(sw.startTrip);
  });
});

describe('1c double taps', () => {
  it('start trip tapped twice (one after the other): one trip', async () => {
    const ctx = await seeded();
    mountApp(ctx);
    await screen.findByText(sw.startToLog);
    press('primary');
    await screen.findByTestId('crew-stepper');
    press('primary');
    press('primary');
    await screen.findByTestId('trip-total');
    expect(await count(ctx.db, 'trip_starts', "trip_id NOT IN (SELECT trip_id FROM trip_closes)")).toBe(1);
  });

  // BUG-1 (fixed): a double tap on "Anza safari" within one frame ran
  // startTrip twice. S1 now ignores taps while saving (a ref) and the
  // repository checks for an open trip inside the write transaction.
  it('start trip double tap in one frame: exactly one open trip', async () => {
    const ctx = await seeded();
    mountApp(ctx);
    await screen.findByText(sw.startToLog);
    press('primary');
    await screen.findByTestId('crew-stepper');
    const errors = await doubleTap('primary');
    expect(errors).toEqual([]);
    await screen.findByTestId('trip-total');
    expect(await count(ctx.db, 'trip_starts', "trip_id NOT IN (SELECT trip_id FROM trip_closes)")).toBe(1);
  });

  it('save tapped twice (one after the other): one catch', async () => {
    const ctx = await seeded();
    mountApp(ctx);
    await screen.findByText(sw.startToLog);
    await startTripUI();
    press('primary');
    await screen.findByTestId('fish-tewa');
    press('fish-tewa');
    typeKeys('2.4');
    press('save');
    press('save');
    await screen.findByTestId('confirm-card');
    const trip = (await ctx.repo.getOpenTrip())!;
    expect(await count(ctx.db, 'catches', 'trip_id = ?', [trip.trip_id])).toBe(1);
  });

  it('save double tap in one frame: one catch, no error shown', async () => {
    const ctx = await seeded();
    mountApp(ctx);
    await screen.findByText(sw.startToLog);
    await startTripUI();
    press('primary');
    await screen.findByTestId('fish-tewa');
    press('fish-tewa');
    typeKeys('2.4');
    expect(await doubleTap('save')).toEqual([]);
    await screen.findByTestId('confirm-card');
    expect(screen.queryByText(/transaction|SQLITE|constraint/i)).toBeNull();
    const trip = (await ctx.repo.getOpenTrip())!;
    expect(await count(ctx.db, 'catches', 'trip_id = ?', [trip.trip_id])).toBe(1);
  });

  it('Tuma tapped twice (one after the other): one trip_close, no error shown', async () => {
    const ctx = await seeded();
    mountApp(ctx);
    await screen.findByText(sw.startToLog);
    await startTripUI();
    await logCatchUI('tewa', '1');
    press('close-trip');
    await screen.findByTestId('submit');
    press('submit');
    press('submit');
    await screen.findByTestId('read-only');
    expect(await count(ctx.db, 'trip_closes')).toBe(2); // the seeded previous trip + this one
  });

  it('Tuma double tap in one frame: one trip_close and no error text', async () => {
    const ctx = await seeded();
    mountApp(ctx);
    await screen.findByText(sw.startToLog);
    await startTripUI();
    await logCatchUI('tewa', '1');
    press('close-trip');
    await screen.findByTestId('submit');
    const trip = (await ctx.repo.getOpenTrip())!;
    expect(await doubleTap('submit')).toEqual([]);
    await screen.findByTestId('read-only');
    expect(await count(ctx.db, 'trip_closes', 'trip_id = ?', [trip.trip_id])).toBe(1);
    expect(screen.queryByText(/no_open_trip|UNIQUE|constraint/i)).toBeNull();
  });
});

describe('1d app killed mid-trip', () => {
  it('unmount/remount between every step: state survives, nothing duplicated', async () => {
    const ctx = await seeded();
    const { locator } = makeLocator();
    let r = mountApp(ctx, { locator });
    const restart = async () => {
      r.unmount();
      r = mountApp(ctx, { locator });
      await screen.findByTestId('primary');
    };
    await screen.findByText(sw.startToLog);
    await startTripUI();
    await restart();
    await screen.findByTestId('trip-total');
    const trip = (await ctx.repo.getOpenTrip())!;

    for (const [fish, t] of [['tewa', '2.4'], ['nguru', '1.2'], ['kibua', '3']] as const) {
      ctx.deps.tick(15 * MIN);
      await logCatchUI(fish, t);
      await restart();
    }
    expect(screen.getByTestId('trip-total')).toHaveTextContent(esc('6.6 t'));

    // Killed with the sheet open and a figure typed: nothing saved.
    press('primary');
    await screen.findByTestId('fish-tafi');
    press('fish-tafi');
    typeKeys('9');
    await restart();
    expect(await count(ctx.db, 'catches', 'trip_id = ?', [trip.trip_id])).toBe(3);

    // Correction, then restart.
    const nguru = (await ctx.repo.listTripEntries(trip.trip_id)).find((e) => e.species_local_name === 'nguru')!;
    press(`entry-${nguru.id}`);
    await screen.findByTestId('detail-species');
    press('correct');
    clearKeys();
    typeKeys('2.1');
    press('correct-save');
    await waitFor(() => expect(screen.getByTestId('detail-estimate')).toHaveTextContent(esc('2.1')));
    await restart();
    expect(screen.getByTestId('trip-total')).toHaveTextContent(esc('7.5 t'));

    // Close, then restart.
    press('close-trip');
    await screen.findByTestId('submit');
    press('submit');
    await screen.findByTestId('read-only');
    await restart();
    await screen.findByText(sw.startToLog);

    expect(await count(ctx.db, 'trip_starts', 'trip_id = ?', [trip.trip_id])).toBe(1);
    expect(await count(ctx.db, 'catches', 'trip_id = ?', [trip.trip_id])).toBe(3);
    expect(await count(ctx.db, 'catch_corrections')).toBe(1);
    expect(await count(ctx.db, 'trip_closes', 'trip_id = ?', [trip.trip_id])).toBe(1);
    expect(await count(ctx.db, 'sync_state')).toBe(await count(ctx.db, 'trip_starts') + (await count(ctx.db, 'catches')) + 1 + (await count(ctx.db, 'trip_closes')));
  });

  // BUG-3 (fixed): language and Night/Day were held in memory only and fell
  // back to Kiswahili/Night after a restart. PreferencesProvider now reads
  // and writes them through repo.get/setPreference (contract §4).
  it('language and mode chosen by the captain survive a restart', async () => {
    const ctx = await seeded();
    let r = mountApp(ctx);
    await screen.findByText(sw.startToLog);
    press('toggle-lang');
    press('toggle-mode');
    await screen.findByText(strings.en.startToLog);
    r.unmount();
    r = mountApp(ctx);
    await screen.findByTestId('primary');
    expect(screen.getByText(strings.en.startToLog)).toBeTruthy();
    expect(screen.getByTestId('screen')).toHaveStyle({ backgroundColor: palettes.day.bg });
  });
});

describe('1e offline the whole trip, sync next morning, second trip same day', () => {
  it('every send fails at sea; the next morning everything goes; a second trip follows', async () => {
    const ctx = await seeded();
    mountApp(ctx);
    await screen.findByText(sw.startToLog);
    await startTripUI();
    const trip1 = (await ctx.repo.getOpenTrip())!;
    const offline = createMockTransport(Array(20).fill('offline'));
    const q1 = ctx.repo.syncQueue(offline.transport);
    for (const [fish, t] of [['tewa', '2'], ['nguru', '1.5'], ['tafi', '0.7']] as const) {
      ctx.deps.tick(30 * MIN);
      await logCatchUI(fish, t);
      const o = await q1.runOnce();
      expect(o.kind).toBe('retry');
    }
    press('close-trip');
    await screen.findByTestId('submit');
    press('submit');
    await screen.findByTestId('read-only');
    press('back');
    await screen.findByText(sw.startToLog);
    expect(offline.stored.size).toBe(0);
    for (const e of await ctx.repo.listTripEntries(trip1.trip_id)) expect(e.sync_state).toBe('waiting');

    // Next morning, signal at the jetty.
    ctx.deps.tick(14 * 60 * MIN);
    const online = createMockTransport();
    const q = ctx.repo.syncQueue(online.transport);
    await drain(q);
    for (const e of await ctx.repo.listTripEntries(trip1.trip_id)) expect(e.sync_state).toBe('sent');
    expect(await ctx.repo.getSyncState((await ctx.repo.getTripClose(trip1.trip_id))!.id)).toBe('sent');

    // Second trip the same day.
    await startTripUI();
    const trip2 = (await ctx.repo.getOpenTrip())!;
    expect(trip2.trip_id).not.toBe(trip1.trip_id);
    await logCatchUI('kibua', '4');
    // Trip 2's total does not include trip 1.
    expect(screen.getByTestId('trip-total')).toHaveTextContent(esc('4.0 t'));
    press('close-trip');
    await screen.findByTestId('close-total');
    expect(screen.getByTestId('close-total')).toHaveTextContent(esc('4.0'));
    press('submit');
    await screen.findByTestId('read-only');
    await drain(q);
    expect(await q.pending()).toHaveLength(0);
    for (const e of await ctx.repo.listTripEntries(trip2.trip_id)) expect(e.sync_state).toBe('sent');
  });
});

describe('1f very long trip', () => {
  it('200 catches: list, total and close summary stay correct and render in reasonable time', async () => {
    const ctx = await seeded();
    const trip = await ctx.repo.startTrip({ crewCount: 6, departureAt: ctx.deps.clock.now() });
    const menu = ['changu', 'tafi', 'tewa', 'nguru', 'kibua', 'mzia', 'kolekole'];
    let tenths = 0;
    for (let i = 0; i < 200; i++) {
      ctx.deps.tick(MIN);
      const q = ((i % 30) + 1) / 10; // 0.1 … 3.0
      tenths += Math.round(q * 10);
      await ctx.repo.logCatch({ speciesId: sid(menu[i % menu.length]), quantity: q, gps: { latitude: -2.2 - (i % 9) / 100, longitude: 41 + (i % 7) / 100, gps_accuracy_m: 10 } });
    }
    const total = (tenths / 10).toFixed(1);

    const t0 = Date.now();
    mountApp(ctx);
    await screen.findByTestId('trip-total');
    const homeMs = Date.now() - t0;
    expect(screen.getByTestId('trip-total')).toHaveTextContent(esc(`${total} t`));
    expect(screen.getAllByTestId(/^entry-/)).toHaveLength(200);
    expect(homeMs).toBeLessThan(8000);

    // One more through the UI on top of 200.
    await logCatchUI('tewa', '1');
    expect(screen.getByTestId('trip-total')).toHaveTextContent(esc(`${(tenths / 10 + 1).toFixed(1)} t`));

    const t1 = Date.now();
    press('close-trip');
    await screen.findByTestId('close-total');
    expect(Date.now() - t1).toBeLessThan(8000);
    expect(screen.getByTestId('close-total')).toHaveTextContent(esc((tenths / 10 + 1).toFixed(1)));
    // Top 3 by type, then "Zaidi (+4)".
    expect(screen.getAllByTestId(/^type-/)).toHaveLength(3);
    expect(screen.getByTestId('types-toggle')).toHaveTextContent(`${sw.more} (+4)`);
    press('types-toggle');
    expect(screen.getAllByTestId(/^type-/)).toHaveLength(7);
    press('submit');
    await screen.findByTestId('read-only');
    const close = (await ctx.repo.getTripClose(trip.trip_id))!;
    expect(close.catch_ids).toHaveLength(201);
    expect(close.total_quantity).toBe(tenths / 10 + 1);
  });
});

describe('1g languages and modes all the way through', () => {
  const run = (lang: 'sw' | 'en', mode: 'night' | 'day') =>
    async () => {
      const t = strings[lang];
      const c = palettes[mode];
      const ctx = await seeded();
      mountApp(ctx, { lang, mode });
      await screen.findByText(t.startToLog);
      expect(screen.getByTestId('screen')).toHaveStyle({ backgroundColor: c.bg });
      press('primary');
      await screen.findByTestId('crew-stepper');
      expect(screen.getByTestId('screen')).toHaveStyle({ backgroundColor: c.bg });
      press('primary');
      await screen.findByTestId('trip-total');
      expect(screen.getByTestId('primary')).toHaveTextContent(t.logCatch);
      press('primary');
      await screen.findByTestId('fish-tewa');
      expect(screen.getByTestId('screen')).toHaveStyle({ backgroundColor: c.bg });
      expect(screen.getByTestId('search').props.placeholder).toBe(t.search);
      // Fish names stay the local name in both languages.
      expect(screen.getByTestId('fish-tewa')).toHaveTextContent(/tewa/);
      await saveCatchUI('tewa', '2');
      expect(screen.getByText(t.savedTitle)).toBeTruthy();
      press('view-list');
      await screen.findByTestId('trip-total');
      press('close-trip');
      await screen.findByTestId('submit');
      expect(screen.getByTestId('submit')).toHaveTextContent(t.submit);
      expect(screen.getByTestId('screen')).toHaveStyle({ backgroundColor: c.bg });
      press('submit');
      await screen.findByText(t.readOnly);
      press('back');
      await screen.findByText(t.startToLog);
      press('open-grounds');
      await screen.findByText(t.groundsTitle);
      expect(screen.getByTestId('screen')).toHaveStyle({ backgroundColor: c.bg });
    };
  it('Kiswahili + Night', run('sw', 'night'));
  it('English + Day', run('en', 'day'));
  it('Kiswahili + Day', run('sw', 'day'));
  it('English + Night', run('en', 'night'));

  it('switching language mid-trip keeps the entries and the totals', async () => {
    const ctx = await seeded();
    mountApp(ctx);
    await screen.findByText(sw.startToLog);
    await startTripUI();
    await logCatchUI('tewa', '2.5');
    const before = await ledgerSnapshot(ctx.db);
    press('toggle-lang');
    press('toggle-mode');
    await screen.findByText(strings.en.trip);
    expect(screen.getByTestId('trip-total')).toHaveTextContent(esc('2.5 t'));
    expect(within(screen.getByTestId('screen')).getByText('tewa')).toBeTruthy();
    expect(await ledgerSnapshot(ctx.db)).toEqual(before);
    fireEvent.press(screen.getByTestId('toggle-lang'));
    await screen.findByText(sw.trip);
  });
});
