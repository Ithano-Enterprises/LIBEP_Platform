import { CREW_MAX, CREW_MIN } from '../../data/repository';
import type { TripStart } from '../../data/types';

// Pure helpers for the start trip screen, kept separate so they can be
// unit tested without rendering.

/** Only one trip may be open: with one open, S1 is blocked. */
export function startMode(openTrip: TripStart | null): 'ready' | 'blocked' {
  return openTrip ? 'blocked' : 'ready';
}

/** Moves the crew count by delta, kept within 1-24. */
export function stepCrew(n: number, delta: number): number {
  return Math.min(CREW_MAX, Math.max(CREW_MIN, n + delta));
}

export const canStepDown = (n: number) => n > CREW_MIN;
export const canStepUp = (n: number) => n < CREW_MAX;
