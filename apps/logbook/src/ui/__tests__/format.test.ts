import { formatQuantity, formatTripDate, sumTonnes } from '../format';

describe('format', () => {
  it('shows tonnes with one decimal and kg as whole numbers', () => {
    expect(formatQuantity(2.4)).toBe('2.4');
    expect(formatQuantity(12)).toBe('12.0');
    expect(formatQuantity(2.4, 'kg')).toBe('2,400');
  });

  it('sums tonnes without float drift', () => {
    expect(sumTonnes([0.1, 0.2])).toBe(0.3);
    expect(sumTonnes([])).toBe(0);
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
