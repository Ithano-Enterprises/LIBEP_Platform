import { isValidQuantity } from '../../data/repository';
import type { Gps, MenuItem } from '../../data/types';

// Pure helpers for Log catch (S3.3): the keypad and the fish menu.

export type Key = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '.' | 'back';

/** Most digits the keypad takes, as the design. */
const MAX_DIGITS = 5;

/** Applies one key to the typed figure (tonnes, at most one decimal). */
export function pressKey(entry: string, key: Key): string {
  if (key === 'back') return entry.slice(0, -1);
  if (key === '.') return entry.includes('.') ? entry : `${entry || '0'}.`;
  if (entry.includes('.') && entry.split('.')[1].length >= 1) return entry;
  if (entry.replace('.', '').length >= MAX_DIGITS) return entry;
  return (entry === '0' ? '' : entry) + key;
}

/** +0.5 t / +1 t quick keys: adds to the figure, kept to one decimal. */
export function quickAdd(entry: string, step: number): string {
  const v = (parseFloat(entry) || 0) + step;
  return String(Math.round(v * 10) / 10);
}

/** The typed figure in tonnes, or null while it is not a valid quantity. */
export function parseEntry(entry: string): number | null {
  // Only what the keypad can type: up to 5 digits, at most one decimal
  // (a trailing "." while typing is fine).
  if (!/^\d{1,5}(\.\d?)?$/.test(entry) || entry.replace('.', '').length > MAX_DIGITS) return null;
  const v = parseFloat(entry);
  return isValidQuantity(v) ? v : null;
}

/** Search by local name or English gloss, as the design. */
export function filterMenu(menu: MenuItem[], query: string): MenuItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return menu;
  return menu.filter(
    (m) => m.local_name.toLowerCase().includes(q) || (m.english_gloss ?? '').toLowerCase().includes(q),
  );
}

/** e.g. "2.27S 40.93E ±15 m", as the design shows positions. */
export function formatGps(gps: Gps | null): string {
  if (!gps) return '--';
  const lat = `${Math.abs(gps.latitude).toFixed(2)}${gps.latitude < 0 ? 'S' : 'N'}`;
  const lon = `${Math.abs(gps.longitude).toFixed(2)}${gps.longitude < 0 ? 'W' : 'E'}`;
  const acc = gps.gps_accuracy_m == null ? '' : ` ±${Math.round(gps.gps_accuracy_m)} m`;
  return `${lat} ${lon}${acc}`;
}
