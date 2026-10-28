import { useCallback, useState } from 'react';

import type { Locator } from '../data/location';
import type { Entry } from '../data/types';
import { CloseTripScreen } from './CloseTripScreen';
import { EntryDetailScreen } from './EntryDetailScreen';
import { GroundsScreen } from './GroundsScreen';
import { LogCatchScreen } from './LogCatchScreen';
import { StartTripScreen } from './StartTripScreen';
import { TripHomeScreen } from './TripHomeScreen';

type Route =
  | { name: 'home' }
  | { name: 'start' }
  | { name: 'log' }
  | { name: 'close' }
  | { name: 'grounds'; focusCatchId?: string }
  | { name: 'detail'; catchId: string };

// Which screen is showing. A few screens so far, so plain state rather than
// a navigation library.
export function AppScreens({ now, locator }: { now?: () => Date; locator?: Locator }) {
  const [route, setRoute] = useState<Route>({ name: 'home' });
  const goHome = useCallback(() => setRoute({ name: 'home' }), []);
  const goStart = useCallback(() => setRoute({ name: 'start' }), []);
  const goLog = useCallback(() => setRoute({ name: 'log' }), []);
  const goClose = useCallback(() => setRoute({ name: 'close' }), []);
  const goGrounds = useCallback(() => setRoute({ name: 'grounds' }), []);
  const showOnMap = useCallback((catchId: string) => setRoute({ name: 'grounds', focusCatchId: catchId }), []);
  const openEntry = useCallback((e: Entry) => setRoute({ name: 'detail', catchId: e.id }), []);
  switch (route.name) {
    case 'start':
      return <StartTripScreen onDone={goHome} now={now} />;
    case 'log':
      return <LogCatchScreen onDone={goHome} now={now} locator={locator} />;
    case 'close':
      return <CloseTripScreen onDone={goHome} now={now} />;
    case 'grounds':
      return <GroundsScreen onDone={goHome} now={now} focusCatchId={route.focusCatchId ?? null} />;
    case 'detail':
      return <EntryDetailScreen catchId={route.catchId} onDone={goHome} />;
    default:
      return (
        <TripHomeScreen
          onStartTrip={goStart}
          onLogCatch={goLog}
          onCloseTrip={goClose}
          onOpenEntry={openEntry}
          onOpenGrounds={goGrounds}
          onShowOnMap={showOnMap}
          now={now}
        />
      );
  }
}
