import type { GroundsCatch } from '../../../data/types';
import { project } from '../basemap';
import {
  buildGrounds,
  daysAgo,
  exclusion,
  formatCoord,
  formatWindow,
  heatStep,
  rankSpots,
  seasonOf,
  seasonStart,
  spotEntries,
  spotOfCatch,
} from '../model';

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
  plant_weight_kg: null,
  ...o,
});

describe('grounds model', () => {
  it('groups catches into cells: trips, total, average, species, last fished', () => {
    const g = buildGrounds(
      [
        c({ trip_id: 'a', quantity: 2400, recorded_at: day(1) }),
        c({ trip_id: 'a', quantity: 15, latitude: -2.2701, species_id: 'kibua', species_local_name: 'kibua' }),
        c({ trip_id: 'b', quantity: 200, recorded_at: day(5) }),
        c({ trip_id: 'b', quantity: 3000, latitude: -2.19, longitude: 41.06 }),
      ],
      { now: NOW, range: '90', species: [] },
    );
    expect(g.tripCount).toBe(2);
    expect(g.totalKg).toBe(5615);
    const s = g.spots.find((x) => x.key === '-227:4103')!;
    expect(s).toMatchObject({ trips: 2, kg: 2615, avg: 1308, lastAt: day(1) });
    expect(s.bySpecies.map((x) => [x.name, x.kg])).toEqual([
      ['tewa', 2600],
      ['kibua', 15],
    ]);
    expect(s.lat).toBeCloseTo(-2.27);
    expect(s.lon).toBeCloseTo(41.03);
  });

  it('leaves out entries with no position or saved after the trip closed', () => {
    expect(exclusion(c({ latitude: null, longitude: null }))).toBe('no_gps');
    expect(exclusion(c({ trip_closed_at: day(2), recorded_at: day(1) }))).toBe('after_close');
    expect(exclusion(c({ trip_closed_at: day(1), recorded_at: day(2) }))).toBeNull();
    const g = buildGrounds([c({}), c({ latitude: null, longitude: null, quantity: 400 })], {
      now: NOW,
      range: '90',
      species: [],
    });
    expect(g.excluded.map((e) => e.reason)).toEqual(['no_gps']);
    expect(g.totalKg).toBe(1);
  });

  it('range and species filters', () => {
    const all = [
      c({ recorded_at: day(10) }),
      c({ recorded_at: day(60), species_id: 'kibua', species_local_name: 'kibua', quantity: 2 }),
      c({ recorded_at: day(120), quantity: 5 }),
    ];
    expect(buildGrounds(all, { now: NOW, range: '30', species: [] }).totalKg).toBe(1);
    expect(buildGrounds(all, { now: NOW, range: '90', species: [] }).totalKg).toBe(3);
    expect(buildGrounds(all, { now: NOW, range: 'all', species: [] }).totalKg).toBe(8);
    expect(buildGrounds(all, { now: NOW, range: 'all', species: ['kibua'] }).totalKg).toBe(2);
  });

  it('plant weight counts only weighed catches of closed trips', () => {
    const g = buildGrounds(
      [
        c({ trip_id: 'a', trip_closed_at: day(0), plant_weight_kg: 2200.5, quantity: 2400 }),
        c({ trip_id: 'b', plant_weight_kg: 9000, quantity: 1000 }), // open trip: never W
        c({ trip_id: 'c', trip_closed_at: day(0), quantity: 1 }),
      ],
      { now: NOW, range: '90', species: [] },
    );
    expect(g.spots[0]).toMatchObject({ trips: 3, plantKg: 2200.5, plantTrips: 1 });
  });

  it('"Other" catches group and filter by their typed name', () => {
    const other = (name: string, quantity: number) =>
      c({ species_id: null, species_local_name: name, hold_code: null, quantity });
    const all = [other('kaa', 40), other('pweza mdogo', 15), other('kaa', 10), c({ quantity: 100 })];
    const g = buildGrounds(all, { now: NOW, range: '90', species: [] });
    expect(g.spots[0].bySpecies.map((x) => [x.key, x.kg])).toEqual([
      ['tewa', 100],
      ['other:kaa', 50],
      ['other:pweza mdogo', 15],
    ]);
    expect(buildGrounds(all, { now: NOW, range: '90', species: ['other:kaa'] }).totalKg).toBe(50);
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

describe('grounds model: detail and filters', () => {
  it('best two-hour window and month by tonnes', () => {
    const at = (h: number, m = 9) => new Date(2026, m, 10, h, 30).toISOString();
    const g = buildGrounds(
      [c({ recorded_at: at(4), quantity: 2 }), c({ recorded_at: at(5), quantity: 2 }), c({ recorded_at: at(9), quantity: 3 })],
      { now: new Date(2026, 9, 14), range: 'all', species: [] },
    );
    expect(g.spots[0].bestHour).toBe(4);
    expect(formatWindow(g.spots[0].bestHour)).toBe('04:00–06:00');
    expect(g.spots[0].bestMonth).toBe(9);
    expect(formatWindow(23)).toBe('23:00–01:00');
  });

  it('season filter and this-season range (placeholder months)', () => {
    const now = new Date(2026, 11, 20); // December: Kaskazi (Nov–Mar)
    expect(seasonOf(now)).toBe('kaskazi');
    expect(seasonOf(new Date(2026, 5, 1))).toBe('kusi');
    expect(seasonStart(now)).toEqual(new Date(2026, 10, 1));
    expect(seasonStart(new Date(2027, 1, 3))).toEqual(new Date(2026, 10, 1));
    const all = [
      c({ recorded_at: new Date(2026, 11, 2).toISOString(), quantity: 1 }),
      c({ recorded_at: new Date(2026, 6, 2).toISOString(), quantity: 2 }),
      c({ recorded_at: new Date(2026, 9, 2).toISOString(), quantity: 4 }),
    ];
    expect(buildGrounds(all, { now, range: 'all', species: [], season: 'kaskazi' }).totalKg).toBe(1);
    expect(buildGrounds(all, { now, range: 'all', species: [], season: 'kusi' }).totalKg).toBe(6);
    expect(buildGrounds(all, { now, range: 'season', species: [] }).totalKg).toBe(1);
  });

  it('entries of a spot, newest first, and the spot of a catch', () => {
    const a = c({ recorded_at: day(3) });
    const b = c({ recorded_at: day(1) });
    const far = c({ latitude: -1.98, longitude: 41.31 });
    const g = buildGrounds([a, b, far], { now: NOW, range: '90', species: [] });
    const s = spotOfCatch(g.spots, a.id)!;
    expect(spotEntries([a, b, far], s).map((x) => x.id)).toEqual([b.id, a.id]);
    expect(spotOfCatch(g.spots, 'nope')).toBeNull();
  });
});
