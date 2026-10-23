import { useCallback, useState } from 'react';

import { StartTripScreen } from './StartTripScreen';
import { TripHomeScreen } from './TripHomeScreen';

// Which screen is showing. Two screens so far, so plain state rather than
// a navigation library.
export function AppScreens({ now }: { now?: () => Date }) {
  const [route, setRoute] = useState<'home' | 'start'>('home');
  const goHome = useCallback(() => setRoute('home'), []);
  const goStart = useCallback(() => setRoute('start'), []);
  return route === 'start' ? (
    <StartTripScreen onDone={goHome} now={now} />
  ) : (
    <TripHomeScreen onStartTrip={goStart} now={now} />
  );
}
