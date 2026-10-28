import type { SyncStateValue } from '../types';

// Outbound state of one record (contract §4): on_device → waiting → sent,
// and being_checked only when the device feed says so. States never move
// backwards because of a send; only the feed clears a review.

export type SyncEvent =
  | 'queued' // picked up for sending
  | 'acked' // server answered inserted / already_present
  | 'review' // feed: being_checked
  | 'cleared'; // feed: review cleared

const TRANSITIONS: Record<SyncStateValue, Partial<Record<SyncEvent, SyncStateValue>>> = {
  on_device: { queued: 'waiting', acked: 'sent' },
  waiting: { acked: 'sent' },
  sent: { review: 'being_checked' },
  being_checked: { cleared: 'sent' },
};

/** The next state, or the same state when the event does not apply. */
export function nextState(state: SyncStateValue, event: SyncEvent): SyncStateValue {
  return TRANSITIONS[state][event] ?? state;
}
