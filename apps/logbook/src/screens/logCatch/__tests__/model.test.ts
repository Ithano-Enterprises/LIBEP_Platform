import type { MenuItem } from '../../../data/types';
import { filterMenu, formatGps, MAX_DIGITS, OTHER_ID, otherItem, parseEntry, plausibility, pressKey, QUICK_STEPS_KG, quickAdd, type Key } from '../model';

const type = (keys: Key[]) => keys.reduce(pressKey, '');

describe('keypad', () => {
  it('takes whole kg digits only', () => {
    expect(type(['1', '5'])).toBe('15');
    expect(type(['2', '4', '0', '0'])).toBe('2400');
    expect(type(['0', '3'])).toBe('3');
  });

  it('caps the length at 6 digits and backspaces', () => {
    expect(MAX_DIGITS).toBe(6);
    expect(type(['1', '2', '3', '4', '5', '6', '7'])).toBe('123456');
    expect(type(['1', '2', 'back'])).toBe('1');
    expect(type(['back'])).toBe('');
  });

  it('quick keys add 500 kg and 1000 kg', () => {
    expect(QUICK_STEPS_KG).toEqual([500, 1000]);
    expect(quickAdd('', 500)).toBe('500');
    expect(quickAdd('15', 500)).toBe('515');
    expect(quickAdd('2400', 1000)).toBe('3400');
  });

  it.each([
    ['999999', 1000],
    ['999600', 500],
  ])('quick keys keep the 6-digit limit: %p + %p is left unchanged', (from, step) => {
    expect(quickAdd(from, step)).toBe(from);
  });

  it('quick keys still add up to the limit', () => {
    expect(quickAdd('998999', 1000)).toBe('999999');
  });

  it('only whole kg of at least 1 is a quantity', () => {
    expect(parseEntry('')).toBeNull();
    expect(parseEntry('0')).toBeNull();
    expect(parseEntry('15')).toBe(15);
    expect(parseEntry('1')).toBe(1);
    expect(parseEntry('100000')).toBe(100000);
    expect(parseEntry('999999')).toBe(999999);
  });

  it.each(['2.4', '15.0', '1.2.3', '2abc', '-1', ' 2', '1234567', '1e3'])(
    'a figure the keypad cannot type is not a quantity: %p',
    (s) => {
      expect(parseEntry(s)).toBeNull();
    },
  );
});

describe('"Other" tile', () => {
  it('is labelled in the chosen language, has no hold code and sorts last', () => {
    const o = otherItem('Nyingine');
    expect(o).toMatchObject({ id: OTHER_ID, local_name: 'Nyingine', hold_code: null, english_gloss: null });
    expect(o.sort).toBeGreaterThan(1000);
  });
});

describe('menu search', () => {
  const menu = [
    { id: '1', local_name: 'changu', english_gloss: 'emperor', sort: 0, hold_code: 'A' },
    { id: '2', local_name: 'kibua', english_gloss: 'frigate tuna', sort: 1, hold_code: 'B' },
  ] as MenuItem[];

  it('matches local name or gloss, ignoring case and spaces', () => {
    expect(filterMenu(menu, '')).toHaveLength(2);
    expect(filterMenu(menu, ' Kib ').map((m) => m.local_name)).toEqual(['kibua']);
    expect(filterMenu(menu, 'tuna').map((m) => m.local_name)).toEqual(['kibua']);
    expect(filterMenu(menu, 'zzz')).toEqual([]);
  });
});

describe('plausibility (soft, never blocks)', () => {
  it('flags an entry above the class first, then a trip total that would pass it', () => {
    // kg against tonnage_class x 1000 (20 t = 20,000 kg).
    expect(plausibility(null, 0, 20)).toBeNull();
    expect(plausibility(2400, 10000, 20)).toBeNull();
    expect(plausibility(20000, 0, 20)).toBeNull();
    expect(plausibility(20001, 0, 20)).toBe('entry_over_class');
    expect(plausibility(25000, 18000, 20)).toBe('entry_over_class');
    expect(plausibility(2200, 17900, 20)).toBe('trip_would_pass');
    expect(plausibility(2200, 17900, 50)).toBeNull();
  });

  it('a trip total exactly at the class does not warn', () => {
    expect(plausibility(2100, 17900, 20)).toBeNull();
    expect(plausibility(1, 19999, 20)).toBeNull();
    expect(plausibility(2, 19999, 20)).toBe('trip_would_pass');
  });

  it('a 15 kg catch never warns on its own', () => {
    expect(plausibility(15, 0, 10)).toBeNull();
    expect(plausibility(15, 9985, 10)).toBeNull();
  });
});

describe('gps text', () => {
  it('shows hemispheres and accuracy, or -- without a fix', () => {
    expect(formatGps({ latitude: -2.274, longitude: 40.931, gps_accuracy_m: 15 })).toBe('2.27S 40.93E ±15 m');
    expect(formatGps({ latitude: -2.27, longitude: 40.93, gps_accuracy_m: null })).toBe('2.27S 40.93E');
    expect(formatGps(null)).toBe('--');
  });
});
