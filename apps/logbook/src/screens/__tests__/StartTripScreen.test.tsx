import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { LogbookProvider } from '../../data/LogbookProvider';
import type { Repository } from '../../data/repository';
import { seedDevFixtures, seedDevReference } from '../../dev/fixtures/seed';
import { openTestRepo } from '../../test/sqlite';
import { DAY } from '../../theme/tokens';
import { formatTime } from '../../ui/format';
import { PreferencesProvider } from '../../ui/preferences';
import { en, sw, type Lang } from '../../i18n/strings';
import type { Mode } from '../../theme/tokens';
import { StartTripScreen } from '../StartTripScreen';

const metrics = {
  frame: { x: 0, y: 0, width: 360, height: 740 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

function renderStart(
  repo: Repository,
  now: Date,
  { lang = 'sw', mode = 'night' }: { lang?: Lang; mode?: Mode } = {},
) {
  const onDone = jest.fn();
  const open = () => Promise.resolve(repo);
  const clock = () => now;
  render(
    <SafeAreaProvider initialMetrics={metrics}>
      <LogbookProvider open={open}>
        <PreferencesProvider initialLang={lang} initialMode={mode}>
          <StartTripScreen onDone={onDone} now={clock} />
        </PreferencesProvider>
      </LogbookProvider>
    </SafeAreaProvider>,
  );
  return onDone;
}

async function ready(opts?: { lang?: Lang; mode?: Mode }) {
  const ctx = await openTestRepo();
  await seedDevReference(ctx.db);
  const onDone = renderStart(ctx.repo, ctx.deps.clock.now(), opts);
  await screen.findByText('Baraka');
  return { ...ctx, onDone };
}

const count = (db: Awaited<ReturnType<typeof openTestRepo>>['db']) =>
  db.getFirstAsync<{ n: number }>('SELECT count(*) AS n FROM trip_starts', []).then((r) => r!.n);

describe('StartTripScreen ready', () => {
  it('shows the vessel card, crew 4, the locked departure and the site notice', async () => {
    const { deps } = await ready();
    expect(screen.getAllByText('Anza safari')).toHaveLength(2); // title and button
    expect(screen.getByText('Chombo')).toBeTruthy();
    expect(screen.getByText('KE-LAM-MKW-T20-014')).toBeTruthy();
    expect(screen.getByText('20 t')).toBeTruthy();
    expect(screen.getByText('Pwani')).toBeTruthy();
    expect(screen.getByText('Mokowe')).toBeTruthy();
    expect(screen.getByText('(kilichopangwa)')).toBeTruthy();
    expect(screen.getByTestId('crew-count')).toHaveTextContent('4');
    expect(screen.getByText('imekamatwa yenyewe')).toBeTruthy();
    expect(screen.getByTestId('departure-time')).toHaveTextContent(
      formatTime(deps.clock.now().toISOString()),
    );
    expect(screen.getByText('Kituo chako ni Mokowe.')).toBeTruthy();
    expect(screen.getByText('placeholder')).toBeTruthy();
    expect(screen.queryByTestId('trip-open-note')).toBeNull();
  });

  it('crew stepper stops at 1 and 24', async () => {
    await ready();
    const minus = screen.getByTestId('crew-minus');
    for (let i = 0; i < 5; i++) fireEvent.press(minus);
    expect(screen.getByTestId('crew-count')).toHaveTextContent('1');
    expect(minus).toBeDisabled();
    const plus = screen.getByTestId('crew-plus');
    for (let i = 0; i < 30; i++) fireEvent.press(plus);
    expect(screen.getByTestId('crew-count')).toHaveTextContent('24');
    expect(plus).toBeDisabled();
  });

  it('Anza safari writes one trip_start with the chosen crew_departed, then returns', async () => {
    const { db, repo, deps, onDone } = await ready();
    fireEvent.press(screen.getByTestId('crew-plus'));
    fireEvent.press(screen.getByTestId('primary'));
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    const trip = (await repo.getOpenTrip())!;
    expect(trip.crew_departed).toBe(5);
    expect(trip.departure_at).toBe(deps.clock.now().toISOString());
    expect(await repo.listTripEntries(trip.trip_id)).toEqual([]);
    expect(await count(db)).toBe(1);
  });

  it('a double tap in one frame starts one trip and shows no error', async () => {
    const { db, onDone } = await ready();
    const before = await count(db);
    // Call the same onPress twice before React re-renders (one frame).
    let el: ReturnType<typeof screen.getByTestId> | null = screen.getByTestId('primary');
    while (el && typeof el.props.onPress !== 'function') el = el.parent;
    const onPress = el!.props.onPress as () => Promise<void>;
    let calls: Promise<void>[] = [];
    act(() => {
      calls = [onPress(), onPress()];
    });
    await act(async () => {
      await Promise.all(calls);
    });
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(await count(db)).toBe(before + 1);
    expect(screen.queryByText(/transaction|SqliteError/)).toBeNull();
  });

  it('a trip opened meanwhile turns S1 into the blocked state, not an error', async () => {
    const { repo, deps, onDone } = await ready();
    await repo.startTrip({ crewDeparted: 3, departureAt: deps.clock.now() });
    fireEvent.press(screen.getByTestId('primary'));
    expect(await screen.findByText(sw.tripOpenNote)).toBeTruthy();
    expect(onDone).not.toHaveBeenCalled();
  });

  it('back returns to S2.1 without creating a trip', async () => {
    const { db, repo, onDone } = await ready();
    fireEvent.press(screen.getByTestId('crew-plus'));
    fireEvent.press(screen.getByLabelText('Rudi'));
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(await count(db)).toBe(0);
    expect(await repo.getOpenTrip()).toBeNull();
  });

  it('English copy and Day palette', async () => {
    await ready({ lang: 'en', mode: 'day' });
    expect(screen.getAllByText('Start trip')).toHaveLength(2);
    expect(screen.getByText('Crew')).toBeTruthy();
    expect(screen.getByLabelText('Back')).toBeTruthy();
    expect(screen.getByText('captured automatically')).toBeTruthy();
    expect(screen.getByText('Your assigned site is Mokowe.')).toBeTruthy();
    expect(StyleSheet.flatten(screen.getByTestId('screen').props.style).backgroundColor).toBe(DAY.bg);
  });
});

describe('StartTripScreen without a vessel', () => {
  it('says no vessel is linked, in Kiswahili', async () => {
    const ctx = await openTestRepo();
    renderStart(ctx.repo, ctx.deps.clock.now());
    expect(await screen.findByText(sw.noVessel)).toBeTruthy();
    expect(screen.queryByText(en.noVessel)).toBeNull();
  });
});

describe('StartTripScreen blocked', () => {
  async function blocked(lang: Lang = 'sw') {
    const ctx = await openTestRepo();
    await seedDevFixtures(ctx.db, ctx.deps);
    const onDone = renderStart(ctx.repo, ctx.deps.clock.now(), { lang });
    await screen.findByText('Baraka');
    return { ...ctx, onDone };
  }

  it('hides the stepper, shows the open trip departure and the note', async () => {
    const { repo } = await blocked();
    const open = (await repo.getOpenTrip())!;
    expect(screen.getByText('Safari iko wazi tayari. Imalize kwanza.')).toBeTruthy();
    expect(screen.queryByTestId('crew-stepper')).toBeNull();
    expect(screen.queryByTestId('site-notice')).toBeNull();
    expect(screen.getByTestId('departure-time')).toHaveTextContent(formatTime(open.departure_at));
  });

  it('Rudi kwenye safari returns without writing a record', async () => {
    const { db, onDone } = await blocked();
    const before = await count(db);
    fireEvent.press(screen.getByText('Rudi kwenye safari'));
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(await count(db)).toBe(before);
  });

  it('English copy', async () => {
    await blocked('en');
    expect(screen.getByText('A trip is already open. Close it first.')).toBeTruthy();
    expect(screen.getByText('Go to open trip')).toBeTruthy();
  });
});
