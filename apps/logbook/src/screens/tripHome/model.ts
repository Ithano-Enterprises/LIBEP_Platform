import type { StateKey } from '../../i18n/strings';
import type { Entry, SyncStateValue } from '../../data/types';

// Pure helpers for the trip home screen, kept separate so they can be
// unit tested without rendering.

export const stateKey: Record<SyncStateValue, StateKey> = {
  on_device: 'device',
  waiting: 'waiting',
  sent: 'sent',
  being_checked: 'checking',
};

export const STATE_ORDER: StateKey[] = ['device', 'waiting', 'sent', 'checking'];

export function countByState(entries: Entry[]): Record<StateKey, number> {
  const counts: Record<StateKey, number> = { device: 0, waiting: 0, sent: 0, checking: 0 };
  for (const e of entries) counts[stateKey[e.sync_state]] += 1;
  return counts;
}

export function filterEntries(entries: Entry[], filter: StateKey | null): Entry[] {
  return filter ? entries.filter((e) => stateKey[e.sync_state] === filter) : entries;
}

/**
 * One state for a whole previous trip: the least advanced entry wins.
 * [TO CONFIRM: how a trip's state is summarised]
 */
export function tripState(entries: Entry[]): StateKey {
  const keys = new Set(entries.map((e) => stateKey[e.sync_state]));
  for (const k of ['device', 'waiting', 'checking'] as const) if (keys.has(k)) return k;
  return 'sent';
}

/** Design rule: three or more entries with the same figure suggest guessing. */
export function hasRepeatedFigures(entries: Entry[], min = 3): boolean {
  const seen = new Map<number, number>();
  for (const e of entries) {
    const n = (seen.get(e.quantity) ?? 0) + 1;
    if (n >= min) return true;
    seen.set(e.quantity, n);
  }
  return false;
}
