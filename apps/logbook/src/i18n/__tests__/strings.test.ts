import { en, sw } from '../strings';

describe('strings', () => {
  it('kiswahili and english have the same keys', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(sw).sort());
  });

  it('no string is empty', () => {
    for (const value of [...Object.values(sw), ...Object.values(en)]) {
      expect(value.trim().length).toBeGreaterThan(0);
    }
  });
});
