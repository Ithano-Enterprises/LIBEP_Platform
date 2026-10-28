import type { GroundsCatch, HoldCode } from '../../data/types';
import { sumKg } from '../../ui/format';
import { speciesKey } from '../closeTrip/model';

// My grounds (S5), computed on the device from this captain's own catches
// only. Pure functions so they can be tested without rendering.

/** Grid cell size in degrees, about 1 km. [TO CONFIRM: cell size] */
export const CELL_DEG = 0.01;
/** Fewer trips than this shows the empty state (design). */
export const MIN_TRIPS = 3;
export const DAY_MS = 86_400_000;

export type Metric = 'trips' | 'tonnes';
export type Range = '30' | '90' | 'season' | 'all';
export type Season = 'all' | 'kaskazi' | 'kusi';

/**
 * Monsoon months (0 = Jan), from the design's placeholder line "Kaskazi
 * Nov–Mac · Kusi Apr–Okt". [TO CONFIRM: season months with the client]
 */
export const SEASON_MONTHS: Record<Exclude<Season, 'all'>, number[]> = {
  kaskazi: [10, 11, 0, 1, 2],
  kusi: [3, 4, 5, 6, 7, 8, 9],
};

export const seasonOf = (d: Date): Exclude<Season, 'all'> =>
  SEASON_MONTHS.kaskazi.includes(d.getMonth()) ? 'kaskazi' : 'kusi';

/** Start of the current monsoon season (local time). */
export function seasonStart(now: Date): Date {
  const d = new Date(now.getFullYear(), now.getMonth(), 1);
  const s = seasonOf(now);
  while (seasonOf(new Date(d.getFullYear(), d.getMonth() - 1, 1)) === s) d.setMonth(d.getMonth() - 1);
  return d;
}

export type Filters = { range: Range; season: Season; species: string[] };
export const DEFAULT_FILTERS: Filters = { range: '90', season: 'all', species: [] };

export type Spot = {
  /** Stable cell key, e.g. "-227:4103" (cell index in 0.01° steps). */
  key: string;
  /** Cell centre. */
  lat: number;
  lon: number;
  trips: number;
  /** Total S on this cell, in kg; avg per trip, whole kg. */
  kg: number;
  avg: number;
  /** key: species id, or "other:<name>" for "Other" catches. */
  bySpecies: { key: string; species_id: string | null; name: string; hold: HoldCode | null; kg: number }[];
  lastAt: string;
  /** Plant weights (W) on this cell's catches, from closed trips only. */
  plantKg: number | null;
  plantTrips: number;
  catchIds: string[];
  /** Two-hour window with the most catch (kg), start hour (local). */
  bestHour: number;
  /** Month (0 = Jan) with the most catch (kg). */
  bestMonth: number;
};

export type Excluded = { catch: GroundsCatch; reason: 'no_gps' | 'after_close' };

export type Grounds = { spots: Spot[]; excluded: Excluded[]; tripCount: number; totalKg: number };

const idx = (v: number) => Math.round(v / CELL_DEG);

/**
 * Why a catch is left off the map: no position, or saved after its trip
 * closed (the position is not where the fish were caught). Saved at the
 * landing site needs site coordinates. [TO CONFIRM: port rule and radius]
 */
export function exclusion(c: GroundsCatch): Excluded['reason'] | null {
  if (c.latitude == null || c.longitude == null) return 'no_gps';
  if (c.trip_closed_at && c.recorded_at > c.trip_closed_at) return 'after_close';
  return null;
}

function sinceOf(range: Range, now: Date): number | null {
  if (range === 'all') return null;
  if (range === 'season') return seasonStart(now).getTime();
  return now.getTime() - Number(range) * DAY_MS;
}

/** The value with the largest weight. */
function argmax(weights: Map<number, number>): number {
  let best = -1;
  let w = -1;
  for (const [k, v] of weights) if (v > w || (v === w && k < best)) [best, w] = [k, v];
  return best;
}

