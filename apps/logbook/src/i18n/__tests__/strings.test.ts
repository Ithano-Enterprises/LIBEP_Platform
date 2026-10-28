import { dayNames, en, monthNames, sw } from '../strings';

const flat = (o: object): [string, string][] =>
  Object.entries(o).flatMap(([k, v]) =>
    typeof v === 'string' ? [[k, v] as [string, string]] : flat(v).map(([k2, v2]) => [`${k}.${k2}`, v2] as [string, string]),
  );

describe('strings', () => {
  it('kiswahili and english have the same keys', () => {
    expect(flat(en).map(([k]) => k).sort()).toEqual(flat(sw).map(([k]) => k).sort());
  });

  it('no string is empty', () => {
    for (const [, value] of [...flat(sw), ...flat(en)]) {
      expect(value.trim().length).toBeGreaterThan(0);
    }
  });

  it('has 7 day and 12 month names per language', () => {
    for (const lang of ['sw', 'en'] as const) {
      expect(dayNames[lang]).toHaveLength(7);
      expect(monthNames[lang]).toHaveLength(12);
    }
  });
});
