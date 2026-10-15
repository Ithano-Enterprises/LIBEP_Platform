import { screen, waitFor } from '@testing-library/react-native';

import type { GroundsCatch } from '../data/types';
import { devLandingSite } from '../dev/fixtures/reference';
import { seedDevReference } from '../dev/fixtures/seed';
import { strings } from '../i18n/strings';
import { buildGrounds, DAY_MS, rankSpots, spotEntries, type Filters } from '../screens/grounds/model';
import { openTestRepo } from '../test/sqlite';
import { mountApp, press, sid } from './helpers';

// Area 6: My grounds (S5). Model rules with known data, then the screen.

jest.mock('expo-network', () => ({
  useNetworkState: jest.fn(() => ({ isConnected: false, isInternetReachable: false })),
}));

const sw = strings.sw;
const NOW = new Date('2026-03-15T12:00:00Z');
const A = { latitude: -2.27, longitude: 40.93 };
const B = { latitude: -2.3, longitude: 41.0 };
const C = { latitude: -2.2, longitude: 41.1 };
const at = (days: number) => new Date(NOW.getTime() - days * DAY_MS).toISOString();

let n = 0;
function gc(trip: string, days: number, pos: { latitude: number; longitude: number } | null, species: string, q: number, extra: Partial<GroundsCatch> = {}): GroundsCatch {
  n += 1;
  return {
    id: `c${n}`,
    trip_id: trip,
    species_id: sid(species),
    species_local_name: species,
    hold_code: null,
    quantity: q,
    latitude: pos?.latitude ?? null,
    longitude: pos?.longitude ?? null,
    recorded_at: at(days),
    sync_state: 'sent',
    trip_closed_at: at(days - 0.25),
    plant_weight_t: null,
    ...extra,
  };
}

// t1 −5 d, t2 −20 d, t3 −60 d (all Kaskazi), t4 −200 d (Kusi).
const CATCHES: GroundsCatch[] = [
  gc('t1', 5, A, 'tewa', 1.0),
  gc('t1', 5, A, 'nguru', 2.0),
  gc('t1', 5, null, 'tafi', 0.7), // no GPS
  gc('t2', 20, A, 'tewa', 1.0),
  gc('t2', 20, B, 'kibua', 10.0),
  gc('t2', 20, A, 'tewa', 4.0, { trip_closed_at: at(21) }), // saved after the trip closed
  gc('t3', 60, B, 'kibua', 5.0),
  gc('t3', 60, C, 'tewa', 0.5),
  gc('t4', 200, C, 'tewa', 3.0),
];

const grounds = (f: Partial<Filters>) => buildGrounds(CATCHES, { now: NOW, range: '90', species: [], season: 'all', ...f });
const byKey = (g: ReturnType<typeof grounds>) => Object.fromEntries(g.spots.map((s) => [`${Math.round(s.lat * 100)}:${Math.round(s.lon * 100)}`, s]));

describe('grounds model', () => {
  it('excludes no-GPS entries and entries saved after the trip closed, and lists why', () => {
    const g = grounds({ range: 'all' });
    expect(g.excluded.map((e) => [e.catch.species_local_name, e.reason]).sort()).toEqual([
      ['tafi', 'no_gps'],
      ['tewa', 'after_close'],
    ]);
    for (const s of g.spots) expect(s.catchIds).not.toContain(g.excluded[0].catch.id);
  });

  it.each([
    ['30', 14.0, 2, { '-227:4093': [2, 4.0], '-230:4100': [1, 10.0] }],
    ['90', 19.5, 3, { '-227:4093': [2, 4.0], '-230:4100': [2, 15.0], '-220:4110': [1, 0.5] }],
    ['season', 19.5, 3, { '-227:4093': [2, 4.0], '-230:4100': [2, 15.0], '-220:4110': [1, 0.5] }],
    ['all', 22.5, 4, { '-227:4093': [2, 4.0], '-230:4100': [2, 15.0], '-220:4110': [2, 3.5] }],
  ] as const)('range %s: total %p over %p trips, per-spot trips and tonnes', (range, total, trips, spots) => {
    const g = grounds({ range });
    expect(g.totalT).toBe(total);
    expect(g.tripCount).toBe(trips);
    const k = byKey(g);
    expect(Object.keys(k).sort()).toEqual(Object.keys(spots).sort());
    for (const [key, [tr, t]] of Object.entries(spots)) expect([k[key].trips, k[key].t]).toEqual([tr, t]);
  });

  it('season filter: Kaskazi and Kusi split the catches', () => {
    expect(grounds({ range: 'all', season: 'kaskazi' }).totalT).toBe(19.5);
    expect(grounds({ range: 'all', season: 'kusi' }).totalT).toBe(3.0);
    expect(grounds({ range: '90', season: 'kusi' }).spots).toHaveLength(0);
  });

  it('species filter keeps only those species, in spots and in the excluded list', () => {
    const g = grounds({ range: '90', species: [sid('kibua')] });
    expect(g.spots.map((s) => s.bySpecies.map((x) => x.name))).toEqual([['kibua']]);
    expect(g.totalT).toBe(15.0);
    expect(g.excluded).toHaveLength(0);
    const g2 = grounds({ range: 'all', species: [sid('tewa'), sid('tafi')] });
    expect(g2.totalT).toBe(5.5); // tewa 1 + 1 + 0.5 + 3; the after-close tewa is off the map
    expect(g2.excluded).toHaveLength(2);
  });

  it.each(['30', '90', 'season', 'all'] as const)('range %s: spot totals add up to the grand total and to the catches on the map', (range) => {
    for (const species of [[], [sid('tewa')], [sid('kibua'), sid('nguru')]]) {
      const g = grounds({ range, species });
      const sumSpots = Math.round(g.spots.reduce((a, s) => a + s.t * 10, 0)) / 10;
      expect(sumSpots).toBe(g.totalT);
      const onMap = new Set(g.spots.flatMap((s) => s.catchIds));
      const sumCatches = Math.round(CATCHES.filter((c) => onMap.has(c.id)).reduce((a, c) => a + c.quantity * 10, 0)) / 10;
      expect(sumCatches).toBe(g.totalT);
      for (const s of g.spots) {
        expect(Math.round(s.bySpecies.reduce((a, x) => a + x.t * 10, 0)) / 10).toBe(s.t);
        expect(spotEntries(CATCHES, s).map((c) => c.id).sort()).toEqual([...s.catchIds].sort());
      }
    }
  });

  it('the metric toggle reorders: by trips then by tonnes', () => {
    const g = grounds({ range: '30' });
    expect(rankSpots(g.spots, 'trips').map((s) => s.t)).toEqual([4.0, 10.0]);
    expect(rankSpots(g.spots, 'tonnes').map((s) => s.t)).toEqual([10.0, 4.0]);
  });
});

