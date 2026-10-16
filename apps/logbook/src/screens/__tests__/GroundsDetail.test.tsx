import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { LogbookProvider } from '../../data/LogbookProvider';
import type { Repository } from '../../data/repository';
import { devSpecies } from '../../dev/fixtures/reference';
import { seedDevFixtures } from '../../dev/fixtures/seed';
import { openTestRepo } from '../../test/sqlite';
import { setWindow, TABLET } from '../../test/window';
import { formatQuantity } from '../../ui/format';
import { PreferencesProvider } from '../../ui/preferences';
import { AppScreens } from '../AppScreens';
import { buildGrounds, DEFAULT_FILTERS, formatCoord, rankSpots, spotOfCatch, type Spot } from '../grounds/model';
import { GroundsScreen, mapPaneWidth } from '../GroundsScreen';

jest.mock('expo-network', () => ({
  useNetworkState: jest.fn(() => ({ isConnected: true, isInternetReachable: true })),
}));

const PHONE_METRICS = { frame: { x: 0, y: 0, width: 360, height: 740 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const kibua = devSpecies.find((s) => s.local_name === 'kibua')!.id;

async function setup() {
  const ctx = await openTestRepo();
  await seedDevFixtures(ctx.db, ctx.deps, { history: true });
  const now = ctx.deps.clock.now();
  const catches = await ctx.repo.listGroundsCatches();
  const grounds = buildGrounds(catches, { now, ...DEFAULT_FILTERS });
  return { ...ctx, now, catches, grounds };
}

/** Tests have no layout pass: give the map a size so cells draw. */
function layoutMap(width = 768, height = 600) {
  fireEvent(screen.getByTestId('grounds-map').children[0], 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width, height } },
  });
}

function renderGrounds(repo: Repository, now: Date, focusCatchId: string | null = null) {
  const open = () => Promise.resolve(repo);
  const onDone = jest.fn();
  render(
    <SafeAreaProvider initialMetrics={PHONE_METRICS}>
      <LogbookProvider open={open}>
        <PreferencesProvider>
          <GroundsScreen onDone={onDone} now={() => now} focusCatchId={focusCatchId} />
        </PreferencesProvider>
      </LogbookProvider>
    </SafeAreaProvider>,
  );
  return onDone;
}

describe('S5.2 spot detail and S5.4 entries (phone)', () => {
  it('a spot with plant weights: tiles, W line, species bars, last fished, then my entries', async () => {
    const { repo, now, grounds, catches } = await setup();
    const weighed = grounds.spots.find((s) => s.plantT != null) as Spot;
    renderGrounds(repo, now);
    fireEvent.press(await screen.findByTestId('grounds-expand'));
    fireEvent.press(screen.getByTestId(`spot-${weighed.key}`));

    expect(await screen.findByTestId('spot-detail')).toBeTruthy();
    expect(screen.getByTestId('panel-title')).toHaveTextContent(formatCoord(weighed.lat, weighed.lon));
    expect(screen.getByTestId('tile-trips')).toHaveTextContent(new RegExp(`Safari${weighed.trips}safari zilizogusa`));
    expect(screen.getByTestId('tile-total')).toHaveTextContent(new RegExp(`${formatQuantity(weighed.t)}t`));
    expect(screen.getByTestId('spot-plant')).toHaveTextContent(
      new RegExp(`Kiwanda kilipima:${formatQuantity(weighed.plantT!)} tW\\(safari ${weighed.plantTrips} kati ya ${weighed.trips}\\)`),
    );
    for (const s of weighed.bySpecies) expect(screen.getByTestId(`bar-${s.name}`)).toBeTruthy();
    expect(screen.getByText('Makadirio yako (S). Uzito wa kiwanda (W) unaonekana safari ikifungwa.')).toBeTruthy();

    fireEvent.press(screen.getByTestId('see-entries'));
    const list = await screen.findByTestId('spot-entries');
    expect(within(list).getAllByTestId(/^spot-entry-/)).toHaveLength(weighed.catchIds.length);
    const newest = catches.filter((x) => weighed.catchIds.includes(x.id))[0];
    expect(within(list).getAllByTestId(/^spot-entry-/)[0].props.testID).toBe(`spot-entry-${newest.id}`);
    expect(screen.getByText('Maingizo yangu hapa')).toBeTruthy();
    // No correcting from here.
    expect(screen.queryByTestId('correct')).toBeNull();

    fireEvent.press(screen.getAllByTestId('back')[1]); // panel back → detail
    expect(await screen.findByTestId('spot-detail')).toBeTruthy();
    fireEvent.press(screen.getAllByTestId('back')[1]); // → list
    expect(await screen.findByText('Maeneo bora')).toBeTruthy();
  });

  it('a spot with few trips says so; an open-trip spot has no W', async () => {
    const { repo, now, grounds, catches } = await setup();
    const open = (await repo.getOpenTrip())!;
    const openOnly = grounds.spots.find((s) =>
      s.catchIds.every((id) => catches.find((x) => x.id === id)!.trip_id === open.trip_id),
    )!;
    renderGrounds(repo, now);
    fireEvent.press(await screen.findByTestId('grounds-expand'));
    fireEvent.press(screen.getByTestId(`spot-${openOnly.key}`));
    await screen.findByTestId('spot-detail');
    expect(screen.getByTestId('rough')).toHaveTextContent(`Safari ${openOnly.trips} tu — makadirio si ya uhakika`);
    expect(screen.getByText('Bado haijapimwa kiwandani')).toBeTruthy();
    expect(screen.getByTestId('spot-last')).toHaveTextContent(/^Leo \d\d:\d\d$/);
  });
});

