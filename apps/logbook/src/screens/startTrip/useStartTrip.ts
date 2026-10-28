import { useCallback, useEffect, useState } from 'react';

import { useLogbook } from '../../data/LogbookProvider';
import { DataError } from '../../data/repository';
import type { DeviceProfile, TripStart } from '../../data/types';

export type StartTripData = { profile: DeviceProfile | null; openTrip: TripStart | null };

/** Loads what S1 shows and starts a trip, through the data layer only. */
export function useStartTrip() {
  const { repo, error: openError, version, refresh } = useLogbook();
  const [data, setData] = useState<StartTripData | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!repo) return;
    let alive = true;
    Promise.all([repo.getDeviceProfile(), repo.getOpenTrip()]).then(
      ([profile, openTrip]) => alive && setData({ profile, openTrip }),
      (e: unknown) => alive && setError(e instanceof Error ? e : new Error(String(e))),
    );
    return () => {
      alive = false;
    };
  }, [repo, version]);

  /**
   * Writes the trip_start record. Returns false if a trip was opened in the
   * meantime; the reload then shows the blocked state.
   */
  const start = useCallback(
    async (crewDeparted: number, departureAt: Date): Promise<boolean> => {
      if (!repo) return false;
      try {
        await repo.startTrip({ crewDeparted, departureAt });
        return true;
      } catch (e) {
        if (e instanceof DataError && e.code === 'trip_already_open') return false;
        throw e;
      } finally {
        refresh();
      }
    },
    [repo, refresh],
  );

  return { data, error: openError ?? error, start };
}
