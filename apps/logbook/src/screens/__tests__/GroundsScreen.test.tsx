import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { LogbookProvider } from '../../data/LogbookProvider';
import type { Repository } from '../../data/repository';
import { seedDevFixtures } from '../../dev/fixtures/seed';
import { en, sw, type Lang } from '../../i18n/strings';
import { openTestRepo } from '../../test/sqlite';
import { DAY, type Mode } from '../../theme/tokens';
import { formatQuantity } from '../../ui/format';
import { PreferencesProvider } from '../../ui/preferences';
import { buildGrounds, formatCoord, rankSpots } from '../grounds/model';
import { AppScreens } from '../AppScreens';
import { GroundsScreen } from '../GroundsScreen';

jest.mock('expo-network', () => ({
  useNetworkState: jest.fn(() => ({ isConnected: true, isInternetReachable: true })),
}));

const metrics = {
  frame: { x: 0, y: 0, width: 360, height: 740 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

function renderGrounds(repo: Repository, now: Date, opts: { lang?: Lang; mode?: Mode } = {}) {
  const onDone = jest.fn();
  const open = () => Promise.resolve(repo);
  const clock = () => now;
  render(
    <SafeAreaProvider initialMetrics={metrics}>
      <LogbookProvider open={open}>
        <PreferencesProvider initialLang={opts.lang ?? 'sw'} initialMode={opts.mode ?? 'night'}>
          <GroundsScreen onDone={onDone} now={clock} />
        </PreferencesProvider>
      </LogbookProvider>
    </SafeAreaProvider>,
  );
  return onDone;
}

async function withHistory(opts: { lang?: Lang; mode?: Mode } = {}) {
  const ctx = await openTestRepo();
  await seedDevFixtures(ctx.db, ctx.deps, { history: true });
  const now = ctx.deps.clock.now();
  const expected = buildGrounds(await ctx.repo.listGroundsCatches(), { now, range: '90', species: [] });
  const onDone = renderGrounds(ctx.repo, now, opts);
  await screen.findByTestId('grounds-panel');
  // The map lays out on first frame; tests have no layout, so give it a size.
  fireEvent(screen.getByTestId('grounds-map').children[0], 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 360, height: 300 } },
  });
  return { ...ctx, now, expected, onDone };
}

describe('GroundsScreen without a vessel', () => {
  it('says no vessel is linked, in Kiswahili', async () => {
    const ctx = await openTestRepo();
    renderGrounds(ctx.repo, ctx.deps.clock.now());
    expect(await screen.findByText(sw.noVessel)).toBeTruthy();
    expect(screen.queryByText(en.noVessel)).toBeNull();
  });
});

