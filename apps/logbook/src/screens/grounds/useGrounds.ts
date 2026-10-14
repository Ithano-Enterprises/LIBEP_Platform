import { useEffect, useState } from 'react';

import { useLogbook } from '../../data/LogbookProvider';
import type { DeviceProfile, GroundsCatch, TripStart } from '../../data/types';

export type GroundsData = {
  profile: DeviceProfile | null;
  catches: GroundsCatch[];
  /** Trips logged on this device, for the empty state. */
  tripsLogged: number;
  openTrip: TripStart | null;
};

/** Loads this device's own catches for the grounds map, through the data layer only. */
export function useGrounds() {
  const { repo, error: openError, version } = useLogbook();
  const [data, setData] = useState<GroundsData | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!repo) return;
    let alive = true;
    Promise.all([repo.getDeviceProfile(), repo.listGroundsCatches(), repo.countTrips(), repo.getOpenTrip()]).then(
      ([profile, catches, tripsLogged, openTrip]) => alive && setData({ profile, catches, tripsLogged, openTrip }),
      (e: unknown) => alive && setError(e instanceof Error ? e : new Error(String(e))),
    );
    return () => {
      alive = false;
    };
  }, [repo, version]);

  return { data, error: openError ?? error };
}