describe('S5.5 filters', () => {
  it('species filter: live count, then only spots with that fish and its total', async () => {
    const { repo, now, catches } = await setup();
    const only = buildGrounds(catches, { now, ...DEFAULT_FILTERS, species: [kibua] });
    renderGrounds(repo, now);
    fireEvent.press(await screen.findByTestId('chip-species'));
    expect(screen.getByTestId('flt-scrim').props.accessibilityRole).toBe('button');
    fireEvent.press(screen.getByTestId('flt-species-kibua'));
    expect(screen.getByTestId('flt-count')).toHaveTextContent(
      `Maeneo ${only.spots.length} · ${formatQuantity(only.totalT)} t`,
    );
    fireEvent.press(screen.getByTestId('flt-apply'));
    expect(screen.queryByTestId('flt-sheet')).toBeNull();
    expect(screen.getByTestId('grounds-total')).toHaveTextContent(`${formatQuantity(only.totalT)} t`);
    expect(screen.getByText(`kibua · Maeneo ${only.spots.length} ·`)).toBeTruthy();
    fireEvent.press(screen.getByTestId('grounds-expand'));
    expect(screen.getAllByTestId(/^spot-[^v]/).map((n) => n.props.testID.slice(5))).toEqual(
      rankSpots(only.spots, 'trips').map((s) => s.key),
    );
  });

  it('range and season options; close without applying keeps the filters', async () => {
    const { repo, now, catches } = await setup();
    const all = buildGrounds(catches, { now, ...DEFAULT_FILTERS, range: 'all' });
    renderGrounds(repo, now);
    fireEvent.press(await screen.findByTestId('chip-range'));
    fireEvent.press(screen.getByTestId('flt-range-30'));
    fireEvent.press(screen.getByTestId('flt-close'));
    expect(screen.getByTestId('chip-range')).toHaveTextContent(/siku 90/);
    fireEvent.press(screen.getByTestId('chip-range'));
    fireEvent.press(screen.getByTestId('flt-range-all'));
    expect(screen.getByText('Kaskazi Nov–Mac · Kusi Apr–Okt')).toBeTruthy();
    fireEvent.press(screen.getByTestId('flt-apply'));
    expect(screen.getByTestId('chip-range')).toHaveTextContent(/zote/);
    expect(screen.getByTestId('grounds-total')).toHaveTextContent(`${formatQuantity(all.totalT)} t`);
  });
});

describe('S5 tablet and "Ona kwenye ramani"', () => {
  it('tablet: map and panel side by side, hint until a spot is picked', async () => {
    setWindow(TABLET);
    const { repo, now, grounds } = await setup();
    renderGrounds(repo, now);
    expect(await screen.findByTestId('tap-hint')).toBeTruthy();
    expect(screen.getAllByTestId(/^spot-[^v]/)).toHaveLength(grounds.spots.length);
    expect(screen.getByText('Ni wewe tu unayeona ramani hii')).toBeTruthy();
    const top = rankSpots(grounds.spots, 'trips')[0];
    layoutMap();
    fireEvent.press(screen.getByTestId(`cell-${top.key}`));
    expect(await screen.findByTestId('spot-detail')).toBeTruthy();
    expect(screen.getByTestId('grounds-map')).toBeTruthy(); // map stays
  });

  it('map pane: 768dp on a wide tablet, narrower on small ones so the panel keeps 320dp', () => {
    expect(mapPaneWidth(1280)).toBe(768);
    expect(mapPaneWidth(800)).toBe(480);
    expect(mapPaneWidth(600)).toBe(280);
  });

  it('tablet at 600dp: the map pane fits beside the panel', async () => {
    setWindow({ width: 600, height: 960 });
    const { repo, now } = await setup();
    renderGrounds(repo, now);
    expect(await screen.findByTestId('tap-hint')).toBeTruthy();
    let w: unknown;
    const map = screen.getByTestId('grounds-map');
    for (let el: typeof map | null = map; el; el = el.parent) {
      const st = StyleSheet.flatten(el.props.style);
      if (st && typeof st.width === 'number') {
        w = st.width;
        break;
      }
    }
    expect(w).toBe(280);
  });

  it('tablet entry detail → Ona kwenye ramani opens S5 at that spot', async () => {
    setWindow(TABLET);
    const { repo, now, catches } = await setup();
    const open = () => Promise.resolve(repo);
    render(
      <SafeAreaProvider initialMetrics={{ ...PHONE_METRICS, frame: { x: 0, y: 0, ...TABLET } }}>
        <LogbookProvider open={open}>
          <PreferencesProvider>
            <AppScreens now={() => now} />
          </PreferencesProvider>
        </LogbookProvider>
      </SafeAreaProvider>,
    );
    fireEvent.press(await screen.findByTestId('show-on-map'));
    await screen.findByTestId('spot-detail');
    const [newest] = await repo.listTripEntries((await repo.getOpenTrip())!.trip_id);
    const spot = spotOfCatch(buildGrounds(catches, { now, ...DEFAULT_FILTERS }).spots, newest.id)!;
    expect(screen.getByTestId('panel-title')).toHaveTextContent(formatCoord(spot.lat, spot.lon));
    layoutMap();
    await waitFor(() => expect(screen.getByTestId(`cell-${spot.key}`).props.accessibilityState.selected).toBe(true));
  });
});