/** A store with reference data only, and closed trips with the given catches, oldest first. */
async function history(trips: { daysAgo: number; catches: [string, number, { latitude: number; longitude: number } | null][] }[]) {
  const ctx = await openTestRepo();
  await seedDevReference(ctx.db);
  const sorted = [...trips].sort((a, b) => b.daysAgo - a.daysAgo);
  const maxDays = Math.max(...trips.map((t) => t.daysAgo));
  let shift = 0;
  for (const t of sorted) {
    ctx.deps.tick((maxDays - t.daysAgo) * DAY_MS - shift);
    shift = (maxDays - t.daysAgo) * DAY_MS;
    const s = await ctx.repo.startTrip({ crewCount: 4, departureAt: ctx.deps.clock.now() });
    for (const [species, q, pos] of t.catches) {
      ctx.deps.tick(60_000);
      shift += 60_000;
      await ctx.repo.logCatch({ speciesId: sid(species), quantity: q, gps: pos && { ...pos, gps_accuracy_m: 10 } });
    }
    await ctx.repo.closeTrip({ tripId: s.trip_id, arrivalAt: ctx.deps.clock.now(), crewCount: 4, landingSiteId: devLandingSite.id, distanceKm: null });
  }
  ctx.deps.tick(60_000);
  return ctx;
}

const spotOrder = () => screen.getAllByTestId(/^spot-(?!value)/).map((e) => e.props.testID as string);

