import { useCallback, useState } from 'react';

import type { Locator } from '../data/location';
import type { Entry } from '../data/types';
import { EntryDetailScreen } from './EntryDetailScreen';
import { LogCatchScreen } from './LogCatchScreen';
import { StartTripScreen } from './StartTripScreen';
import { TripHomeScreen } from './TripHomeScreen';

type Route = { name: 'home' } | { name: 'start' } | { name: 'log' } | { name: 'detail'; catchId: string };

// Which screen is showing. A few screens so far, so plain state rather than
// a navigation library.
export function AppScreens({ now, locator }: { now?: () => Date; locator?: Locator }) {
  const [route, setRoute] = useState<Route>({ name: 'home' });
  const goHome = useCallback(() => setRoute({ name: 'home' }), []);
  const goStart = useCallback(() => setRoute({ name: 'start' }), []);
  const goLog = useCallback(() => setRoute({ name: 'log' }), []);
  const openEntry = useCallback((e: Entry) => setRoute({ name: 'detail', catchId: e.id }), []);
  switch (route.name) {
    case 'start':
      return <StartTripScreen onDone={goHome} now={now} />;
    case 'log':
      return <LogCatchScreen onDone={goHome} now={now} locator={locator} />;
    case 'detail':
      return <EntryDetailScreen catchId={route.catchId} onDone={goHome} />;
    default:
      return <TripHomeScreen onStartTrip={goStart} onLogCatch={goLog} onOpenEntry={openEntry} now={now} />;
  }
}
