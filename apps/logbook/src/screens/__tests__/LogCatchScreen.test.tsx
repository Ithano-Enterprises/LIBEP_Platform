import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { LogbookProvider } from '../../data/LogbookProvider';
import type { Locator } from '../../data/location';
import type { Repository } from '../../data/repository';
import type { Gps } from '../../data/types';
import { devHoldCodes, devMenus } from '../../dev/fixtures/reference';
import { seedDevReference } from '../../dev/fixtures/seed';
import { en, sw, type Lang } from '../../i18n/strings';
import { openTestRepo } from '../../test/sqlite';
import { DAY, type Mode } from '../../theme/tokens';
import { PreferencesProvider } from '../../ui/preferences';
import { LogCatchScreen } from '../LogCatchScreen';

const metrics = {
  frame: { x: 0, y: 0, width: 360, height: 740 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

const FIX: Gps = { latitude: -2.274, longitude: 40.931, gps_accuracy_m: 15 };

function renderLog(
  repo: Repository,
  now: Date,
  locator: Locator,
  { lang = 'sw', mode = 'night' }: { lang?: Lang; mode?: Mode } = {},
) {
  const onDone = jest.fn();
  const open = () => Promise.resolve(repo);
  const clock = () => now;
  render(
    <SafeAreaProvider initialMetrics={metrics}>
      <LogbookProvider open={open}>
        <PreferencesProvider initialLang={lang} initialMode={mode}>
          <LogCatchScreen onDone={onDone} now={clock} locator={locator} />
        </PreferencesProvider>
      </LogbookProvider>
    </SafeAreaProvider>,
  );
  return onDone;
}

async function withTrip(opts: { fix?: Gps | null; lang?: Lang; mode?: Mode } = {}) {
  const ctx = await openTestRepo();
  await seedDevReference(ctx.db);
  await ctx.repo.startTrip({ crewDeparted: 4, departureAt: ctx.deps.clock.now() });
  const locator = { getFix: jest.fn(async () => (opts.fix === undefined ? FIX : opts.fix)) };
  const onDone = renderLog(ctx.repo, ctx.deps.clock.now(), locator, opts);
  await screen.findByTestId('fish-tewa');
  return { ...ctx, onDone, locator };
}

const tiles = () => screen.getAllByTestId(/^fish-/).map((n) => n.props.testID.replace('fish-', ''));

describe('LogCatchScreen menu', () => {
  it('shows the menu for the vessel class with hold codes, search not focused', async () => {
    await withTrip();
    expect(tiles()).toEqual([...devMenus[20], 'other']);
    expect(screen.getByText('Menyu: 20 t')).toBeTruthy();
    expect(screen.getAllByText(devHoldCodes.changu).length).toBeGreaterThan(0);
    expect(screen.getByTestId('search').props.autoFocus).toBeFalsy();
    expect(screen.queryByTestId('entry-sheet')).toBeNull();
  });

  it('Tafuta filters by local name or gloss', async () => {
    await withTrip({ lang: 'en' });
    expect(screen.getByText('frigate tuna')).toBeTruthy();
    fireEvent.changeText(screen.getByTestId('search'), 'tuna');
    expect(tiles()).toEqual(['kibua', 'other']);
    fireEvent.changeText(screen.getByTestId('search'), 'TEW');
    expect(tiles()).toEqual(['tewa', 'other']);
  });
});

describe('LogCatchScreen entry sheet', () => {
  it('keypad, quick keys, S chip, locked auto strip, mic disabled', async () => {
    await withTrip();
    fireEvent.press(screen.getByTestId('fish-kibua'));
    expect(screen.getByTestId('entry-sheet')).toBeTruthy();
    expect(screen.getByTestId('save')).toBeDisabled();
    expect(screen.queryByTestId('key-.')).toBeNull();
    expect(screen.getByText('kg')).toBeTruthy();
    for (const k of ['1', '5']) fireEvent.press(screen.getByTestId(`key-${k}`));
    expect(screen.getByTestId('entry-value')).toHaveTextContent('15');
    fireEvent.press(screen.getByTestId('quick-500'));
    expect(screen.getByTestId('entry-value')).toHaveTextContent('515');
    fireEvent.press(screen.getByTestId('quick-1000'));
    expect(screen.getByTestId('entry-value')).toHaveTextContent('1515');
    fireEvent.press(screen.getByTestId('key-back'));
    expect(screen.getByTestId('entry-value')).toHaveTextContent('151');
    expect(screen.getByText('Makadirio')).toBeTruthy();
    expect(screen.getByText('-- °C')).toBeTruthy();
    expect(screen.getByText('kihisi kinasubiriwa')).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId('auto-gps')).toHaveTextContent('2.27S 40.93E ±15 m'));
    expect(screen.getByTestId('voice')).toBeDisabled();
    expect(screen.getByText('Inakuja')).toBeTruthy();
    expect(screen.getByTestId('save')).not.toBeDisabled();
  });

  it('Hifadhi saves one tier-S catch of 15 kg with GPS and shows the confirmation', async () => {
    const { repo, onDone, locator } = await withTrip();
    fireEvent.press(screen.getByTestId('fish-tewa'));
    fireEvent.press(screen.getByTestId('key-1'));
    fireEvent.press(screen.getByTestId('key-5'));
    fireEvent.press(screen.getByTestId('save'));
    await screen.findByTestId('confirm-card');
    expect(onDone).not.toHaveBeenCalled();
    expect(locator.getFix).toHaveBeenCalledTimes(1);
    const trip = (await repo.getOpenTrip())!;
    const [e] = await repo.listTripEntries(trip.trip_id);
    expect(e).toMatchObject({
      species_local_name: 'tewa',
      quantity: 15,
      unit: 'kg',
      tier: 'S',
      hold_code: 'A',
      latitude: FIX.latitude,
      longitude: FIX.longitude,
      gps_accuracy_m: 15,
      note: null,
    });
  });

  it('"Other" saves the name exactly as typed, with no species id', async () => {
    const { repo, onDone } = await withTrip();
    fireEvent.press(screen.getByTestId('fish-other'));
    expect(screen.getByText('Nyingine')).toBeTruthy();
    fireEvent.press(screen.getByTestId('key-1'));
    fireEvent.press(screen.getByTestId('key-5'));
    // A figure alone is not enough: the name is needed too.
    expect(screen.getByTestId('save')).toBeDisabled();
    fireEvent.changeText(screen.getByTestId('other-name'), '   ');
    expect(screen.getByTestId('save')).toBeDisabled();
    fireEvent.changeText(screen.getByTestId('other-name'), 'Pweza Mdogo');
    expect(screen.getByTestId('save')).not.toBeDisabled();
    fireEvent.press(screen.getByTestId('save'));
    await screen.findByTestId('confirm-card');
    expect(screen.getByText('Pweza Mdogo')).toBeTruthy();
    fireEvent.press(screen.getByTestId('view-list'));
    expect(onDone).toHaveBeenCalledTimes(1);
    const [e] = await repo.listTripEntries((await repo.getOpenTrip())!.trip_id);
    expect(e).toMatchObject({
      species_id: null,
      species_local_name: 'Pweza Mdogo',
      hold_code: null,
      quantity: 15,
      unit: 'kg',
    });
  });

  it('"Other" is labelled in English too', async () => {
    await withTrip({ lang: 'en' });
    expect(screen.getByText('Other')).toBeTruthy();
    fireEvent.press(screen.getByTestId('fish-other'));
    expect(screen.getByTestId('other-name').props.placeholder).toBe(en.otherNamePh);
    await waitFor(() => expect(screen.getByTestId('auto-gps')).toHaveTextContent('2.27S 40.93E ±15 m'));
  });

  it('no GPS fix is stored as null, and a note is kept', async () => {
    const { repo, onDone } = await withTrip({ fix: null });
    fireEvent.press(screen.getByTestId('fish-nguru'));
    await waitFor(() => expect(screen.getByTestId('auto-gps')).toHaveTextContent('--'));
    fireEvent.press(screen.getByTestId('key-1'));
    fireEvent.press(screen.getByTestId('add-note'));
    fireEvent.changeText(screen.getByTestId('note'), ' karibu na mwamba ');
    fireEvent.press(screen.getByTestId('save'));
    await screen.findByTestId('confirm-card');
    fireEvent.press(screen.getByTestId('view-list'));
    expect(onDone).toHaveBeenCalledTimes(1);
    const [e] = await repo.listTripEntries((await repo.getOpenTrip())!.trip_id);
    expect(e).toMatchObject({ latitude: null, longitude: null, gps_accuracy_m: null, note: 'karibu na mwamba' });
  });

  it('two saves are two rows, never merged', async () => {
    const { repo } = await withTrip();
    for (let i = 0; i < 2; i++) {
      fireEvent.press(screen.getByTestId('fish-tewa'));
      fireEvent.press(screen.getByTestId('key-1'));
      fireEvent.press(screen.getByTestId('save'));
      await waitFor(async () =>
        expect(await repo.listTripEntries((await repo.getOpenTrip())!.trip_id)).toHaveLength(i + 1),
      );
    }
  });

  it('scrim closes the sheet without saving; back leaves the screen', async () => {
    const { repo, onDone } = await withTrip();
    fireEvent.press(screen.getByTestId('fish-tewa'));
    fireEvent.press(screen.getByTestId('key-5'));
    expect(screen.getByTestId('scrim').props.accessibilityRole).toBe('button');
    fireEvent.press(screen.getByTestId('scrim'));
    expect(screen.queryByTestId('entry-sheet')).toBeNull();
    fireEvent.press(screen.getByLabelText('Rudi', { exact: true }));
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(await repo.listTripEntries((await repo.getOpenTrip())!.trip_id)).toEqual([]);
  });

  it('English and Day', async () => {
    await withTrip({ lang: 'en', mode: 'day' });
    expect(screen.getByText('Log catch')).toBeTruthy();
    fireEvent.press(screen.getByTestId('fish-tewa'));
    await waitFor(() => expect(screen.getByTestId('auto-gps')).toHaveTextContent('2.27S 40.93E ±15 m'));
    expect(screen.getByText('Save')).toBeTruthy();
    expect(screen.getByText('Soon')).toBeTruthy();
    expect(screen.getByText('Captured automatically')).toBeTruthy();
    expect(StyleSheet.flatten(screen.getByTestId('screen').props.style).backgroundColor).toBe(DAY.bg);
  });
});

