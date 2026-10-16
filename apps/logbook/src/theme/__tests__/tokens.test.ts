import { DAY, NIGHT, plexFonts, systemFonts } from '../tokens';

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

  it('system fallback fonts cover every role and never name IBM Plex', () => {
    expect(Object.keys(systemFonts).sort()).toEqual(Object.keys(plexFonts).sort());
    for (const style of Object.values(systemFonts)) {
      expect(style.fontFamily).toBeTruthy();
      expect(style.fontFamily).not.toMatch(/IBMPlex/);
    }
  });
});
