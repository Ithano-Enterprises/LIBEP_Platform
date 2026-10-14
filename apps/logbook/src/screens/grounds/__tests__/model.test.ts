import type { GroundsCatch } from '../../../data/types';
import { project } from '../basemap';
import { buildGrounds, daysAgo, exclusion, formatCoord, heatStep, rankSpots } from '../model';

const NOW = new Date('2026-10-14T06:00:00Z');
const day = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();
let n = 0;
const c = (o: Partial<GroundsCatch>): GroundsCatch => ({
  id: `c${++n}`,
  trip_id: 't1',
  species_id: 'tewa',
  species_local_name: 'tewa',
  hold_code: 'A',
  quantity: 1,
  latitude: -2.27,
  longitude: 41.03,
  recorded_at: day(1),
  sync_state: 'sent',
  trip_closed_at: null,
  plant_weight_t: null,
  ...o,
});

describe('grounds model', () => {
  it('groups catches into cells: trips, total, average, species, last fished', () => {
    const g = buildGrounds(
      [
        c({ trip_id: 'a', quantity: 2.4, recorded_at: day(1) }),
        c({ trip_id: 'a', quantity: 0.1, latitude: -2.2701, species_id: 'kibua', species_local_name: 'kibua' }),
        c({ trip_id: 'b', quantity: 0.2, recorded_at: day(5) }),
        c({ trip_id: 'b', quantity: 3, latitude: -2.19, longitude: 41.06 }),
      ],
      { now: NOW, range: '90', species: [] },
    );
    expect(g.tripCount).toBe(2);
    expect(g.totalT).toBe(5.7);
    const s = g.spots.find((x) => x.key === '-227:4103')!;
    expect(s).toMatchObject({ trips: 2, t: 2.7, avg: 1.4, lastAt: day(1) });
    expect(s.bySpecies.map((x) => [x.name, x.t])).toEqual([
      ['tewa', 2.6],
      ['kibua', 0.1],
    ]);
    expect(s.lat).toBeCloseTo(-2.27);
    expect(s.lon).toBeCloseTo(41.03);
  });

  it('leaves out entries with no position or saved after the trip closed', () => {
    expect(exclusion(c({ latitude: null, longitude: null }))).toBe('no_gps');
    expect(exclusion(c({ trip_closed_at: day(2), recorded_at: day(1) }))).toBe('after_close');
    expect(exclusion(c({ trip_closed_at: day(1), recorded_at: day(2) }))).toBeNull();
    const g = buildGrounds([c({}), c({ latitude: null, longitude: null, quantity: 0.4 })], {
      now: NOW,
      range: '90',
      species: [],
    });
    expect(g.excluded.map((e) => e.reason)).toEqual(['no_gps']);
    expect(g.totalT).toBe(1);
  });

  it('range and species filters', () => {
    const all = [
      c({ recorded_at: day(10) }),
      c({ recorded_at: day(60), species_id: 'kibua', species_local_name: 'kibua', quantity: 2 }),
      c({ recorded_at: day(120), quantity: 5 }),
    ];
    expect(buildGrounds(all, { now: NOW, range: '30', species: [] }).totalT).toBe(1);
    expect(buildGrounds(all, { now: NOW, range: '90', species: [] }).totalT).toBe(3);
    expect(buildGrounds(all, { now: NOW, range: 'all', species: [] }).totalT).toBe(8);
    expect(buildGrounds(all, { now: NOW, range: 'all', species: ['kibua'] }).totalT).toBe(2);
  });

  it('plant weight counts only weighed catches of closed trips', () => {
    const g = buildGrounds(
      [
        c({ trip_id: 'a', trip_closed_at: day(0), plant_weight_t: 2.2, quantity: 2.4 }),
        c({ trip_id: 'b', plant_weight_t: 9, quantity: 1 }), // open trip: never W
        c({ trip_id: 'c', trip_closed_at: day(0), quantity: 1 }),
      ],
      { now: NOW, range: '90', species: [] },
    );
    expect(g.spots[0]).toMatchObject({ trips: 3, plantT: 2.2, plantTrips: 1 });
  });

  it('ranks by the chosen metric, ties broken by the other', () => {
    const g = buildGrounds(
      [
        c({ trip_id: 'a', quantity: 1, latitude: -2.0 }),
        c({ trip_id: 'b', quantity: 1, latitude: -2.0 }),
        c({ trip_id: 'a', quantity: 9, latitude: -2.1 }),
        c({ trip_id: 'a', quantity: 1, latitude: -2.2 }),
        c({ trip_id: 'b', quantity: 2, latitude: -2.2 }),
      ],
      { now: NOW, range: '90', species: [] },
    );
    expect(rankSpots(g.spots, 'trips').map((s) => s.key)).toEqual(['-220:4103', '-200:4103', '-210:4103']);
    expect(rankSpots(g.spots, 'tonnes').map((s) => s.key)).toEqual(['-210:4103', '-220:4103', '-200:4103']);
  });

  it('heat step 1-5 between min and max', () => {
    expect([1, 3, 5, 7, 9].map((v) => heatStep(v, 1, 9))).toEqual([1, 2, 3, 4, 5]);
    expect(heatStep(4, 4, 4)).toBe(5);
  });

  it('formats coordinates and days ago; projects onto the schematic near the design spots', () => {
    expect(formatCoord(-2.27, 41.03)).toBe('2.27°S 41.03°E');
    expect(daysAgo(day(3), NOW)).toBe(3);
    // Design draws G-01 (2.27°S 41.03°E) at 208,254: the fit is within tens of units.
    const p = project(-2.27, 41.03);
    expect(Math.abs(p.x - 208)).toBeLessThan(40);
    expect(Math.abs(p.y - 254)).toBeLessThan(50);
  });
});
