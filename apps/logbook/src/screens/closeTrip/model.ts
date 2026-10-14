import type { Entry, HoldCode } from '../../data/types';
import { sumTonnes } from '../../ui/format';

// Pure helpers for Close trip (S4).

export type TypeTotal = { species_id: string; name: string; hold: HoldCode | null; t: number; n: number };

/** Effective entries grouped by fish, largest total first (S, in t). */
export function byType(entries: Entry[]): TypeTotal[] {
  const groups = new Map<string, TypeTotal>();
  for (const e of entries) {
    const g = groups.get(e.species_id) ?? {
      species_id: e.species_id,
      name: e.species_local_name,
      hold: e.hold_code,
      t: 0,
      n: 0,
    };
    g.t = sumTonnes([g.t, e.quantity]);
    g.n += 1;
    groups.set(e.species_id, g);
  }
  return [...groups.values()].sort((a, b) => b.t - a.t || a.name.localeCompare(b.name));
}

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
