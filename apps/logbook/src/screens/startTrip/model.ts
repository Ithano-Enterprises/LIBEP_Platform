import { CREW_MAX, CREW_MIN } from '../../data/repository';
import type { TripStart } from '../../data/types';

// Pure helpers for the start trip screen, kept separate so they can be
// unit tested without rendering.

/** Only one trip may be open: with one open, S1 is blocked. */
export function startMode(openTrip: TripStart | null): 'ready' | 'blocked' {
  return openTrip ? 'blocked' : 'ready';
}

/**
 * Moves a crew headcount by delta, kept within min-24: 1 for crew departed
 * (S1), 0 for crew returned (S4).
 */
export function stepCrew(n: number, delta: number, min: number = CREW_MIN): number {
  return Math.min(CREW_MAX, Math.max(min, n + delta));
}

export const canStepDown = (n: number, min: number = CREW_MIN) => n > min;
export const canStepUp = (n: number) => n < CREW_MAX;
