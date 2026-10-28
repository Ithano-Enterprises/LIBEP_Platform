import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { LogbookProvider } from '../../data/LogbookProvider';
import { devOtherLandingSite } from '../../dev/fixtures/reference';
import { seedDevFixtures } from '../../dev/fixtures/seed';
import { openTestRepo } from '../../test/sqlite';
import { setWindow, TABLET } from '../../test/window';
import { PreferencesProvider } from '../../ui/preferences';
import { AppScreens } from '../AppScreens';
import { entryPaneWidth, gridTileWidth } from '../LogCatchScreen';

jest.mock('expo-network', () => ({
  useNetworkState: jest.fn(() => ({ isConnected: true, isInternetReachable: true })),
}));

const metrics = {
  frame: { x: 0, y: 0, width: TABLET.width, height: TABLET.height },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

async function tablet(unit?: 't' | 'kg') {
  setWindow(TABLET);
  const ctx = await openTestRepo();
  await seedDevFixtures(ctx.db, ctx.deps);
  if (unit) await ctx.repo.setPreference('unit', unit);
  const now = ctx.deps.clock.now();
  const open = () => Promise.resolve(ctx.repo);
  const clock = () => now;
  const locator = { getFix: jest.fn(async () => null) };
  render(
    <SafeAreaProvider initialMetrics={metrics}>
      <LogbookProvider open={open}>
        <PreferencesProvider>
          <AppScreens now={clock} locator={locator} />
        </PreferencesProvider>
      </LogbookProvider>
    </SafeAreaProvider>,
  );
  await screen.findByTestId('trip-total');
  const trip = (await ctx.repo.getOpenTrip())!;
  const entries = await ctx.repo.listTripEntries(trip.trip_id);
  return { ...ctx, trip, entries };
}

describe('tablet (1280×800)', () => {
  it('S2.1: list and detail side by side; the newest entry is selected; tapping selects', async () => {
    const { entries } = await tablet();
    const pane = await screen.findByTestId('detail-pane');
    await waitFor(() =>
      expect(within(pane).getByTestId('detail-species')).toHaveTextContent(entries[0].species_local_name),
    );
    expect(screen.getByTestId(`entry-${entries[0].id}`).props.accessibilityState.selected).toBe(true);
    // Filter labels show on tablet.
    expect(screen.getByText('Zote')).toBeTruthy();

    fireEvent.press(screen.getByTestId(`entry-${entries[2].id}`));
    await waitFor(() =>
      expect(within(pane).getByTestId('detail-species')).toHaveTextContent(entries[2].species_local_name),
    );
    // Still on trip home: no full-screen detail.
    expect(screen.getByTestId('trip-total')).toBeTruthy();
  });

  it('S2.1: corrections work inside the pane', async () => {
    const { repo, entries } = await tablet();
    await screen.findByTestId('detail-pane');
    fireEvent.press(await screen.findByTestId('correct'));
    fireEvent.press(screen.getByTestId('quick-1000'));
    fireEvent.press(screen.getByTestId('correct-save'));
    await waitFor(async () => expect((await repo.getEntry(entries[0].id))!.correction_count).toBe(1));
  });

  it('S3.3: menu and entry pane side by side; confirmation stays in the pane', async () => {
    const { repo, trip } = await tablet();
    fireEvent.press(screen.getByTestId('primary'));
    expect(await screen.findByTestId('pick-prompt')).toBeTruthy();
    expect(screen.getByText('Chagua aina ya samaki')).toBeTruthy();
    fireEvent.press(screen.getByTestId('fish-nguru'));
    expect(screen.queryByTestId('scrim')).toBeNull();
    expect(within(screen.getByTestId('entry-pane')).getByTestId('entry-sheet')).toBeTruthy();
    fireEvent.press(screen.getByTestId('key-1'));
    fireEvent.press(screen.getByTestId('key-5'));
    fireEvent.press(screen.getByTestId('save'));
    const card = await within(screen.getByTestId('entry-pane')).findByTestId('confirm-card');
    expect(within(card).queryByTestId('confirm-dismiss')).toBeNull();
    expect(within(card).getByTestId('confirm-weight')).toHaveTextContent('15');
    const [newest] = await repo.listTripEntries(trip.trip_id);
    expect(newest).toMatchObject({ species_local_name: 'nguru', quantity: 15, unit: 'kg' });
  });

  it('S3.3: "Other" is on the tablet menu and its name field shows in the pane', async () => {
    const { repo, trip } = await tablet();
    fireEvent.press(screen.getByTestId('primary'));
    fireEvent.press(await screen.findByTestId('fish-other'));
    const pane = screen.getByTestId('entry-pane');
    fireEvent.changeText(within(pane).getByTestId('other-name'), 'kaa');
    fireEvent.press(screen.getByTestId('key-4'));
    fireEvent.press(screen.getByTestId('key-0'));
    fireEvent.press(screen.getByTestId('save'));
    await within(pane).findByTestId('confirm-card');
    const [newest] = await repo.listTripEntries(trip.trip_id);
    expect(newest).toMatchObject({ species_id: null, species_local_name: 'kaa', quantity: 40 });
  });

  it('S2.1 and S4 follow the unit preference: t when the captain chose t', async () => {
    await tablet('t');
    expect(screen.getByTestId('trip-total')).toHaveTextContent('17 t');
    fireEvent.press(screen.getByTestId('close-trip'));
    expect(await screen.findByTestId('close-total')).toHaveTextContent(/^17$/);
  });

  it('S4: total in kg by default; a crew mismatch is confirmed in the footer', async () => {
    const { repo, trip } = await tablet();
    expect(screen.getByTestId('trip-total')).toHaveTextContent('17,000 kg');
    fireEvent.press(screen.getByTestId('close-trip'));
    expect(await screen.findByTestId('close-total')).toHaveTextContent('17,000');
    fireEvent.press(screen.getByTestId('crew-minus'));
    fireEvent.press(screen.getByTestId('submit'));
    expect(screen.getByTestId('crew-mismatch')).toBeTruthy();
    fireEvent.press(screen.getByTestId('crew-confirm'));
    await screen.findByTestId('read-only');
    expect((await repo.getTripClose(trip.trip_id))!).toMatchObject({ crew_returned: 3, total_quantity: 17000 });
  });

  it('S4: two columns with site options shown; Tuma closes the trip', async () => {
    const { repo, trip } = await tablet();
    fireEvent.press(screen.getByTestId('close-trip'));
    await screen.findByTestId('close-total');
    expect(screen.queryByTestId('site-row')).toBeNull();
    expect(screen.getByText('Kituo cha kutua')).toBeTruthy();
    fireEvent.press(screen.getByTestId(`site-${devOtherLandingSite.name}`));
    expect(screen.getByTestId('fee-note')).toBeTruthy();
    fireEvent.press(screen.getByTestId('submit'));
    await screen.findByTestId('read-only');
    expect((await repo.getTripClose(trip.trip_id))!.landing_site_id).toBe(devOtherLandingSite.id);
  });
});

describe('tablet menu grid', () => {
  it('fits as many 148dp tiles as the pane allows', () => {
    // 1280 − 480 entry pane − 48 padding = 752 → 4 columns of 182
    expect(gridTileWidth(752)).toBe(182);
    expect(gridTileWidth(148)).toBe(148);
    // Too narrow for one tile: the tile keeps its minimum.
    expect(gridTileWidth(100)).toBe(148);
  });

  it('narrows the entry pane on small tablets so one tile column fits beside it', () => {
    expect(entryPaneWidth(1280)).toBe(480);
    expect(entryPaneWidth(800)).toBe(480);
    // 600 − 404 = 196 = 148 tile + 2 × 24 padding
    expect(entryPaneWidth(600)).toBe(404);
  });

  it('S3.3 at 600dp: the entry pane leaves room for 148dp tiles', async () => {
    setWindow({ width: 600, height: 960 });
    const ctx = await openTestRepo();
    await seedDevFixtures(ctx.db, ctx.deps);
    const open = () => Promise.resolve(ctx.repo);
    render(
      <SafeAreaProvider initialMetrics={{ ...metrics, frame: { x: 0, y: 0, width: 600, height: 960 } }}>
        <LogbookProvider open={open}>
          <PreferencesProvider>
            <AppScreens now={() => ctx.deps.clock.now()} locator={{ getFix: jest.fn(async () => null) }} />
          </PreferencesProvider>
        </LogbookProvider>
      </SafeAreaProvider>,
    );
    await screen.findByTestId('trip-total');
    fireEvent.press(screen.getByTestId('primary'));
    await screen.findByTestId('fish-tewa');
    const pane = StyleSheet.flatten(screen.getByTestId('entry-pane').props.style).width as number;
    expect(pane).toBe(404);
    const menu = screen.UNSAFE_getAllByType(ScrollView)[0];
    fireEvent(menu, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 600 - pane, height: 700 } } });
    await waitFor(() =>
      expect(StyleSheet.flatten(screen.getByTestId('fish-tewa').props.style).width).toBeGreaterThanOrEqual(148),
    );
  });
});
