import { screen, waitFor } from '@testing-library/react-native';

import type { TonnageClass } from '../data/types';
import { devMenus, devVessel } from '../dev/fixtures/reference';
import { strings } from '../i18n/strings';
import { plausibility } from '../screens/logCatch/model';
import { clearKeys, count, logAnother, mountApp, press, seeded, sid, startTripUI, typeKeys } from './helpers';

// Area 4: soft plausibility warnings for each tonnage class. A warning is
// shown, and Save always still writes the catch.

jest.mock('expo-network', () => ({
  useNetworkState: jest.fn(() => ({ isConnected: false, isInternetReachable: false })),
}));

const sw = strings.sw;
const CLASSES: TonnageClass[] = [10, 20, 50, 100];

async function vesselOfClass(cls: TonnageClass) {
  const ctx = await seeded();
  // Reference data, not a ledger record: the class is set for the test.
  await ctx.db.runAsync('UPDATE vessels SET tonnage_class = ? WHERE id = ?', [cls, devVessel.id]);
  mountApp(ctx);
  await startTripUI();
  return ctx;
}

const fishFor = (cls: TonnageClass) => devMenus[cls][0];

describe('plausibility model at each class edge', () => {
  it.each(CLASSES)('class %i: equal to the class is fine, above is a warning', (cls) => {
    expect(plausibility(cls, 0, cls)).toBeNull();
    expect(plausibility(cls + 0.1, 0, cls)).toBe('entry_over_class');
    expect(plausibility(1, cls - 1, cls)).toBeNull(); // reaches the class exactly
    expect(plausibility(1.1, cls - 1, cls)).toBe('trip_would_pass');
    expect(plausibility(0.1, cls, cls)).toBe('trip_would_pass');
    expect(plausibility(null, cls * 5, cls)).toBeNull();
    // Float edges: 0.1 + 0.2 style sums do not trip the warning.
    expect(plausibility(0.2, cls - 0.2, cls)).toBeNull();
  });
});

describe.each(CLASSES)('vessel class %i t', (cls) => {
  const label = `${cls} t`;

  it('an entry above the class warns and still saves', async () => {
    const ctx = await vesselOfClass(cls);
    press('primary');
    const fish = fishFor(cls);
    await screen.findByTestId(`fish-${fish}`);
    press(`fish-${fish}`);
    typeKeys(String(cls));
    expect(screen.queryByTestId('cap-hint')).toBeNull();
    typeKeys('.1');
    expect(screen.getByTestId('cap-hint')).toHaveTextContent(sw.capHint.replace('{c}', label));
    expect(screen.getByTestId('save').props.accessibilityState.disabled).toBe(false);
    press('save');
    await screen.findByTestId('confirm-card');
    const trip = (await ctx.repo.getOpenTrip())!;
    const [e] = await ctx.repo.listTripEntries(trip.trip_id);
    expect(e.quantity).toBe(cls + 0.1);
    expect(e.species_id).toBe(sid(fish));
  });

  it('a catch that would take the trip past the class warns and still saves', async () => {
    const ctx = await vesselOfClass(cls);
    press('primary');
    const fish = fishFor(cls);
    await screen.findByTestId(`fish-${fish}`);
    press(`fish-${fish}`);
    typeKeys(String(cls - 1));
    expect(screen.queryByTestId('cap-hint')).toBeNull();
    press('save');
    await screen.findByTestId('confirm-card');
    await logAnother();
    // The total on the device now is cls - 1: the next 1 t reaches it, 1.5 t passes it.
    press(`fish-${fish}`);
    typeKeys('1');
    expect(screen.queryByTestId('cap-hint')).toBeNull();
    clearKeys();
    typeKeys('1.5');
    await waitFor(() => expect(screen.getByTestId('cap-hint')).toHaveTextContent(sw.tripCapHint.replace('{c}', label)));
    press('save');
    await screen.findByTestId('confirm-card');
    const trip = (await ctx.repo.getOpenTrip())!;
    expect(await count(ctx.db, 'catches', 'trip_id = ?', [trip.trip_id])).toBe(2);

    // S4 shows the over-class line once the total is past the class.
    press('view-list');
    await screen.findByTestId('trip-total');
    press('close-trip');
    await screen.findByTestId('over-hint');
    expect(screen.getByTestId('over-hint')).toHaveTextContent(sw.tripOverHint.replace('{c}', label));
    // ...and Tuma is not blocked by it.
    press('submit');
    await screen.findByTestId('read-only');
  });

  it('the trip warning uses the latest correction, not the original figure', async () => {
    const ctx = await vesselOfClass(cls);
    const trip = (await ctx.repo.getOpenTrip())!;
    const big = await ctx.repo.logCatch({ speciesId: sid(fishFor(cls)), quantity: cls, gps: null });
    await ctx.repo.correctCatch({ catchId: big.id, previousCorrectionId: null, quantity: 1 });
    expect((await ctx.repo.listTripEntries(trip.trip_id))[0].quantity).toBe(1);
    // Refresh the screens' data: go home and back through the UI.
    press('primary');
    const fish = fishFor(cls);
    await screen.findByTestId(`fish-${fish}`);
    press(`fish-${fish}`);
    typeKeys('2');
    expect(screen.queryByTestId('cap-hint')).toBeNull();
  });
});
