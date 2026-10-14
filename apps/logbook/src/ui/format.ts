import { dayNames, monthNames, type Lang } from '../i18n/strings';

// Display formatting. Quantities are stored in kg; t is a view only.

/**
 * A quantity stored in kg, shown in the chosen unit: whole kg, or t with up
 * to 3 decimals and no trailing zeros (15 kg -> 0.015 t, 2400 kg -> 2.4 t).
 */
export function formatQuantity(kg: number, unit: 't' | 'kg'): string {
  if (unit === 'kg') return Math.round(kg).toLocaleString('en-US');
  return (Math.round(kg) / 1000).toFixed(3).replace(/\.?0+$/, '');
}

/** Sum of kg. Plant weights may be finer than whole kg, so kept to the gram. */
export function sumKg(values: number[]): number {
  return Math.round(values.reduce((a, v) => a + v * 1000, 0)) / 1000;
}

/** Signed difference in t, e.g. "+0.2", "−0.3", "±0.0" (design style). */
export function formatSigned(tonnes: number): string {
  const d = Math.round(tonnes * 10) / 10;
  const sign = d > 0 ? '+' : d < 0 ? '−' : '±';
  return `${sign}${Math.abs(d).toFixed(1)}`;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Local time HH:MM, as recorded on this device. */
export function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * e.g. "Jumamosi 3 Okt" / "Sat 3 Oct". The design writes the month in
 * full; short names are used until full ones are confirmed.
 */
export function formatDay(d: Date, lang: Lang): string {
  return `${dayNames[lang][d.getDay()]} ${d.getDate()} ${monthNames[lang][d.getMonth()]}`;
}

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

/** e.g. "Ijumaa 2 Okt · jana" / "Fri 2 Oct · yesterday". */
export function formatTripDate(iso: string, lang: Lang, now: Date, yesterdayWord: string): string {
  const d = new Date(iso);
  const label = formatDay(d, lang);
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  return dayKey(d) === dayKey(y) ? `${label} · ${yesterdayWord}` : label;
}
