import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { LogbookProvider } from '../../data/LogbookProvider';
import type { Repository } from '../../data/repository';
import { devPreviousTripEntries, devSpecies } from '../../dev/fixtures/reference';
import { seedDevFixtures, seedDevReference } from '../../dev/fixtures/seed';
import { en, sw, type Lang } from '../../i18n/strings';
import { openTestRepo } from '../../test/sqlite';
import { PreferencesProvider } from '../../ui/preferences';
import { EntryDetailScreen } from '../EntryDetailScreen';

const metrics = {
  frame: { x: 0, y: 0, width: 360, height: 740 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};
const speciesId = (n: string) => devSpecies.find((s) => s.local_name === n)!.id;

function renderDetail(repo: Repository, catchId: string, lang: Lang = 'sw') {
  const onDone = jest.fn();
  const open = () => Promise.resolve(repo);
  render(
    <SafeAreaProvider initialMetrics={metrics}>
      <LogbookProvider open={open}>
        <PreferencesProvider initialLang={lang}>
          <EntryDetailScreen catchId={catchId} onDone={onDone} />
        </PreferencesProvider>
      </LogbookProvider>
    </SafeAreaProvider>,
  );
  return onDone;
}

async function openEntry(lang: Lang = 'sw', state?: string) {
  const ctx = await openTestRepo();
  await seedDevReference(ctx.db);
  await ctx.repo.startTrip({ crewDeparted: 4, departureAt: ctx.deps.clock.now() });
  const c = await ctx.repo.logCatch({
    speciesId: speciesId('tewa'),
    quantity: 2400,
    gps: { latitude: -2.27, longitude: 40.93, gps_accuracy_m: 15 },
  });
  if (state) await ctx.db.runAsync('UPDATE sync_state SET state = ? WHERE record_id = ?', [state, c.id]);
  const onDone = renderDetail(ctx.repo, c.id, lang);
  await screen.findByTestId('detail-species');
  return { ...ctx, c, onDone };
}

describe('EntryDetailScreen', () => {
  it('shows the estimate S, not weighed yet, provenance and Sahihisha', async () => {
    const { c } = await openEntry();
    expect(screen.getByText(`Ingizo ${c.short_ref}`)).toBeTruthy();
    expect(screen.getByTestId('detail-species')).toHaveTextContent('tewa');
    expect(screen.getByTestId('detail-estimate')).toHaveTextContent('2.4');
    expect(screen.getByText('Haijapimwa bado')).toBeTruthy();
    expect(screen.queryByTestId('detail-actual')).toBeNull();
    expect(screen.getByText('Asili ya rekodi')).toBeTruthy();
    expect(screen.getByText('2.27S 40.93E ±15 m')).toBeTruthy();
    expect(screen.getByText('KE-LAM-MKW-T20-014')).toBeTruthy();
    expect(screen.getByText('Kwenye kifaa')).toBeTruthy();
    expect(screen.getByTestId('correct')).toBeTruthy();
    expect(screen.queryByTestId('linked')).toBeNull();
  });

  it('Sahihisha adds a linked correction; the original stays and is listed', async () => {
    const { repo, c } = await openEntry();
    fireEvent.press(screen.getByTestId('correct'));
    expect(screen.getByTestId('correct-save')).toBeDisabled(); // nothing changed yet
    for (const k of ['2', '6', '0', '0']) fireEvent.press(screen.getByTestId(`key-${k}`));
    expect(screen.getByTestId('correct-value')).toHaveTextContent('2600');
    fireEvent.press(screen.getByTestId('fish-kibua'));
    fireEvent.press(screen.getByTestId('correct-save'));

    await waitFor(() => expect(screen.queryByTestId('correct-sheet')).toBeNull());
    await waitFor(() => expect(screen.getByTestId('detail-estimate')).toHaveTextContent('2.6'));
    expect(screen.getByTestId('detail-species')).toHaveTextContent('kibua');
    expect(screen.getByTestId('revision-line')).toHaveTextContent(`Marekebisho ya ${c.short_ref}`);
    expect(screen.getByTestId('linked-0')).toHaveTextContent(/Asili.*2\.4/);
    expect(screen.getByTestId('linked-1')).toHaveTextContent(/Marekebisho 1.*2\.6/);

    // Append-only: the original row is unchanged, the correction is its own record.
    const h = (await repo.getCatchHistory(c.id))!;
    expect(h.original).toEqual(c);
    expect(h.corrections).toHaveLength(1);
    expect(await repo.getSyncState(h.corrections[0].id)).toBe('on_device');
    // Totals use the latest revision.
    const [e] = await repo.listTripEntries(c.trip_id);
    expect(e).toMatchObject({ quantity: 2600, unit: 'kg' });

    // A second correction links to the first.
    fireEvent.press(screen.getByTestId('correct'));
    fireEvent.press(screen.getByTestId('quick-1000'));
    fireEvent.press(screen.getByTestId('correct-save'));
    await waitFor(() => expect(screen.getByTestId('detail-estimate')).toHaveTextContent('3.6'));
    const h2 = (await repo.getCatchHistory(c.id))!;
    expect(h2.corrections[1].previous_correction_id).toBe(h2.corrections[0].id);
  });

  it('the old figure starts selected: typing 20 on 15 kg gives 20, not 1520', async () => {
    const ctx = await openTestRepo();
    await seedDevReference(ctx.db);
    await ctx.repo.startTrip({ crewDeparted: 4, departureAt: ctx.deps.clock.now() });
    const c = await ctx.repo.logCatch({ speciesId: speciesId('tewa'), quantity: 15, gps: null });
    renderDetail(ctx.repo, c.id);
    await screen.findByTestId('detail-species');
    expect(screen.getByTestId('detail-estimate')).toHaveTextContent('0.015');
    fireEvent.press(screen.getByTestId('correct'));
    expect(screen.getByTestId('correct-value')).toHaveTextContent(/^15$/);
    expect(screen.getByTestId('correct-value').props.accessibilityState).toEqual({ selected: true });
    for (const k of ['2', '0']) fireEvent.press(screen.getByTestId(`key-${k}`));
    expect(screen.getByTestId('correct-value')).toHaveTextContent(/^20$/);
    fireEvent.press(screen.getByTestId('correct-save'));
    await waitFor(() => expect(screen.queryByTestId('correct-sheet')).toBeNull());
    const [e] = await ctx.repo.listTripEntries(c.trip_id);
    expect(e).toMatchObject({ quantity: 20, unit: 'kg' });
  });

  it('typing a digit first replaces the old figure; a quick key adds to it', async () => {
    await openEntry();
    fireEvent.press(screen.getByTestId('correct'));
    fireEvent.press(screen.getByTestId('key-3'));
    expect(screen.getByTestId('correct-value')).toHaveTextContent(/^3$/);
    expect(screen.getByTestId('correct-value').props.accessibilityState).toEqual({ selected: false });
    expect(screen.getByTestId('correct-scrim').props.accessibilityRole).toBe('button');
    fireEvent.press(screen.getByTestId('correct-scrim'));
    fireEvent.press(screen.getByTestId('correct'));
    fireEvent.press(screen.getByTestId('quick-500'));
    expect(screen.getByTestId('correct-value')).toHaveTextContent(/^2900$/);
  });

  it('an "Other" catch shows its name as typed; correcting the quantity keeps it', async () => {
    const ctx = await openTestRepo();
    await seedDevReference(ctx.db);
    await ctx.repo.startTrip({ crewDeparted: 4, departureAt: ctx.deps.clock.now() });
    const c = await ctx.repo.logCatch({ speciesId: null, speciesLocalName: 'Pweza Mdogo', quantity: 15, gps: null });
    renderDetail(ctx.repo, c.id);
    await screen.findByTestId('detail-species');
    expect(screen.getByTestId('detail-species')).toHaveTextContent('Pweza Mdogo');
    fireEvent.press(screen.getByTestId('correct'));
    for (const k of ['2', '0']) fireEvent.press(screen.getByTestId(`key-${k}`));
    fireEvent.press(screen.getByTestId('correct-save'));
    await waitFor(() => expect(screen.queryByTestId('correct-sheet')).toBeNull());
    expect(await screen.findByTestId('linked-1')).toHaveTextContent(/0\.02/);
    expect(screen.getByTestId('detail-species')).toHaveTextContent('Pweza Mdogo');
    const h = (await ctx.repo.getCatchHistory(c.id))!;
    expect(h.corrections[0]).toMatchObject({ species_id: null, species_local_name: 'Pweza Mdogo', quantity: 20 });
  });

  it('a weighed entry shows W and the difference, and corrections are closed', async () => {
    const ctx = await openTestRepo();
    await seedDevFixtures(ctx.db, ctx.deps);
    const [prev] = await ctx.repo.listClosedTrips();
    const e = prev.entries[0]; // newest: the fixture's last entry
    const fx = devPreviousTripEntries[devPreviousTripEntries.length - 1];
    renderDetail(ctx.repo, e.id, 'en');
    await screen.findByTestId('detail-species');
    expect(fx).toMatchObject({ kg: 6400, plant: 6100 });
    expect(screen.getByTestId('detail-estimate')).toHaveTextContent('6.4');
    expect(screen.getByTestId('detail-actual')).toHaveTextContent('6.1');
    expect(screen.getByTestId('detail-diff')).toHaveTextContent('−0.3');
    expect(screen.getByText(/weighed at plant$/)).toBeTruthy();
    expect(screen.getByText('Weighed at plant. Corrections closed.')).toBeTruthy();
    expect(screen.queryByTestId('correct')).toBeNull();
  });

  it('an entry being checked shows the calm note', async () => {
    await openEntry('sw', 'being_checked');
    expect(screen.getByTestId('checking-note')).toBeTruthy();
    expect(screen.getByText('Inakaguliwa')).toBeTruthy();
    expect(screen.getByText('Ingizo hili linakaguliwa. Unaweza kuendelea kurekodi.')).toBeTruthy();
  });

  it('an unknown entry says so in Kiswahili', async () => {
    const ctx = await openTestRepo();
    await seedDevReference(ctx.db);
    renderDetail(ctx.repo, 'not-on-this-device');
    expect(await screen.findByText(sw.entryNotFound)).toBeTruthy();
    expect(screen.queryByText(en.entryNotFound)).toBeNull();
  });

  it('back returns to the trip', async () => {
    const { onDone } = await openEntry('en');
    fireEvent.press(screen.getByText("Today's trip"));
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
