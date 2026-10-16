import type { MenuItem } from '../../../data/types';
import { filterMenu, formatGps, parseEntry, pressKey, quickAdd, type Key } from '../model';

const type = (keys: Key[]) => keys.reduce(pressKey, '');

describe('keypad', () => {
  it('takes digits and one decimal place only', () => {
    expect(type(['2', '.', '4'])).toBe('2.4');
    expect(type(['2', '.', '4', '5'])).toBe('2.4');
    expect(type(['2', '.', '.', '4'])).toBe('2.4');
    expect(type(['.', '5'])).toBe('0.5');
    expect(type(['0', '3'])).toBe('3');
  });

  it('caps the length and backspaces', () => {
    expect(type(['1', '2', '3', '4', '5', '6'])).toBe('12345');
    expect(type(['1', '2', 'back'])).toBe('1');
    expect(type(['back'])).toBe('');
  });

  it('quick keys add 0.5 t and 1 t without float drift', () => {
    expect(quickAdd('', 0.5)).toBe('0.5');
    expect(quickAdd('2.4', 0.5)).toBe('2.9');
    expect(quickAdd('0.1', 0.2)).toBe('0.3');
    expect(quickAdd('2.', 1)).toBe('3');
  });

  it.each([
    ['99999', 1],
    ['99999', 0.5],
    ['9999.9', 0.5],
  ])('quick keys keep the 5-digit limit: %p + %p is left unchanged', (from, step) => {
    expect(quickAdd(from, step)).toBe(from);
  });

  it('quick keys still add up to the limit', () => {
    expect(quickAdd('9998', 1)).toBe('9999');
    expect(quickAdd('9999.4', 0.5)).toBe('9999.9');
  });

  it('only a positive figure is a quantity', () => {
    expect(parseEntry('')).toBeNull();
    expect(parseEntry('0')).toBeNull();
    expect(parseEntry('0.')).toBeNull();
    expect(parseEntry('2.4')).toBe(2.4);
    expect(parseEntry('2.')).toBe(2);
    expect(parseEntry('99999')).toBe(99999);
  });

  it.each(['1.2.3', '2abc', '0.05', '1.25', '-1', ' 2', '123456', '1e3'])(
    'a figure the keypad cannot type is not a quantity: %p',
    (s) => {
      expect(parseEntry(s)).toBeNull();
    },
  );
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

describe('gps text', () => {
  it('shows hemispheres and accuracy, or -- without a fix', () => {
    expect(formatGps({ latitude: -2.274, longitude: 40.931, gps_accuracy_m: 15 })).toBe('2.27S 40.93E ±15 m');
    expect(formatGps({ latitude: -2.27, longitude: 40.93, gps_accuracy_m: null })).toBe('2.27S 40.93E');
    expect(formatGps(null)).toBe('--');
  });
});