describe('LogCatchScreen in Kiswahili', () => {
  it('labels the ⌫ key in Kiswahili for screen readers', async () => {
    await withTrip();
    fireEvent.press(screen.getByTestId('fish-tewa'));
    await act(async () => {}); // let the GPS read settle
    expect(screen.getByTestId('key-back').props.accessibilityLabel).toBe(sw.backspace);
    expect(screen.queryByLabelText(en.backspace)).toBeNull();
  });

  it('says no vessel is linked, in Kiswahili', async () => {
    const ctx = await openTestRepo();
    renderLog(ctx.repo, ctx.deps.clock.now(), { getFix: jest.fn(async () => null) });
    expect(await screen.findByText(sw.noVessel)).toBeTruthy();
  });
});

describe('LogCatchScreen confirmation', () => {
  it('shows what was saved: species, kg with S, ID and state', async () => {
    const { repo } = await withTrip();
    fireEvent.press(screen.getByTestId('fish-kibua'));
    for (const k of ['3', '1', '0', '0'] as const) fireEvent.press(screen.getByTestId(`key-${k}`));
    fireEvent.press(screen.getByTestId('save'));
    await screen.findByTestId('confirm-card');
    const [e] = await repo.listTripEntries((await repo.getOpenTrip())!.trip_id);
    expect(screen.getByText('Imehifadhiwa')).toBeTruthy();
    expect(screen.getByTestId('confirm-weight')).toHaveTextContent('3,100');
    expect(screen.getByTestId('confirm-ref')).toHaveTextContent(e.short_ref);
    expect(screen.getByText('Kwenye kifaa')).toBeTruthy();
    expect(screen.getByText('2.27S 40.93E')).toBeTruthy();
  });

  it('Rekodi samaki mwingine goes back to the menu; X dismisses', async () => {
    const { onDone } = await withTrip();
    fireEvent.changeText(screen.getByTestId('search'), 'tew');
    fireEvent.press(screen.getByTestId('fish-tewa'));
    fireEvent.press(screen.getByTestId('key-1'));
    fireEvent.press(screen.getByTestId('save'));
    fireEvent.press(await screen.findByTestId('log-another'));
    expect(screen.queryByTestId('confirm-card')).toBeNull();
    expect(screen.getByTestId('search').props.value).toBe('');
    expect(screen.getAllByTestId(/^fish-/)).toHaveLength(devMenus[20].length + 1); // + Other

    fireEvent.press(screen.getByTestId('fish-tafi'));
    fireEvent.press(screen.getByTestId('key-1'));
    fireEvent.press(screen.getByTestId('save'));
    fireEvent.press(await screen.findByTestId('confirm-dismiss'));
    expect(screen.queryByTestId('confirm-card')).toBeNull();
    expect(onDone).not.toHaveBeenCalled();
  });
});