describe('My grounds screen', () => {
  // BUG-10: My grounds reads every catch on the device. listGroundsCatches
  // (and countTrips) do not filter by the linked captain, so if a device is
  // handed to another captain, their spots show on "my" map ("Ni wewe tu
  // unayeona ramani hii"). [TO CONFIRM: can a device change captain in Phase 1]
  it.failing('own data only: catches logged on this device by another captain are not on my map', async () => {
    const ctx = await history([{ daysAgo: 3, catches: [['tewa', 1, A]] }]);
    // The device is handed to another captain for one trip.
    const other = '9a9a9a9a-0000-4000-8000-000000000001';
    await ctx.db.runAsync("INSERT INTO captains (id, display_name) VALUES (?, 'Other')", [other]);
    const mine = (await ctx.db.getFirstAsync<{ captain_id: string }>('SELECT captain_id FROM device_profile', []))!.captain_id;
    await ctx.db.runAsync('UPDATE device_profile SET captain_id = ?', [other]);
    const s = await ctx.repo.startTrip({ crewCount: 4, departureAt: ctx.deps.clock.now() });
    await ctx.repo.logCatch({ speciesId: sid('kibua'), quantity: 9, gps: { ...B, gps_accuracy_m: 5 } });
    await ctx.repo.closeTrip({ tripId: s.trip_id, arrivalAt: ctx.deps.clock.now(), crewCount: 4, landingSiteId: devLandingSite.id, distanceKm: null });
    await ctx.db.runAsync('UPDATE device_profile SET captain_id = ?', [mine]);
    const catches = await ctx.repo.listGroundsCatches();
    expect(catches.map((c) => c.species_local_name)).toEqual(['tewa']);
  });

  it('empty state below 3 trips ("2 / 3"); the map appears at 3', async () => {
    const ctx = await history([
      { daysAgo: 10, catches: [['tewa', 1, A]] },
      { daysAgo: 5, catches: [['nguru', 2, B]] },
    ]);
    const r = mountApp(ctx);
    press(await (async () => (await screen.findByTestId('open-grounds'), 'open-grounds'))());
    await screen.findByTestId('grounds-empty');
    expect(screen.getByTestId('grounds-progress')).toHaveTextContent('2 / 3');
    expect(screen.getByText(sw.empty)).toBeTruthy();
    expect(screen.queryByTestId('grounds-panel')).toBeNull();
    press('grounds-back-trip');
    await screen.findByTestId('primary');
    r.unmount();

    await ctx.repo.startTrip({ crewCount: 4, departureAt: ctx.deps.clock.now() });
    await ctx.repo.logCatch({ speciesId: sid('kibua'), quantity: 1, gps: { ...C, gps_accuracy_m: 5 } });
    mountApp(ctx);
    press(await (async () => (await screen.findByTestId('open-grounds'), 'open-grounds'))());
    await screen.findByTestId('grounds-panel');
    expect(screen.queryByTestId('grounds-empty')).toBeNull();
  });

  it('metric toggle reorders the top spots on screen', async () => {
    const ctx = await history([
      { daysAgo: 12, catches: [['tewa', 0.5, A]] },
      { daysAgo: 8, catches: [['tewa', 0.5, A]] },
      { daysAgo: 4, catches: [['kibua', 9, B]] },
    ]);
    mountApp(ctx);
    press(await (async () => (await screen.findByTestId('open-grounds'), 'open-grounds'))());
    await screen.findByTestId('grounds-panel');
    press('grounds-expand');
    const byTrips = spotOrder();
    expect(byTrips).toEqual(['spot--227:4093', 'spot--230:4100']);
    press('metric-tonnes');
    expect(spotOrder()).toEqual(['spot--230:4100', 'spot--227:4093']);
    expect(screen.getByTestId('spot-value--230:4100')).toHaveTextContent(/9\.0/);
    expect(screen.getByTestId('grounds-total')).toHaveTextContent('10.0 t');
  });

  it('filters change the totals: range, species and season through the sheet', async () => {
    const ctx = await history([
      { daysAgo: 200, catches: [['tewa', 3, C]] },
      { daysAgo: 60, catches: [['kibua', 5, B], ['tewa', 0.5, C]] },
      { daysAgo: 20, catches: [['tewa', 1, A], ['kibua', 10, B]] },
      { daysAgo: 5, catches: [['tewa', 1, A], ['nguru', 2, A], ['tafi', 0.7, null]] },
    ]);
    mountApp(ctx);
    press(await (async () => (await screen.findByTestId('open-grounds'), 'open-grounds'))());
    await screen.findByTestId('grounds-panel');
    expect(screen.getByTestId('grounds-total')).toHaveTextContent(/^19\.5 t$/); // default 90 days
    expect(screen.getByTestId('grounds-excluded')).toHaveTextContent(sw.excludedN.replace('{n}', '1'));

    press('chip-range');
    await screen.findByTestId('flt-sheet');
    press('flt-range-all');
    press('flt-apply');
    await waitFor(() => expect(screen.getByTestId('grounds-total')).toHaveTextContent(/^22\.5 t$/));

    press('chip-range');
    await screen.findByTestId('flt-sheet');
    press('flt-range-30');
    press('flt-apply');
    await waitFor(() => expect(screen.getByTestId('grounds-total')).toHaveTextContent(/^14\.0 t$/));

    press('chip-species');
    await screen.findByTestId('flt-sheet');
    press('flt-range-all');
    press('flt-species-kibua');
    press('flt-apply');
    await waitFor(() => expect(screen.getByTestId('grounds-total')).toHaveTextContent(/^15\.0 t$/));
    expect(screen.queryByTestId('grounds-excluded')).toBeNull();

    // The store's clock runs from 1 Jan: only the oldest trip (tewa 3 t) is in Kaskazi.
    press('chip-season');
    await screen.findByTestId('flt-sheet');
    press('flt-species-all');
    press('flt-season-kaskazi');
    press('flt-apply');
    await waitFor(() => expect(screen.getByTestId('grounds-total')).toHaveTextContent(/^3\.0 t$/));
  });

  it('the filter sheet shows a live count before applying, and closing it changes nothing', async () => {
    const ctx = await history([
      { daysAgo: 200, catches: [['tewa', 3, C]] },
      { daysAgo: 60, catches: [['kibua', 5, B]] },
      { daysAgo: 20, catches: [['tewa', 1, A]] },
    ]);
    mountApp(ctx);
    press(await (async () => (await screen.findByTestId('open-grounds'), 'open-grounds'))());
    await screen.findByTestId('grounds-panel');
    const total = screen.getByTestId('grounds-total').props.children;
    press('chip-range');
    await screen.findByTestId('flt-sheet');
    const before = screen.getByTestId('flt-count').props.children;
    press('flt-range-all');
    await waitFor(() => expect(screen.getByTestId('flt-count').props.children).not.toEqual(before));
    press('flt-close');
    await waitFor(() => expect(screen.queryByTestId('flt-sheet')).toBeNull());
    expect(screen.getByTestId('grounds-total').props.children).toEqual(total);
  });
});
