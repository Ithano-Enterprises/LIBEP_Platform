import { DAY, NIGHT, plexFonts, systemFonts, tierChip, type Palette } from '../tokens';

const lin = (c: number) => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => lin(parseInt(hex.slice(i, i + 2), 16)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe('design tokens', () => {
  it('night and day define the same tokens', () => {
    expect(Object.keys(DAY).sort()).toEqual(Object.keys(NIGHT).sort());
  });

  it('every token is a hex colour', () => {
    for (const value of [...Object.values(NIGHT), ...Object.values(DAY)]) {
      expect(value).toMatch(/^#[0-9A-F]{6}$/);
    }
  });

  it('matches the design background colours', () => {
    expect(NIGHT.bg).toBe('#0B1416');
    expect(DAY.bg).toBe('#EFF2F1');
  });

  it.each([
    ['night', NIGHT],
    ['day', DAY],
  ] as [string, Palette][])('%s state colours reach 4.5:1 on every background', (_, p) => {
    for (const fg of [p.accent, p.ok, p.danger, p.text, p.dim]) {
      for (const bg of [p.bg, p.surface, p.raised]) {
        expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('night S chip letter reaches 4.5:1 on a selected row', () => {
    expect(contrast(tierChip.sNight.text, NIGHT.raised)).toBeGreaterThanOrEqual(4.5);
  });

  it('system fallback fonts cover every role and never name IBM Plex', () => {
    expect(Object.keys(systemFonts).sort()).toEqual(Object.keys(plexFonts).sort());
    for (const style of Object.values(systemFonts)) {
      expect(style.fontFamily).toBeTruthy();
      expect(style.fontFamily).not.toMatch(/IBMPlex/);
    }
  });
});
