import { useCallback, useState } from 'react';

import type { Locator } from '../data/location';
import { LogCatchScreen } from './LogCatchScreen';
import { StartTripScreen } from './StartTripScreen';
import { TripHomeScreen } from './TripHomeScreen';

// Which screen is showing. A few screens so far, so plain state rather than
// a navigation library.
export function AppScreens({ now, locator }: { now?: () => Date; locator?: Locator }) {
  const [route, setRoute] = useState<'home' | 'start' | 'log'>('home');
  const goHome = useCallback(() => setRoute('home'), []);
  const goStart = useCallback(() => setRoute('start'), []);
  const goLog = useCallback(() => setRoute('log'), []);
  if (route === 'start') return <StartTripScreen onDone={goHome} now={now} />;
  if (route === 'log') return <LogCatchScreen onDone={goHome} now={now} locator={locator} />;
  return <TripHomeScreen onStartTrip={goStart} onLogCatch={goLog} now={now} />;
}
