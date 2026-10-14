import { useEffect } from 'react';

import { useLogbook } from '../LogbookProvider';
import type { SyncOutcome } from './queue';
import type { Transport } from './transport';

/** Time between sends when nothing failed. [TO CONFIRM: sync interval] */
export const SYNC_INTERVAL_MS = 30_000;

/**
 * Sends waiting records in the background and refreshes the screens when
 * something was acknowledged. No transport, no sending.
 */
export function SyncLoop({
  transport,
  intervalMs = SYNC_INTERVAL_MS,
  onOutcome,
}: {
  transport: Transport | null;
  intervalMs?: number;
  onOutcome?: (o: SyncOutcome) => void;
}) {
  const { repo, refresh } = useLogbook();

  useEffect(() => {
    if (!repo || !transport) return;
    const queue = repo.syncQueue(transport);
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      let next = intervalMs;
      try {
        const o = await queue.runOnce();
        if (!alive) return;
        onOutcome?.(o);
        if (o.kind === 'sent' && o.acked > 0) refresh();
        if (o.kind === 'retry') next = o.afterMs;
      } catch {
        // Store busy or closed: try again next round.
      }
      if (alive) timer = setTimeout(tick, next);
    };
    timer = setTimeout(tick, intervalMs);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [repo, transport, intervalMs, refresh, onOutcome]);

  return null;
}