describe('GroundsScreen', () => {
  it('shows the trips, total S, one cell per spot, the legend and the calm lines', async () => {
    const { expected } = await withHistory();
    expect(screen.getByText(`Safari ${expected.tripCount} · siku 90 ·`)).toBeTruthy();
    expect(screen.getByTestId('grounds-total')).toHaveTextContent(`${formatQuantity(expected.totalT)} t`);
    expect(screen.getAllByTestId(/^cell-/)).toHaveLength(expected.spots.length);
    expect(screen.getByTestId('legend')).toHaveTextContent(/Safari.*→.*safari/);
    expect(screen.getByText('Ramani ya mchoro — si kwa kipimo')).toBeTruthy();
    expect(screen.getByText('Inafanya kazi bila mtandao')).toBeTruthy();
    expect(screen.getByText('Ni wewe tu unayeona ramani hii')).toBeTruthy();
    // Only this device's own entries exist; nothing else is drawn.
    expect(screen.getByTestId('boat')).toBeTruthy();
  });

  it('top spots: peek shows #1, expanded shows all; the metric toggle re-sorts', async () => {
    const { expected } = await withHistory();
    const byTrips = rankSpots(expected.spots, 'trips');
    const byT = rankSpots(expected.spots, 'tonnes');
    expect(screen.getAllByTestId(/^spot-[^v]/)).toHaveLength(1);
    expect(screen.getByTestId(`spot-${byTrips[0].key}`)).toHaveTextContent(
      new RegExp(`^1${formatCoord(byTrips[0].lat, byTrips[0].lon)}`),
    );
    fireEvent.press(screen.getByTestId('grounds-expand'));
    const keys = () => screen.getAllByTestId(/^spot-[^v]/).map((n) => n.props.testID.replace('spot-', ''));
    expect(keys()).toEqual(byTrips.map((s) => s.key));
    expect(screen.getByText('kwa mara nyingi')).toBeTruthy();
    fireEvent.press(screen.getByTestId('metric-tonnes'));
    expect(keys()).toEqual(byT.map((s) => s.key));
    expect(screen.getByText('kwa samaki wengi')).toBeTruthy();
    expect(screen.getByTestId(`spot-value-${byT[0].key}`)).toHaveTextContent(formatQuantity(byT[0].t));
  });

  it('tapping a row selects its cell', async () => {
    const { expected } = await withHistory();
    const top = rankSpots(expected.spots, 'trips')[0];
    fireEvent.press(screen.getByTestId(`spot-${top.key}`));
    expect(screen.getByTestId(`cell-${top.key}`).props.accessibilityState.selected).toBe(true);
    // Selected cells carry their number, never colour alone.
    expect(within(screen.getByTestId(`cell-${top.key}`)).getByText(String(top.trips))).toBeTruthy();
  });

  it('excluded entries: row and sheet with the reason; nothing to edit', async () => {
    const { expected } = await withHistory();
    expect(expected.excluded).toHaveLength(1);
    fireEvent.press(screen.getByTestId('grounds-excluded'));
    const sheet = screen.getByTestId('ex-sheet');
    expect(within(sheet).getByText('tafi')).toBeTruthy();
    expect(within(sheet).getAllByText(/hayana mahali \(GPS\)/).length).toBeGreaterThan(0);
    expect(within(sheet).getByText('Rekodi hazibadilishwi. Mahali hapawezi kuhaririwa.')).toBeTruthy();
    expect(screen.getByTestId('ex-scrim').props.accessibilityRole).toBe('button');
    fireEvent.press(screen.getByTestId('ex-close'));
    expect(screen.queryByTestId('ex-sheet')).toBeNull();
  });

  it('English and Day colours', async () => {
    await withHistory({ lang: 'en', mode: 'day' });
    expect(screen.getByText('My grounds')).toBeTruthy();
    expect(screen.getByText('Only you can see this map')).toBeTruthy();
    expect(StyleSheet.flatten(screen.getByTestId('grounds-map').props.style).backgroundColor).toBe('#DCE6E8');
    expect(StyleSheet.flatten(screen.getByTestId('screen').props.style).backgroundColor).toBe(DAY.bg);
  });

  it('empty state below 3 trips, with progress and a way back', async () => {
    const ctx = await openTestRepo();
    await seedDevFixtures(ctx.db, ctx.deps); // 2 trips
    const onDone = renderGrounds(ctx.repo, ctx.deps.clock.now());
    await screen.findByTestId('grounds-empty');
    expect(screen.getByText('Rekodi safari 3 au zaidi kuona maeneo yako')).toBeTruthy();
    expect(screen.getByTestId('grounds-progress')).toHaveTextContent('2 / 3');
    expect(screen.queryAllByTestId(/^cell-/)).toHaveLength(0);
    fireEvent.press(screen.getByTestId('grounds-back-trip'));
    expect(onDone).toHaveBeenCalled();
  });
});

describe('S2.1 map button', () => {
  it('opens My grounds and back returns', async () => {
    const ctx = await openTestRepo();
    await seedDevFixtures(ctx.db, ctx.deps, { history: true });
    const open = () => Promise.resolve(ctx.repo);
    const now = ctx.deps.clock.now();
    render(
      <SafeAreaProvider initialMetrics={metrics}>
        <LogbookProvider open={open}>
          <PreferencesProvider>
            <AppScreens now={() => now} />
          </PreferencesProvider>
        </LogbookProvider>
      </SafeAreaProvider>,
    );
    fireEvent.press(await screen.findByLabelText('Maeneo yangu'));
    await screen.findByTestId('grounds-panel');
    fireEvent.press(screen.getByTestId('back'));
    await waitFor(() => expect(screen.getByTestId('trip-total')).toBeTruthy());
  });
});
