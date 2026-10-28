import type { Entry } from '../../../data/types';
import { byType, cleanDistance, crewMismatch, parseDistance } from '../model';

const e = (species: string, quantity: number, hold: 'A' | 'B' = 'A') =>
  ({ species_id: species, species_local_name: species, hold_code: hold, quantity }) as Entry;
const other = (name: string, quantity: number) =>
  ({ species_id: null, species_local_name: name, hold_code: null, quantity }) as Entry;

describe('close trip model', () => {
  it('groups by fish in kg, largest first, with counts', () => {
    const r = byType([e('kibua', 3100, 'B'), e('tewa', 2400), e('kibua', 5600, 'B'), e('tafi', 15), e('tafi', 20)]);
    expect(r.map((x) => [x.name, x.kg, x.n])).toEqual([
      ['kibua', 8700, 2],
      ['tewa', 2400, 1],
      ['tafi', 35, 2],
    ]);
    expect(r[0].hold).toBe('B');
    expect(byType([])).toEqual([]);
  });

  it('keeps each "Other" name as its own row', () => {
    const r = byType([other('pweza mdogo', 15), other('kaa', 40), other('pweza mdogo', 5), e('tewa', 10)]);
    expect(r.map((x) => [x.key, x.name, x.kg, x.n, x.hold])).toEqual([
      ['other:kaa', 'kaa', 40, 1, null],
      ['other:pweza mdogo', 'pweza mdogo', 20, 2, null],
      ['tewa', 'tewa', 10, 1, 'A'],
    ]);
  });

  it('flags a crew headcount mismatch', () => {
    expect(crewMismatch(4, 4)).toBe(false);
    expect(crewMismatch(4, 3)).toBe(true);
    expect(crewMismatch(4, 0)).toBe(true);
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