describe('LogCatchScreen soft warnings', () => {
  it('warns above the class and when the trip total would pass it, but still saves', async () => {
    const { repo } = await withTrip();
    fireEvent.press(screen.getByTestId('fish-kibua'));
    // 19,000 kg, then 20,000 kg (at the class, no warning), then 21,000 kg.
    for (const k of ['1', '9', '0', '0', '0'] as const) fireEvent.press(screen.getByTestId(`key-${k}`));
    expect(screen.queryByTestId('cap-hint')).toBeNull();
    fireEvent.press(screen.getByTestId('quick-1000'));
    expect(screen.queryByTestId('cap-hint')).toBeNull();
    fireEvent.press(screen.getByTestId('quick-1000'));
    expect(screen.getByTestId('cap-hint')).toHaveTextContent('Juu ya daraja la chombo hiki (20 t). Hakiki namba.');
    expect(screen.getByTestId('save')).not.toBeDisabled();
    fireEvent.press(screen.getByTestId('save'));
    await screen.findByTestId('confirm-card');

    // Trip is now 21,000 kg: any further entry passes the class, even 1 kg.
    fireEvent.press(screen.getByTestId('fish-tafi'));
    await waitFor(() => expect(screen.queryByTestId('confirm-card')).toBeNull());
    fireEvent.press(screen.getByTestId('key-1'));
    expect(screen.getByTestId('cap-hint')).toHaveTextContent(
      'Jumla ya safari itazidi 20 t kwa chombo hiki. Hakiki namba.',
    );
    fireEvent.press(screen.getByTestId('save'));
    await screen.findByTestId('confirm-card');
    expect(await repo.listTripEntries((await repo.getOpenTrip())!.trip_id)).toHaveLength(2);
  });
});

describe('LogCatchScreen without an open trip', () => {
  it('shows the start-a-trip note and fish cannot be picked', async () => {
    const ctx = await openTestRepo();
    await seedDevReference(ctx.db);
    renderLog(ctx.repo, ctx.deps.clock.now(), { getFix: jest.fn(async () => null) });
    await screen.findByTestId('no-trip');
    fireEvent.press(screen.getByTestId('fish-tewa'));
    expect(screen.queryByTestId('entry-sheet')).toBeNull();
  });
});
