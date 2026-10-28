import { mapPalettes, type Mode } from '../../theme/tokens';

// The design blends each ramp step over the sea colour, so the cells are
// solid colours on the map (design `mix`).
function mix(colour: string, sea: string): string {
  const s = [1, 3, 5].map((i) => parseInt(sea.slice(i, i + 2), 16));
  const m = colour.match(/rgba\((\d+),(\d+),(\d+),([\d.]+)\)/);
  const [r, g, b, a] = m
    ? [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])]
    : [1, 3, 5].map((i) => parseInt(colour.slice(i, i + 2), 16)).concat(1);
  const q = (x: number, y: number) => Math.round(x * a + y * (1 - a));
  return `rgb(${q(r, s[0])},${q(g, s[1])},${q(b, s[2])})`;
}

/** Five solid heat colours and the text colour that reads on each. */
export function heatColours(mode: Mode): { fill: string[]; on: readonly string[] } {
  const p = mapPalettes[mode];
  return { fill: p.ramp.map((c) => mix(c, p.sea)), on: p.on };
}
