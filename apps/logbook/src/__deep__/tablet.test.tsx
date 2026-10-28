import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { BackHandler, ScrollView, StyleSheet } from 'react-native';

import { devOtherLandingSite } from '../dev/fixtures/reference';
import { strings } from '../i18n/strings';
import { setWindow } from '../test/window';
import { mountApp, press, seeded } from './helpers';

// Area 8: tablet (600dp and up) two-pane layouts on S2.1, S3.3, S4 and My
// grounds; selection, the detail pane and back; phone unchanged at 599.

jest.mock('expo-network', () => ({
  useNetworkState: jest.fn(() => ({ isConnected: true, isInternetReachable: true })),
}));

const sw = strings.sw;
const H = 800;

/** The newest hardware-back handler a screen registered. */
function hardwareBack() {
  const spy = BackHandler.addEventListener as unknown as jest.SpyInstance;
  const calls = spy.mock.calls;
  for (let i = calls.length - 1; i >= 0; i--) {
    const sub = spy.mock.results[i].value as { remove: jest.Mock };
    if (!sub.remove.mock.calls.length) {
      let handled = false;
      act(() => {
        handled = (calls[i][1] as () => boolean)();
      });
      return handled;
    }
  }
  throw new Error('no back handler registered');
}

beforeEach(() => {
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation(() => ({ remove: jest.fn() }) as never);
});
afterEach(() => jest.restoreAllMocks());

async function app(width: number, opts: { history?: boolean } = {}) {
  const ctx = await seeded({ openTrip: true, history: opts.history });
  mountApp(ctx, { width, height: H });
  await screen.findByTestId('trip-total');
  const trip = (await ctx.repo.getOpenTrip())!;
  const entries = await ctx.repo.listTripEntries(trip.trip_id);
  return { ...ctx, trip, entries };
}

describe.each([599, 600, 1280])('window %i dp wide', (width) => {
  const wide = width >= 600;

  it(`S2.1: ${wide ? 'list and detail side by side' : 'phone list; an entry opens full screen'}`, async () => {
    const { entries } = await app(width);
    if (wide) {
      const pane = await screen.findByTestId('detail-pane');
      await waitFor(() => expect(within(pane).getByTestId('detail-species')).toHaveTextContent(entries[0].species_local_name));
      press(`entry-${entries[3].id}`);
      await waitFor(() => expect(within(pane).getByTestId('detail-species')).toHaveTextContent(entries[3].species_local_name));
      expect(screen.getByTestId(`entry-${entries[3].id}`).props.accessibilityState.selected).toBe(true);
      expect(screen.getByTestId(`entry-${entries[0].id}`).props.accessibilityState.selected).toBe(false);
      expect(screen.getByTestId('trip-total')).toBeTruthy(); // still on S2.1
    } else {
      expect(screen.queryByTestId('detail-pane')).toBeNull();
      press(`entry-${entries[3].id}`);
      await screen.findByTestId('detail-species');
      expect(screen.queryByTestId('trip-total')).toBeNull();
      press('back');
      await screen.findByTestId('trip-total');
    }
  });

  it(`S3.3: ${wide ? 'menu with an entry pane' : 'sheet over the menu with a scrim'}; back closes the sheet first`, async () => {
    await app(width);
    press('primary');
    await screen.findByTestId('search');
    if (wide) expect(screen.getByTestId('pick-prompt')).toHaveTextContent(sw.pick);
    else expect(screen.queryByTestId('entry-pane')).toBeNull();
    press('fish-nguru');
    await screen.findByTestId('entry-sheet');
    if (wide) {
      expect(within(screen.getByTestId('entry-pane')).getByTestId('entry-sheet')).toBeTruthy();
      expect(screen.queryByTestId('scrim')).toBeNull();
    } else {
      expect(screen.getByTestId('scrim')).toBeTruthy();
    }
    // Hardware back: first the sheet, then the screen.
    expect(hardwareBack()).toBe(true);
    await waitFor(() => expect(screen.queryByTestId('entry-sheet')).toBeNull());
    expect(screen.getByTestId('search')).toBeTruthy();
    hardwareBack();
    await screen.findByTestId('trip-total');
  });

  it(`S4: ${wide ? 'two columns, site options always shown' : 'site row opens the picker'}`, async () => {
    const { repo, trip } = await app(width);
    press('close-trip');
    await screen.findByTestId('close-total');
    if (wide) {
      expect(screen.queryByTestId('site-row')).toBeNull();
      press(`site-${devOtherLandingSite.name}`);
    } else {
      press('site-row');
      press(await (async () => (await screen.findByTestId(`site-${devOtherLandingSite.name}`), `site-${devOtherLandingSite.name}`))());
    }
    expect(screen.getByTestId('fee-note')).toBeTruthy();
    press('submit');
    await screen.findByTestId('read-only');
    expect((await repo.getTripClose(trip.trip_id))!.landing_site_id).toBe(devOtherLandingSite.id);
  });

  it(`My grounds: ${wide ? 'map and panel side by side, tap hint until a spot is picked' : 'map with a bottom panel'}`, async () => {
    await app(width, { history: true });
    press('open-grounds');
    await screen.findByTestId('grounds-panel');
    if (wide) {
      expect(screen.getByTestId('tap-hint')).toHaveTextContent(sw.tapHint);
      expect(screen.queryByTestId('grounds-expand')).toBeNull();
      const first = screen.getAllByTestId(/^spot-(?!value)/)[0];
      fireEvent.press(first);
      await screen.findByTestId('spot-detail');
      expect(screen.queryByTestId('tap-hint')).toBeNull();
      // Panel back returns to the list, the screen stays.
      fireEvent.press(within(screen.getByTestId('grounds-panel')).getByTestId('back'));
      await screen.findByTestId('tap-hint');
      expect(screen.getByTestId('grounds-panel')).toBeTruthy();
    } else {
      expect(screen.getByTestId('grounds-expand')).toBeTruthy();
      expect(screen.queryByTestId('tap-hint')).toBeNull();
    }
    // Hardware back from the list leaves My grounds.
    hardwareBack();
    await screen.findByTestId('trip-total');
  });
});

