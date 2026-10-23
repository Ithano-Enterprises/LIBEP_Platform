import { useEffect, useState } from 'react';

import { useLogbook } from '../../data/LogbookProvider';
import type { ClosedTrip, DeviceProfile, Entry, TripStart } from '../../data/types';

export type TripHomeData = {
  profile: DeviceProfile | null;
  openTrip: TripStart | null;
  entries: Entry[];
  closedTrips: ClosedTrip[];
};

/** Loads everything the trip home shows, through the data layer only. */
export function useTripHome(): { data: TripHomeData | null; error: Error | null } {
  const { repo, error: openError, version } = useLogbook();
  const [data, setData] = useState<TripHomeData | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!repo) return;
    let alive = true;
    (async () => {
      const [profile, openTrip, closedTrips] = await Promise.all([
        repo.getDeviceProfile(),
        repo.getOpenTrip(),
        repo.listClosedTrips(),
      ]);
      const entries = openTrip ? await repo.listTripEntries(openTrip.trip_id) : [];
      if (alive) setData({ profile, openTrip, entries, closedTrips });
    })().catch((e: unknown) => alive && setError(e instanceof Error ? e : new Error(String(e))));
    return () => {
      alive = false;
    };
  }, [repo, version]);

  return { data, error: openError ?? error };
}
