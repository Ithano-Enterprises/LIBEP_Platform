import { useCallback, useEffect, useState } from 'react';

import { useLogbook } from '../../data/LogbookProvider';
import type { CatchRecord, DeviceProfile, Gps, MenuItem, TripStart } from '../../data/types';

export type CatchInput = { speciesId: string; quantity: number; gps: Gps | null; note: string };

export type LogCatchData = { profile: DeviceProfile | null; openTrip: TripStart | null; menu: MenuItem[] };

/** Loads what S3.3 shows and saves a catch, through the data layer only. */
export function useLogCatch() {
  const { repo, error: openError, version, refresh } = useLogbook();
  const [data, setData] = useState<LogCatchData | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!repo) return;
    let alive = true;
    (async () => {
      const [profile, openTrip] = await Promise.all([repo.getDeviceProfile(), repo.getOpenTrip()]);
      const menu = profile ? await repo.getSpeciesMenu(profile.vessel.tonnage_class) : [];
      if (alive) setData({ profile, openTrip, menu });
    })().catch((e: unknown) => alive && setError(e instanceof Error ? e : new Error(String(e))));
    return () => {
      alive = false;
    };
  }, [repo, version]);

  /** One catch, tier S, as its own row (never merged with another). */
  const save = useCallback(
    async (input: CatchInput): Promise<CatchRecord> => {
      if (!repo) throw new Error('store not open');
      try {
        return await repo.logCatch(input);
      } finally {
        refresh();
      }
    },
    [repo, refresh],
  );

  return { data, error: openError ?? error, save };
}
