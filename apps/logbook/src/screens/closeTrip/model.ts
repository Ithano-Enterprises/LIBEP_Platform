import type { Entry, HoldCode } from '../../data/types';
import { sumKg } from '../../ui/format';

// Pure helpers for Close trip (S4).

export type TypeTotal = {
  /** Species id, or "other:<name>" so each typed "Other" name is its own row. */
  key: string;
  species_id: string | null;
  name: string;
  hold: HoldCode | null;
  kg: number;
  n: number;
};

/** Groups by species; "Other" catches (species_id null) by their typed name. */
export const speciesKey = (e: Pick<Entry, 'species_id' | 'species_local_name'>) =>
  e.species_id ?? `other:${e.species_local_name}`;

/** Effective entries grouped by fish, largest total first (S, in kg). */
export function byType(entries: Entry[]): TypeTotal[] {
  const groups = new Map<string, TypeTotal>();
  for (const e of entries) {
    const key = speciesKey(e);
    const g = groups.get(key) ?? {
      key,
      species_id: e.species_id,
      name: e.species_local_name,
      hold: e.hold_code,
      kg: 0,
      n: 0,
    };
    g.kg = sumKg([g.kg, e.quantity]);
    g.n += 1;
    groups.set(key, g);
  }
  return [...groups.values()].sort((a, b) => b.kg - a.kg || a.name.localeCompare(b.name));
}

/** Crew returned differs from crew departed: the captain confirms, never blocked. */
export const crewMismatch = (departed: number, returned: number) => departed !== returned;

/** Keeps what a distance field may hold: digits and one dot, 5 characters. */
export function cleanDistance(text: string): string {
  const digits = text.replace(/[^0-9.]/g, '');
  const [whole, ...rest] = digits.split('.');
  return (rest.length ? `${whole}.${rest.join('')}` : whole).slice(0, 5);
}

/** Distance in km, or null when left empty (it is optional). */
export function parseDistance(text: string): number | null {
  if (!text.trim()) return null;
  const v = parseFloat(text);
  return Number.isFinite(v) && v >= 0 ? v : null;
}