describe('turning the device', () => {
  it('phone → tablet keeps the trip and shows the pane; tablet → phone hides it', async () => {
    const { entries } = await app(390);
    expect(screen.queryByTestId('detail-pane')).toBeNull();
    setWindow({ width: 844, height: 390 });
    const pane = await screen.findByTestId('detail-pane');
    await waitFor(() => expect(within(pane).getByTestId('detail-species')).toHaveTextContent(entries[0].species_local_name));
    setWindow({ width: 390, height: 844 });
    await waitFor(() => expect(screen.queryByTestId('detail-pane')).toBeNull());
    expect(screen.getByTestId('trip-total')).toBeTruthy();
  });

  it('a typed figure survives turning the device on S3.3', async () => {
    await app(390);
    press('primary');
    press(await (async () => (await screen.findByTestId('fish-tewa'), 'fish-tewa'))());
    press('key-4');
    setWindow({ width: 844, height: 390 });
    await screen.findByTestId('entry-pane');
    expect(within(screen.getByTestId('entry-pane')).getByTestId('entry-value')).toHaveTextContent(/^4$/);
  });
});

describe('fixed pane widths at the 600dp breakpoint', () => {
  // BUG-11 (fixed): My grounds put the map in a fixed 768dp pane on any
  // window from 600dp. The pane is now min(768, window − 320), so the
  // panel (top spots, spot detail) keeps room on a 600–800dp tablet.
  it('My grounds at 600dp: the map pane fits in the window with room for the panel', async () => {
    await app(600, { history: true });
    press('open-grounds');
    await screen.findByTestId('grounds-panel');
    // The nearest ancestor of the map with a fixed width is the map pane.
    let w: unknown;
    const map = screen.getByTestId('grounds-map');
    for (let el: typeof map | null = map; el; el = el.parent) {
      const s = StyleSheet.flatten(el.props.style);
      if (s && typeof s.width === 'number') {
        w = s.width;
        break;
      }
    }
    expect(typeof w).toBe('number');
    expect(w as number).toBeLessThanOrEqual(600 - 280);
  });

  // BUG-12 (fixed): S3.3 at 600dp kept the 480dp entry pane and shrank fish
  // tiles to 72dp. The pane now narrows and tiles never go under 148dp
  // (TILE_MIN); a narrow menu gets fewer columns.
  it('S3.3 at 600dp: menu tiles are at least 148dp wide', async () => {
    await app(600);
    press('primary');
    await screen.findByTestId('fish-tewa');
    const menu = screen.UNSAFE_getAllByType(ScrollView)[0];
    fireEvent(menu, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 600 - 480, height: 700 } } });
    await waitFor(() => expect(StyleSheet.flatten(screen.getByTestId('fish-tewa').props.style).width).toBeDefined());
    expect(StyleSheet.flatten(screen.getByTestId('fish-tewa').props.style).width).toBeGreaterThanOrEqual(148);
  });

  it('S3.3 at 1280dp: menu tiles are at least 148dp wide', async () => {
    await app(1280);
    press('primary');
    await screen.findByTestId('fish-tewa');
    const menu = screen.UNSAFE_getAllByType(ScrollView)[0];
    fireEvent(menu, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 1280 - 480, height: 700 } } });
    await waitFor(() => expect(StyleSheet.flatten(screen.getByTestId('fish-tewa').props.style).width).toBeGreaterThanOrEqual(148));
  });
});
