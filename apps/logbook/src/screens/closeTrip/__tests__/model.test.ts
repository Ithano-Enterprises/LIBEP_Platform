import type { Entry } from '../../../data/types';
import { byType, cleanDistance, parseDistance } from '../model';

const e = (species: string, quantity: number, hold: 'A' | 'B' = 'A') =>
  ({ species_id: species, species_local_name: species, hold_code: hold, quantity }) as Entry;

describe('close trip model', () => {
  it('groups by fish, largest first, with counts and no float drift', () => {
    const r = byType([e('kibua', 3.1, 'B'), e('tewa', 2.4), e('kibua', 5.6, 'B'), e('tafi', 0.1), e('tafi', 0.2)]);
    expect(r.map((x) => [x.name, x.t, x.n])).toEqual([
      ['kibua', 8.7, 2],
      ['tewa', 2.4, 1],
      ['tafi', 0.3, 2],
    ]);
    expect(r[0].hold).toBe('B');
    expect(byType([])).toEqual([]);
  });

  it('distance keeps digits and one dot, empty means not given', () => {
    expect(cleanDistance('12.5km')).toBe('12.5');
    expect(cleanDistance('1.2.3')).toBe('1.23');
    expect(cleanDistance('1234567')).toBe('12345');
    expect(parseDistance('')).toBeNull();
    expect(parseDistance('  ')).toBeNull();
    expect(parseDistance('12.5')).toBe(12.5);
    expect(parseDistance('0')).toBe(0);
  });
});
