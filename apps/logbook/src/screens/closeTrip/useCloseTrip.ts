import { useCallback, useEffect, useState } from 'react';

import { useLogbook } from '../../data/LogbookProvider';
import type { DeviceProfile, Entry, LandingSite, SyncStateValue, TripClose, TripStart } from '../../data/types';

export type CloseTripData = {
  profile: DeviceProfile | null;
  start: TripStart | null;
  close: TripClose | null;
  closeState: SyncStateValue | null;
  entries: Entry[];
  sites: LandingSite[];
};

/**
 * Loads one trip for S4 and closes it, through the data layer only. With no
 * trip id it takes the open trip; after closing it keeps showing that trip
 * read-only.
 */
export function useCloseTrip(tripId: string | null) {
  const { repo, error: openError, version, refresh } = useLogbook();
  const [data, setData] = useState<CloseTripData | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [id, setId] = useState(tripId);

  useEffect(() => {
    if (!repo) return;
    let alive = true;
    (async () => {
      const [profile, sites] = await Promise.all([repo.getDeviceProfile(), repo.getLandingSites()]);
      const start = id ? await repo.getTripStart(id) : await repo.getOpenTrip();
      const close = start ? await repo.getTripClose(start.trip_id) : null;
      const closeState = close ? await repo.getSyncState(close.id) : null;
      const entries = start ? await repo.listTripEntries(start.trip_id) : [];
      if (alive) setData({ profile, start, close, closeState, entries, sites });
    })().catch((e: unknown) => alive && setError(e instanceof Error ? e : new Error(String(e))));
    return () => {
      alive = false;
    };
  }, [repo, version, id]);

  const submit = useCallback(
    async (input: {
      tripId: string;
      arrivalAt: Date;
      crewCount: number;
      landingSiteId: string;
      distanceKm: number | null;
    }) => {
      if (!repo) throw new Error('store not open');
      try {
        await repo.closeTrip(input);
        setId(input.tripId); // keep showing this trip, now read-only
      } finally {
        refresh();
      }
    },
    [repo, refresh],
  );

  return { data, error: openError ?? error, submit };
}
