import { useCallback, useEffect, useState } from 'react';

import { useLogbook } from '../../data/LogbookProvider';
import type { CatchHistory, DeviceProfile, Entry, MenuItem } from '../../data/types';

export type EntryDetailData = {
  profile: DeviceProfile | null;
  entry: Entry | null;
  history: CatchHistory | null;
  /** The entry's trip is still open (corrections are offered only then, as the design). */
  tripOpen: boolean;
  menu: MenuItem[];
};

/** Loads one entry with its history, and adds corrections, through the data layer only. */
export function useEntryDetail(catchId: string) {
  const { repo, error: openError, version, refresh } = useLogbook();
  const [data, setData] = useState<EntryDetailData | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!repo) return;
    let alive = true;
    (async () => {
      const [profile, entry, history, open] = await Promise.all([
        repo.getDeviceProfile(),
        repo.getEntry(catchId),
        repo.getCatchHistory(catchId),
        repo.getOpenTrip(),
      ]);
      const menu = profile ? await repo.getSpeciesMenu(profile.vessel.tonnage_class) : [];
      const tripOpen = !!entry && open?.trip_id === entry.trip_id;
      if (alive) setData({ profile, entry, history, tripOpen, menu });
    })().catch((e: unknown) => alive && setError(e instanceof Error ? e : new Error(String(e))));
    return () => {
      alive = false;
    };
  }, [repo, version, catchId]);

  /** A new correction linked to the head the captain saw (append-only). */
  const correct = useCallback(
    async (input: { previousCorrectionId: string | null; speciesId?: string; quantity?: number }) => {
      if (!repo) throw new Error('store not open');
      try {
        await repo.correctCatch({ catchId, ...input });
      } finally {
        refresh();
      }
    },
    [repo, refresh, catchId],
  );

  return { data, error: openError ?? error, correct };
}
