import { CREW_DEFAULT, CREW_MAX, CREW_MIN } from '../../../data/repository';
import type { TripStart } from '../../../data/types';
import { canStepDown, canStepUp, startMode, stepCrew } from '../model';

const trip = { trip_id: 't1' } as TripStart;

describe('start trip model', () => {
  it('is ready with no open trip and blocked with one', () => {
    expect(startMode(null)).toBe('ready');
    expect(startMode(trip)).toBe('blocked');
  });

  it('crew starts at 4 and stays within 1-24', () => {
    expect([CREW_MIN, CREW_DEFAULT, CREW_MAX]).toEqual([1, 4, 24]);
    expect(stepCrew(4, 1)).toBe(5);
    expect(stepCrew(4, -1)).toBe(3);
    expect(stepCrew(1, -1)).toBe(1);
    expect(stepCrew(24, 1)).toBe(24);
  });

  it('stepping is off at the bounds', () => {
    expect(canStepDown(1)).toBe(false);
    expect(canStepDown(2)).toBe(true);
    expect(canStepUp(24)).toBe(false);
    expect(canStepUp(23)).toBe(true);
  });
});
