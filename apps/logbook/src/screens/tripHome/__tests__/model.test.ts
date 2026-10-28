import type { Entry, SyncStateValue } from '../../../data/types';
import { countByState, filterEntries, hasRepeatedFigures, tripState } from '../model';

const e = (sync_state: SyncStateValue, quantity = 1): Entry =>
  ({ id: Math.random().toString(), sync_state, quantity }) as Entry;

describe('trip home model', () => {
  it('counts and filters by design state', () => {
    const list = [e('on_device'), e('waiting'), e('waiting'), e('sent'), e('being_checked')];
    expect(countByState(list)).toEqual({ device: 1, waiting: 2, sent: 1, checking: 1 });
    expect(filterEntries(list, 'waiting')).toHaveLength(2);
    expect(filterEntries(list, null)).toHaveLength(5);
  });

  it('summarises a trip by its least advanced entry', () => {
    expect(tripState([e('sent'), e('sent')])).toBe('sent');
    expect(tripState([e('sent'), e('being_checked')])).toBe('checking');
    expect(tripState([e('sent'), e('waiting'), e('being_checked')])).toBe('waiting');
    expect(tripState([e('on_device'), e('waiting')])).toBe('device');
    expect(tripState([])).toBe('sent');
  });

  it('flags three entries with the same figure', () => {
    expect(hasRepeatedFigures([e('sent', 1.2), e('sent', 1.2)])).toBe(false);
    expect(hasRepeatedFigures([e('sent', 1.2), e('sent', 2), e('sent', 1.2), e('sent', 1.2)])).toBe(true);
  });
});
