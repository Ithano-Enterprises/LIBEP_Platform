import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { LogbookProvider } from '../../data/LogbookProvider';
import { devOpenTripEntries } from '../../dev/fixtures/reference';
import { seedDevFixtures, seedDevReference } from '../../dev/fixtures/seed';
import { openTestRepo } from '../../test/sqlite';
import { formatTime, sumKg } from '../../ui/format';
import { PreferencesProvider } from '../../ui/preferences';
import { AppScreens } from '../AppScreens';

jest.mock('expo-network', () => ({
  useNetworkState: jest.fn(() => ({ isConnected: true, isInternetReachable: true })),
}));

const metrics = {
  frame: { x: 0, y: 0, width: 360, height: 740 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

describe('S2.1 -> S1 -> S2.1', () => {
  it('Anza safari opens S1; starting returns to a new empty trip', async () => {
    const ctx = await openTestRepo();
    await seedDevReference(ctx.db);
    const now = ctx.deps.clock.now();
    const open = () => Promise.resolve(ctx.repo);
    const clock = () => now;
    render(
      <SafeAreaProvider initialMetrics={metrics}>
        <LogbookProvider open={open}>
          <PreferencesProvider>
            <AppScreens now={clock} />
          </PreferencesProvider>
        </LogbookProvider>
      </SafeAreaProvider>,
    );

    await screen.findByText('Anza safari ili kurekodi samaki.');
    fireEvent.press(screen.getByTestId('primary'));
    await screen.findByTestId('crew-stepper');

    fireEvent.press(screen.getByTestId('primary'));
    await screen.findByText('Rekodi samaki');
    expect(screen.getByText(`Ilianza ${formatTime(now.toISOString())} · 0 maingizo ·`)).toBeTruthy();
    expect(screen.getByText('Hakuna maingizo bado')).toBeTruthy();
    expect(screen.getByTestId('primary')).not.toBeDisabled();
  });
});

describe('S2.1 -> S3.3 -> S2.1', () => {
  it('Rekodi samaki opens S3.3; saving puts the entry on top and updates the total', async () => {
    const ctx = await openTestRepo();
    await seedDevFixtures(ctx.db, ctx.deps);
    const now = ctx.deps.clock.now();
    const open = () => Promise.resolve(ctx.repo);
    const clock = () => now;
    const locator = { getFix: jest.fn(async () => ({ latitude: -2.27, longitude: 40.93, gps_accuracy_m: 12 })) };
    const before = sumKg(devOpenTripEntries.map((e) => e.kg));
    expect(before).toBe(17000);
    render(
      <SafeAreaProvider initialMetrics={metrics}>
        <LogbookProvider open={open}>
          <PreferencesProvider>
            <AppScreens now={clock} locator={locator} />
          </PreferencesProvider>
        </LogbookProvider>
      </SafeAreaProvider>,
    );

    await screen.findByText('Rekodi samaki');
    expect(screen.getByTestId('trip-total')).toHaveTextContent('17,000 kg');
    fireEvent.press(screen.getByTestId('primary'));
    fireEvent.press(await screen.findByTestId('fish-tewa'));
    fireEvent.press(screen.getByTestId('key-1'));
    fireEvent.press(screen.getByTestId('key-5'));
    fireEvent.press(screen.getByTestId('save'));
    fireEvent.press(await screen.findByTestId('view-list'));

    await screen.findByTestId('trip-total');
    // A 15 kg catch is not lost to rounding (default unit kg).
    expect(screen.getByTestId('trip-total')).toHaveTextContent('17,015 kg');
    const entries = await ctx.repo.listTripEntries((await ctx.repo.getOpenTrip())!.trip_id);
    expect(entries[0]).toMatchObject({ species_local_name: 'tewa', quantity: 15, unit: 'kg', latitude: -2.27 });
    expect(screen.getAllByTestId(/^entry-/)[0].props.testID).toBe(`entry-${entries[0].id}`);
  });
});

describe('S2.1 -> entry detail -> S2.1', () => {
  it('tapping an entry opens its detail; back returns', async () => {
    const ctx = await openTestRepo();
    await seedDevFixtures(ctx.db, ctx.deps);
    const now = ctx.deps.clock.now();
    const open = () => Promise.resolve(ctx.repo);
    const clock = () => now;
    render(
      <SafeAreaProvider initialMetrics={metrics}>
        <LogbookProvider open={open}>
          <PreferencesProvider>
            <AppScreens now={clock} />
          </PreferencesProvider>
        </LogbookProvider>
      </SafeAreaProvider>,
    );
    await screen.findByTestId('trip-total');
    const [first] = await ctx.repo.listTripEntries((await ctx.repo.getOpenTrip())!.trip_id);
    fireEvent.press(screen.getByTestId(`entry-${first.id}`));
    expect(await screen.findByTestId('detail-species')).toHaveTextContent(first.species_local_name);
    fireEvent.press(screen.getByTestId('back'));
    await screen.findByTestId('trip-total');
  });
});
