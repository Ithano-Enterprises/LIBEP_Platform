import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { LogbookProvider } from '../../data/LogbookProvider';
import { DataError, type Repository } from '../../data/repository';
import { devOpenTrip, devOpenTripEntries, devOtherLandingSite, devSpecies } from '../../dev/fixtures/reference';
import { seedDevFixtures } from '../../dev/fixtures/seed';
import type { Lang } from '../../i18n/strings';
import { openTestRepo } from '../../test/sqlite';
import { formatTime, sumTonnes } from '../../ui/format';
import { PreferencesProvider } from '../../ui/preferences';
import { CloseTripScreen } from '../CloseTripScreen';

const metrics = {
  frame: { x: 0, y: 0, width: 360, height: 740 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

function renderClose(repo: Repository, now: Date, lang: Lang = 'sw') {
  const onDone = jest.fn();
  const open = () => Promise.resolve(repo);
  const clock = () => now;
  render(
    <SafeAreaProvider initialMetrics={metrics}>
      <LogbookProvider open={open}>
        <PreferencesProvider initialLang={lang}>
          <CloseTripScreen onDone={onDone} now={clock} />
        </PreferencesProvider>
      </LogbookProvider>
    </SafeAreaProvider>,
  );
  return onDone;
}

async function withFixtures(lang: Lang = 'sw') {
  const ctx = await openTestRepo();
  await seedDevFixtures(ctx.db, ctx.deps);
  const trip = (await ctx.repo.getOpenTrip())!;
  const now = ctx.deps.clock.now();
  const onDone = renderClose(ctx.repo, now, lang);
  await screen.findByTestId('close-total');
  return { ...ctx, trip, now, onDone };
}

const total = sumTonnes(devOpenTripEntries.map((e) => e.t));

describe('CloseTripScreen', () => {
  it('shows arrival, total S, assigned site, crew from the start and top 3 types', async () => {
    const { now } = await withFixtures();
    expect(screen.getByTestId('arrival-time')).toHaveTextContent(formatTime(now.toISOString()));
    expect(screen.getByTestId('close-total')).toHaveTextContent(total.toFixed(1));
    expect(screen.getByText('Kituo: Mokowe (kilichopangwa)')).toBeTruthy();
    expect(screen.getByTestId('crew-count')).toHaveTextContent(String(devOpenTrip.crewCount));
    expect(screen.getByText(`Imeunganishwa na maingizo ${devOpenTripEntries.length} · KE-LAM-MKW-T20-014`)).toBeTruthy();
    // kibua 8.7 (×2) is the largest group in the fixture
    const rows = screen.getAllByTestId(/^type-/).map((n) => n.props.testID);
    expect(rows).toEqual(['type-kibua', 'type-tewa', 'type-kolekole']);
    expect(screen.getByTestId('type-kibua')).toHaveTextContent(/×2.*8\.7/);
    expect(screen.getByText('Zaidi (+4)')).toBeTruthy();
    fireEvent.press(screen.getByTestId('types-toggle'));
    expect(screen.getAllByTestId(/^type-/)).toHaveLength(7);
    expect(screen.getByText('Onyesha chache')).toBeTruthy();
    expect(screen.queryByTestId('over-hint')).toBeNull();
  });

  it('Tuma writes trip_close with catch ids, total, crew, site, distance; then read-only', async () => {
    const { repo, trip, now } = await withFixtures();
    fireEvent.press(screen.getByTestId('crew-plus'));
    fireEvent.press(screen.getByTestId('site-row'));
    fireEvent.press(screen.getByTestId(`site-${devOtherLandingSite.name}`));
    expect(screen.getByTestId('fee-note')).toBeTruthy();
    fireEvent.changeText(screen.getByTestId('distance'), '18.5 km');
    fireEvent.press(screen.getByTestId('submit'));

    await screen.findByTestId('read-only');
    expect(screen.getByText('Safari imefungwa · kusoma tu')).toBeTruthy();
    expect(screen.getByText('Kwenye kifaa')).toBeTruthy();
    expect(screen.getByTestId('crew-plus')).toBeDisabled();
    expect(screen.getByTestId('site-row')).toBeDisabled();
    expect(screen.getByTestId('distance').props.editable).toBe(false);

    const close = (await repo.getTripClose(trip.trip_id))!;
    const entries = await repo.listTripEntries(trip.trip_id);
    expect(close).toMatchObject({
      trip_id: trip.trip_id,
      arrival_at: now.toISOString(),
      crew_count: devOpenTrip.crewCount + 1,
      landing_site_id: devOtherLandingSite.id,
      distance_km: 18.5,
      total_quantity: total,
      unit: 't',
    });
    expect([...close.catch_ids].sort()).toEqual(entries.map((e) => e.id).sort());
    expect(await repo.getSyncState(close.id)).toBe('on_device');
    expect(await repo.getOpenTrip()).toBeNull();
    // No more catches on a closed trip.
    await expect(
      repo.logCatch({ speciesId: devSpecies[0].id, quantity: 1, gps: null }),
    ).rejects.toMatchObject({ code: 'no_open_trip' } satisfies Partial<DataError>);
  });

  it('distance is optional (stored as null)', async () => {
    const { repo, trip } = await withFixtures();
    fireEvent.press(screen.getByTestId('submit'));
    await screen.findByTestId('read-only');
    expect((await repo.getTripClose(trip.trip_id))!.distance_km).toBeNull();
  });

  it('warns when the trip total passes the vessel class', async () => {
    const ctx = await openTestRepo();
    await seedDevFixtures(ctx.db, ctx.deps);
    await ctx.repo.logCatch({ speciesId: devSpecies[0].id, quantity: 5, gps: null });
    renderClose(ctx.repo, ctx.deps.clock.now(), 'en');
    await screen.findByTestId('over-hint');
    expect(screen.getByText('Trip total passes 20 t for this boat. Check the figures.')).toBeTruthy();
    expect(screen.getByText('Submit')).toBeTruthy();
  });

  it('back leaves without closing', async () => {
    const { repo, onDone } = await withFixtures();
    fireEvent.press(screen.getByTestId('back'));
    expect(onDone).toHaveBeenCalledTimes(1);
    await waitFor(async () => expect(await repo.getOpenTrip()).not.toBeNull());
  });
});
