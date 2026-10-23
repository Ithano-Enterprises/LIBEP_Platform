import { dayNames, monthNames, type Lang } from '../i18n/strings';

// Display formatting. Quantities are stored in tonnes; kg is a view only.

export function formatQuantity(tonnes: number, unit: 't' | 'kg' = 't'): string {
  if (unit === 'kg') return Math.round(tonnes * 1000).toLocaleString('en-US');
  return tonnes.toFixed(1);
}

/** Sum of tonnes, kept to one decimal without float drift. */
export function sumTonnes(values: number[]): number {
  return Math.round(values.reduce((a, v) => a + v * 10, 0)) / 10;
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
