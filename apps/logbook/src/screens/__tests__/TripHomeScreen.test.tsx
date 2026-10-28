import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useNetworkState } from 'expo-network';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { LogbookProvider } from '../../data/LogbookProvider';
import type { Repository } from '../../data/repository';
import { devOpenTripEntries, devPreviousTripEntries, devSpecies } from '../../dev/fixtures/reference';
import { seedDevFixtures, seedDevReference } from '../../dev/fixtures/seed';
import { en, sw } from '../../i18n/strings';
import { openTestRepo } from '../../test/sqlite';
import { DAY, NIGHT } from '../../theme/tokens';
import { formatTime, sumKg } from '../../ui/format';
import { PreferencesProvider } from '../../ui/preferences';
import { TripHomeScreen } from '../TripHomeScreen';

jest.mock('expo-network', () => ({
  useNetworkState: jest.fn(() => ({ isConnected: true, isInternetReachable: true })),
}));
const mockNetwork = useNetworkState as jest.Mock;

const metrics = {
  frame: { x: 0, y: 0, width: 360, height: 740 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

function renderHome(repo: Repository, now: Date) {
  const open = () => Promise.resolve(repo);
  return render(
    <SafeAreaProvider initialMetrics={metrics}>
      <LogbookProvider open={open}>
        <PreferencesProvider>
          <TripHomeScreen now={() => now} />
        </PreferencesProvider>
      </LogbookProvider>
    </SafeAreaProvider>,
  );
}

async function withFixtures(unit?: 't' | 'kg') {
  const ctx = await openTestRepo();
  await seedDevFixtures(ctx.db, ctx.deps);
  if (unit) await ctx.repo.setPreference('unit', unit);
  renderHome(ctx.repo, ctx.deps.clock.now());
  await screen.findByText('Baraka');
  return ctx;
}

beforeEach(() => mockNetwork.mockReturnValue({ isConnected: true, isInternetReachable: true }));

describe('TripHomeScreen', () => {
  it('says no vessel is linked, in Kiswahili, when the device has no profile', async () => {
    const ctx = await openTestRepo();
    renderHome(ctx.repo, ctx.deps.clock.now());
    expect(await screen.findByText(sw.noVessel)).toBeTruthy();
    expect(screen.queryByText(en.noVessel)).toBeNull();
  });

  it('shows the vessel header and chips', async () => {
    await withFixtures();
    expect(screen.getByText('KE-LAM-MKW-T20-014')).toBeTruthy();
    expect(screen.getByText('20 t')).toBeTruthy();
    expect(screen.getByText('Pwani')).toBeTruthy();
    expect(screen.getByText('Mokowe')).toBeTruthy();
  });

  it('shows the open trip line with entry count and total in kg by default', async () => {
    const { repo } = await withFixtures();
    const trip = (await repo.getOpenTrip())!;
    const n = devOpenTripEntries.length;
    expect(screen.getByText(`Ilianza ${formatTime(trip.departure_at)} · ${n} maingizo ·`)).toBeTruthy();
    // Fixture entries add up to 17,000 kg.
    expect(sumKg(devOpenTripEntries.map((e) => e.kg))).toBe(17000);
    expect(screen.getByTestId('trip-total')).toHaveTextContent('17,000 kg');
    const tewa = devOpenTripEntries[devOpenTripEntries.length - 1];
    expect(screen.getAllByText('2,400').length).toBeGreaterThan(0);
    expect(tewa.kg).toBe(2400);
    expect(screen.getAllByTestId(/^entry-/)).toHaveLength(n);
  });

  it('follows the stored unit preference: t when the captain chose t', async () => {
    await withFixtures('t');
    expect(screen.getByTestId('trip-total')).toHaveTextContent('17 t');
    expect(screen.getAllByText('2.4').length).toBeGreaterThan(0);
  });

  it('filters entries by state, with counts', async () => {
    await withFixtures();
    const waiting = devOpenTripEntries.filter((e) => e.state === 'waiting').length;
    expect(screen.getByLabelText(`Inasubiri kutumwa · ${waiting}`)).toBeTruthy();
    expect(screen.getByLabelText(`Zote · ${devOpenTripEntries.length}`)).toBeTruthy();

    fireEvent.press(screen.getByTestId('filter-waiting'));
    expect(screen.getAllByTestId(/^entry-/)).toHaveLength(waiting);
    expect(screen.getAllByText('Inasubiri kutumwa')).toHaveLength(waiting);

    fireEvent.press(screen.getByTestId('filter-all'));
    expect(screen.getAllByTestId(/^entry-/)).toHaveLength(devOpenTripEntries.length);
  });

  it('lists previous trips, collapsed, and expands one', async () => {
    await withFixtures();
    expect(screen.queryByTestId(/^prev-trip-/)).toBeNull();
    fireEvent.press(screen.getByTestId('prev-toggle'));
    const card = screen.getByTestId(/^prev-trip-/);
    expect(screen.getByText(/· jana$/)).toBeTruthy();
    expect(screen.getByText(`${devPreviousTripEntries.length} maingizo`)).toBeTruthy();
    fireEvent.press(card);
    expect(screen.getAllByTestId(/^prev-entry-/)).toHaveLength(devPreviousTripEntries.length);
  });

  it('shows the offline button only without signal, with its explanation', async () => {
    mockNetwork.mockReturnValue({ isConnected: false, isInternetReachable: false });
    await withFixtures();
    fireEvent.press(screen.getByTestId('offline-button'));
    expect(
      screen.getByText('Maingizo yanahifadhiwa kwenye kifaa na yatatumwa mtandao ukirudi.'),
    ).toBeTruthy();
  });

  it('hides the offline button when online', async () => {
    await withFixtures();
    expect(screen.queryByTestId('offline-button')).toBeNull();
  });

  it('switches language and mode', async () => {
    await withFixtures();
    expect(screen.getByText('Rekodi samaki')).toBeTruthy();
    fireEvent.press(screen.getByTestId('toggle-lang'));
    expect(screen.getByText('Log catch')).toBeTruthy();
    expect(screen.getByText("Today's trip")).toBeTruthy();

    const bg = () => StyleSheet.flatten(screen.getByTestId('screen').props.style).backgroundColor;
    expect(bg()).toBe(NIGHT.bg);
    fireEvent.press(screen.getByTestId('toggle-mode'));
    expect(bg()).toBe(DAY.bg);
  });

  it('without an open trip: empty state and Start trip', async () => {
    const ctx = await openTestRepo();
    await seedDevReference(ctx.db);
    renderHome(ctx.repo, ctx.deps.clock.now());
    await screen.findByText('Baraka');
    expect(screen.getByText('Hakuna maingizo bado')).toBeTruthy();
    expect(screen.getByText('Anza safari ili kurekodi samaki.')).toBeTruthy();
    expect(screen.getByText('Anza safari')).toBeTruthy();
    expect(screen.queryByTestId('close-trip')).toBeNull();
  });

  it('shows the training notice for three equal figures, and dismisses it', async () => {
    const ctx = await openTestRepo();
    await seedDevReference(ctx.db);
    await ctx.repo.startTrip({ crewDeparted: 4, departureAt: ctx.deps.clock.now() });
    for (let i = 0; i < 3; i++) {
      await ctx.repo.logCatch({ speciesId: devSpecies[0].id, quantity: 1500, gps: null });
    }
    renderHome(ctx.repo, ctx.deps.clock.now());
    await screen.findByTestId('notices');
    fireEvent.press(screen.getByTestId('notices-toggle'));
    expect(
      screen.getByText('Maingizo matatu yana uzito uleule. Mwongozo mfupi unaweza kusaidia.'),
    ).toBeTruthy();
    fireEvent.press(screen.getByTestId('notices-dismiss'));
    await waitFor(() => expect(screen.queryByTestId('notices')).toBeNull());
  });
});
