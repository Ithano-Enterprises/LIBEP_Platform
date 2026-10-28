import { mapPalettes, palettes, tierChip, type Mode, type Palette } from '../theme/tokens';

// Area 11: WCAG 2.x contrast for every text/background token pair the
// screens use, night and day. 4.5:1 for normal text, 3:1 for text of 24px
// and up. Pairs and sizes come from the screens' styles.

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const lin = (c: number) => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const lum = (hex: string) => {
  const [r, g, b] = rgb(hex).map(lin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export function contrast(a: string, b: string) {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
/** An rgba() colour painted over an opaque one. */
function over(rgba: string, base: string) {
  const m = rgba.match(/rgba\((\d+),(\d+),(\d+),([\d.]+)\)/);
  if (!m) return rgba;
  const a = Number(m[4]);
  const b = rgb(base);
  return `#${[1, 2, 3].map((i, k) => Math.round(Number(m[i]) * a + b[k] * (1 - a)).toString(16).padStart(2, '0')).join('')}`;
}

type Pair = [fg: keyof Palette, bg: keyof Palette, px: number, where: string];

// Text colour on background, with the smallest font size it is used at.
const PAIRS: Pair[] = [
  ['text', 'bg', 13, 'body text on the screen'],
  ['text', 'surface', 13, 'cards, rows, sheets'],
  ['text', 'raised', 13, 'selected rows, pressed buttons, keypad digits'],
  ['dim', 'bg', 13, 'secondary text on the screen'],
  ['dim', 'surface', 12, 'secondary text on cards and rows'],
  ['dim', 'raised', 13, 'disabled Save label, secondary text on a selected row'],
  ['onAccent', 'accent', 20, 'primary button label'],
  ['onAccent', 'accentPress', 20, 'primary button label while pressed'],
  ['accent', 'surface', 13, 'soft warning in the entry sheet, quick keys, "checking" state'],
  ['accent', 'bg', 13, 'S3.3 "start a trip" line, S4 over-class hint'],
  ['accent', 'raised', 13, '"checking" state on a selected row'],
  ['danger', 'bg', 13, 'error text'],
  ['danger', 'surface', 13, '"waiting" state on a row'],
  ['danger', 'raised', 13, '"waiting" state on a selected row'],
  ['ok', 'surface', 13, '"sent" state on a row, "Imehifadhiwa"'],
  ['ok', 'bg', 13, '"sent" state in the detail'],
  ['ok', 'raised', 13, '"sent" state on a selected row'],
];

const need = (px: number) => (px >= 24 ? 3 : 4.5);

// BUG-15 (fixed): Day accent, ok and danger and Night danger were under
// 4.5:1 on raised rows; the tokens were moved a few steps to clear it.

describe.each(['night', 'day'] as Mode[])('%s mode', (mode) => {
  const c = palettes[mode];
  for (const [fg, bg, px, where] of PAIRS) {
    it(`${fg} on ${bg} (${px}px, ${where}) ≥ ${need(px)}:1`, () => {
      expect(contrast(c[fg], c[bg])).toBeGreaterThanOrEqual(need(px));
    });
  }
});

describe('fixed chip colours', () => {
  it('S chip (night, outlined) on surface and bg ≥ 4.5:1', () => {
    expect(contrast(tierChip.sNight.text, palettes.night.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(tierChip.sNight.text, palettes.night.bg)).toBeGreaterThanOrEqual(4.5);
  });

  // BUG-15 (fixed): the outlined night S chip on a selected (raised) row was 4.47:1.
  it('S chip (night, outlined) on a selected row (raised) ≥ 4.5:1', () => {
    expect(contrast(tierChip.sNight.text, palettes.night.raised)).toBeGreaterThanOrEqual(4.5);
  });

  it('S chip (day, filled) and W chip ≥ 4.5:1', () => {
    expect(contrast(tierChip.sDay.text, tierChip.sDay.background)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(tierChip.w.text, tierChip.w.background)).toBeGreaterThanOrEqual(4.5);
  });
});

describe.each(['night', 'day'] as const)('%s map heat labels', (mode) => {
  const m = mapPalettes[mode];
  it.each([0, 1, 2, 3, 4])('step %i: label colour on the ramp over the sea ≥ 4.5:1 (13px)', (i) => {
    const fill = over(m.ramp[i].replace(/\s/g, ''), m.sea);
    expect(contrast(m.on[i], fill)).toBeGreaterThanOrEqual(4.5);
  });
  it('place names (text colour, 12px) on land and sea ≥ 4.5:1', () => {
    const c = palettes[mode];
    expect(contrast(c.text, m.sea)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(c.text, m.land)).toBeGreaterThanOrEqual(4.5);
  });
});

it('the contrast function matches known WCAG values', () => {
  expect(contrast('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
  expect(contrast('#777777', '#FFFFFF')).toBeCloseTo(4.48, 2);
});
