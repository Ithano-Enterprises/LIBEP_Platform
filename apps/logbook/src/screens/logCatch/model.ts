import { isValidQuantity } from '../../data/repository';
import type { Gps, MenuItem } from '../../data/types';

// Pure helpers for Log catch (S3.3): the keypad and the fish menu.

export type Key = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'back';

/**
 * Most digits the keypad takes: whole kg up to 999,999, so a 100 t vessel's
 * class (100,000 kg) can be typed. [TO CONFIRM: keypad digit limit]
 */
export const MAX_DIGITS = 6;

/** Quick keys, in kg: the same amounts as the design's +0.5 t / +1 t. */
export const QUICK_STEPS_KG = [500, 1000] as const;

/** Applies one key to the typed figure (whole kg, no decimals). */
export function pressKey(entry: string, key: Key): string {
  if (key === 'back') return entry.slice(0, -1);
  if (entry.length >= MAX_DIGITS) return entry;
  return (entry === '0' ? '' : entry) + key;
}

/**
 * Quick keys: add whole kg to the figure. Like the digit keys, they never go
 * past the digit limit: the figure is left as it is.
 */
export function quickAdd(entry: string, step: number): string {
  const next = String((parseInt(entry, 10) || 0) + step);
  return next.length > MAX_DIGITS ? entry : next;
}

/** The typed figure in whole kg, or null while it is not a valid quantity. */
export function parseEntry(entry: string): number | null {
  // Only what the keypad can type: whole kg, up to the digit limit.
  if (!/^\d+$/.test(entry) || entry.length > MAX_DIGITS) return null;
  const v = parseInt(entry, 10);
  return isValidQuantity(v) ? v : null;
}

/** The "Other" tile's id. Never stored: an "Other" catch has species_id = null. */
export const OTHER_ID = 'other';

/** The "Other" tile, last on the menu, labelled in the chosen language. */
export function otherItem(label: string): MenuItem {
  return { id: OTHER_ID, local_name: label, english_gloss: null, sort: Number.MAX_SAFE_INTEGER, hold_code: null };
}

/** Search by local name or English gloss, as the design. */
export function filterMenu(menu: MenuItem[], query: string): MenuItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return menu;
  return menu.filter(
    (m) => m.local_name.toLowerCase().includes(q) || (m.english_gloss ?? '').toLowerCase().includes(q),
  );
}

/**
 * Soft plausibility check, never blocking (design rule): a single entry
 * above the vessel's tonnage class, or a trip total that would pass it.
 * [TO CONFIRM: plausibility thresholds; the class as a cap is the design's]
 */
export function plausibility(
  quantity: number | null,
  tripTotal: number,
  tonnageClass: number,
): 'entry_over_class' | 'trip_would_pass' | null {
  if (quantity == null || quantity <= 0) return null;
  if (quantity > tonnageClass) return 'entry_over_class';
  if (Math.round((tripTotal + quantity) * 10) > tonnageClass * 10) return 'trip_would_pass';
  return null;
}

/** e.g. "2.27S 40.93E ±15 m", as the design shows positions. */
export function formatGps(gps: Gps | null): string {
  if (!gps) return '--';
  const lat = `${Math.abs(gps.latitude).toFixed(2)}${gps.latitude < 0 ? 'S' : 'N'}`;
  const lon = `${Math.abs(gps.longitude).toFixed(2)}${gps.longitude < 0 ? 'W' : 'E'}`;
  const acc = gps.gps_accuracy_m == null ? '' : ` ±${Math.round(gps.gps_accuracy_m)} m`;
  return `${lat} ${lon}${acc}`;
}