export function buildGrounds(
  catches: GroundsCatch[],
  /** species: species keys to keep (species id, or "other:<name>"); empty keeps all. */
  opts: { now: Date; range: Range; species: string[]; season?: Season },
): Grounds {
  const since = sinceOf(opts.range, opts.now);
  const season = opts.season ?? 'all';
  const inRange = catches.filter(
    (c) =>
      (since == null || new Date(c.recorded_at).getTime() >= since) &&
      (season === 'all' || seasonOf(new Date(c.recorded_at)) === season),
  );
  const excluded: Excluded[] = [];
  const cells = new Map<string, GroundsCatch[]>();
  for (const c of inRange) {
    if (opts.species.length && !opts.species.includes(speciesKey(c))) continue;
    const why = exclusion(c);
    if (why) {
      excluded.push({ catch: c, reason: why });
      continue;
    }
    const key = `${idx(c.latitude!)}:${idx(c.longitude!)}`;
    cells.set(key, [...(cells.get(key) ?? []), c]);
  }

  const spots: Spot[] = [...cells.entries()].map(([key, cs]) => {
    const [la, lo] = key.split(':').map(Number);
    const trips = new Set(cs.map((c) => c.trip_id)).size;
    const kg = sumKg(cs.map((c) => c.quantity));
    const species = new Map<string, Spot['bySpecies'][number]>();
    for (const c of cs) {
      const k = speciesKey(c);
      const s = species.get(k) ?? { key: k, species_id: c.species_id, name: c.species_local_name, hold: c.hold_code, kg: 0 };
      s.kg = sumKg([s.kg, c.quantity]);
      species.set(k, s);
    }
    const weighed = cs.filter((c) => c.trip_closed_at && c.plant_weight_kg != null);
    // Two-hour windows starting on each hour, weighted by kg.
    const windows = new Map<number, number>();
    const months = new Map<number, number>();
    for (const c of cs) {
      const d = new Date(c.recorded_at);
      for (const h of [d.getHours(), (d.getHours() + 23) % 24]) windows.set(h, (windows.get(h) ?? 0) + c.quantity);
      months.set(d.getMonth(), (months.get(d.getMonth()) ?? 0) + c.quantity);
    }
    return {
      key,
      lat: la * CELL_DEG,
      lon: lo * CELL_DEG,
      trips,
      kg,
      avg: Math.round(kg / trips),
      bySpecies: [...species.values()].sort((a, b) => b.kg - a.kg || a.name.localeCompare(b.name)),
      lastAt: cs.reduce((m, c) => (c.recorded_at > m ? c.recorded_at : m), cs[0].recorded_at),
      plantKg: weighed.length ? sumKg(weighed.map((c) => c.plant_weight_kg!)) : null,
      plantTrips: new Set(weighed.map((c) => c.trip_id)).size,
      catchIds: cs.map((c) => c.id),
      bestHour: argmax(windows),
      bestMonth: argmax(months),
    };
  });

  return {
    spots,
    excluded,
    tripCount: new Set(inRange.map((c) => c.trip_id)).size,
    totalKg: sumKg(spots.map((s) => s.kg)),
  };
}

/** Catches in one spot, newest first. */
export function spotEntries(catches: GroundsCatch[], spot: Spot): GroundsCatch[] {
  const ids = new Set(spot.catchIds);
  return catches.filter((c) => ids.has(c.id)).sort((a, b) => b.recorded_at.localeCompare(a.recorded_at));
}

/** The spot a catch falls in, if it is on the map. */
export const spotOfCatch = (spots: Spot[], catchId: string) => spots.find((s) => s.catchIds.includes(catchId)) ?? null;

/** e.g. "04:00–06:00". */
export const formatWindow = (h: number) =>
  `${String(h).padStart(2, '0')}:00–${String((h + 2) % 24).padStart(2, '0')}:00`;

export const metricValue = (s: Spot, m: Metric) => (m === 'trips' ? s.trips : s.kg);

/** Ranked by the metric; ties broken by the other metric, then position. */
export function rankSpots(spots: Spot[], m: Metric): Spot[] {
  const other: Metric = m === 'trips' ? 'tonnes' : 'trips';
  return [...spots].sort(
    (a, b) =>
      metricValue(b, m) - metricValue(a, m) ||
      metricValue(b, other) - metricValue(a, other) ||
      a.key.localeCompare(b.key),
  );
}

/** Heat ramp step 1-5 between the smallest and largest value (design). */
export function heatStep(v: number, min: number, max: number): 1 | 2 | 3 | 4 | 5 {
  if (max === min) return 5;
  return (1 + Math.min(4, Math.floor((4 * (v - min)) / (max - min)))) as 1 | 2 | 3 | 4 | 5;
}

/** e.g. "2.27°S 41.03°E". */
export function formatCoord(lat: number, lon: number): string {
  return `${Math.abs(lat).toFixed(2)}°${lat < 0 ? 'S' : 'N'} ${Math.abs(lon).toFixed(2)}°${lon < 0 ? 'W' : 'E'}`;
}

/** Whole days between two times (local days not needed: coarse "days ago"). */
export function daysAgo(iso: string, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / DAY_MS));
}
