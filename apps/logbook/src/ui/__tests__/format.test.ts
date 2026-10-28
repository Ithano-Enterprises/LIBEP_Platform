import { formatQuantity, formatTripDate, sumKg } from '../format';

describe('format', () => {
  it('shows stored kg as t with up to 3 decimals, or as whole kg', () => {
    expect(formatQuantity(2400)).toBe('2.4');
    expect(formatQuantity(12000)).toBe('12');
    expect(formatQuantity(15)).toBe('0.015');
    expect(formatQuantity(240)).toBe('0.24');
    expect(formatQuantity(2400, 'kg')).toBe('2,400');
    expect(formatQuantity(15, 'kg')).toBe('15');
  });

  it('sums kg without float drift', () => {
    expect(sumKg([15, 2400])).toBe(2415);
    expect(sumKg([0.1, 0.2])).toBe(0.3);
    expect(sumKg([])).toBe(0);
  });

  it('names the day, and marks yesterday', () => {
    const now = new Date(2026, 9, 3, 8, 0); // Sat 3 Oct (local)
    const fri = new Date(2026, 9, 2, 4, 0).toISOString();
    const thu = new Date(2026, 9, 1, 4, 0).toISOString();
    expect(formatTripDate(fri, 'sw', now, 'jana')).toBe('Ijumaa 2 Okt · jana');
    expect(formatTripDate(fri, 'en', now, 'yesterday')).toBe('Fri 2 Oct · yesterday');
    expect(formatTripDate(thu, 'sw', now, 'jana')).toBe('Alhamisi 1 Okt');
  });
});
