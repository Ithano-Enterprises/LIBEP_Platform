import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';

import type { Lang } from '../i18n/strings';
import type { Mode } from '../theme/tokens';
import { openTestRepo } from '../test/sqlite';
import { logAnother, makeLocator, mountApp, press, seeded, typeKeys, type Node } from './helpers';

// Drives the whole app through every screen and state a captain can reach,
// calling `look(name, tree)` at each one. Used by the i18n and accessibility
// checks so they cover the same ground.

export type Look = (name: string, tree: Node | Node[] | null) => void;

const snap = (look: Look, name: string) => look(name, screen.toJSON() as unknown as Node | Node[] | null);

async function tap(id: string) {
  await screen.findByTestId(id);
  press(id);
}

export async function tour(look: Look, opts: { lang?: Lang; mode?: Mode; width?: number } = {}) {
  const ctx = await seeded({ openTrip: true, history: true });
  const { locator } = makeLocator();
  const r = mountApp(ctx, { ...opts, locator });
  await screen.findByTestId('trip-total');
  const trip = (await ctx.repo.getOpenTrip())!;
  const entries = await ctx.repo.listTripEntries(trip.trip_id);

  // S2.1 with an open trip, notices and previous trips open.
  if (screen.queryByTestId('notices-toggle')) press('notices-toggle');
  press('prev-toggle');
  const prev = (await ctx.repo.listClosedTrips()).find((t) => t.entries.some((e) => e.plant_weight_kg != null))!;
  await tap(`prev-trip-${prev.start.trip_id}`);
  snap(look, 'S2.1 trip home');
  for (const k of ['waiting', 'sent', 'checking', 'device']) {
    const f = screen.queryByTestId(`filter-${k}`);
    if (f) {
      fireEvent.press(f);
      snap(look, `S2.1 filter ${k}`);
    }
  }
  const all = screen.queryByTestId('filter-all');
  if (all) fireEvent.press(all);

  // Entry detail: an entry being checked, with the correction sheet.
  const checking = entries.find((e) => e.sync_state === 'being_checked') ?? entries[0];
  if (opts.width && opts.width >= 600) {
    press(`entry-${checking.id}`);
  } else {
    press(`entry-${checking.id}`);
    await screen.findByTestId('detail-species');
  }
  await screen.findByTestId('detail-species');
  snap(look, 'entry detail (being checked)');
  await tap('correct');
  await screen.findByTestId('correct-sheet');
  snap(look, 'correction sheet');
  press('correct-scrim');
  if (!(opts.width && opts.width >= 600)) {
    press('back');
    await screen.findByTestId('trip-total');
  }

  // A weighed entry from the previous trip: W, Tofauti, corrections closed.
  const weighed = prev.entries.find((e) => e.plant_weight_kg != null)!;
  if (!screen.queryByTestId(`prev-entry-${weighed.id}`)) {
    press('prev-toggle');
    await tap(`prev-trip-${prev.start.trip_id}`);
  }
  press(`prev-entry-${weighed.id}`);
  await screen.findByTestId('corr-closed');
  snap(look, 'entry detail (weighed)');
  if (!(opts.width && opts.width >= 600)) {
    press('back');
    await screen.findByTestId('trip-total');
  }

  // S3.3: menu, sheet with the trip warning and a note, then the over-class
  // warning, then the confirmation card.
  press('primary');
  await screen.findByTestId('search');
  snap(look, 'S3.3 menu');
  press('fish-kibua');
  await screen.findByTestId('entry-sheet');
  // The fixture trip is 17,000 kg on a 20 t class: 5,000 kg passes the trip
  // total, 50,000 kg is above the class.
  typeKeys('5000');
  press('add-note');
  snap(look, 'S3.3 sheet (trip warning)');
  typeKeys('0');
  snap(look, 'S3.3 sheet (over class)');
  for (let i = 0; i < 5; i++) press('key-back');
  typeKeys('1200');
  press('save');
  await screen.findByTestId('confirm-card');
  snap(look, 'S3.3 confirmation');
  // "Other": the captain types the local name.
  await logAnother();
  await screen.findByTestId('fish-other');
  press('fish-other');
  // The position for this pick arrives before the snapshot.
  await waitFor(() => expect(screen.getByTestId('auto-gps')).toHaveTextContent(/2\.27S/));
  expect(screen.getByTestId('other-name')).toBeTruthy();
  snap(look, 'S3.3 other species');
  fireEvent.changeText(screen.getByTestId('other-name'), 'pweza mdogo');
  typeKeys('15');
  press('save');
  await screen.findByTestId('confirm-card');
  press('view-list');
  await screen.findByTestId('trip-total');

  // S4: picker, another site (fee note), all types, then read-only.
  press('close-trip');
  await screen.findByTestId('close-total');
  if (screen.queryByTestId('site-row')) press('site-row');
  await tap('site-Lamu');
  if (screen.queryByTestId('types-toggle')) press('types-toggle');
  snap(look, 'S4 close trip');
  // Crew returned differs from crew departed: the confirm card, with a reason.
  press('crew-minus');
  press('submit');
  await screen.findByTestId('crew-mismatch');
  snap(look, 'S4 crew mismatch');
  fireEvent.changeText(screen.getByTestId('crew-reason'), 'alishuka Lamu');
  press('crew-confirm');
  await screen.findByTestId('read-only');
  snap(look, 'S4 read-only');
  press('back');

  // S2.1 with no open trip, then S1.
  await screen.findByTestId('primary');
  snap(look, 'S2.1 no open trip');
  press('primary');
  await screen.findByTestId('crew-stepper');
  snap(look, 'S1 start trip');
  press('back');
  await screen.findByTestId('primary');

  // My grounds: list, spot detail, entries, filters, excluded.
  press('open-grounds');
  await screen.findByTestId('grounds-panel');
  if (screen.queryByTestId('grounds-expand')) press('grounds-expand');
  snap(look, 'S5 my grounds');
  fireEvent.press(screen.getAllByTestId(/^spot-(?!value)/)[0]);
  await screen.findByTestId('spot-detail');
  snap(look, 'S5 spot detail');
  press('see-entries');
  await screen.findByTestId('spot-entries');
  snap(look, 'S5 entries here');
  const panelBack = () => fireEvent.press(within(screen.getByTestId('grounds-panel')).getByTestId('back'));
  panelBack();
  await screen.findByTestId('spot-detail');
  panelBack();
  await screen.findByTestId('chip-range');
  press('chip-range');
  await screen.findByTestId('flt-sheet');
  snap(look, 'S5 filters');
  press('flt-close');
  await waitFor(() => expect(screen.queryByTestId('flt-sheet')).toBeNull());
  if (screen.queryByTestId('grounds-excluded')) {
    press('grounds-excluded');
    await screen.findByTestId('ex-sheet');
    snap(look, 'S5 excluded entries');
    press('ex-close');
  }
  r.unmount();

  // My grounds below 3 trips.
  const few = await seeded();
  const r2 = mountApp(few, opts);
  await tap('open-grounds');
  await screen.findByTestId('grounds-empty');
  snap(look, 'S5 empty state');
  r2.unmount();

  // A device with no vessel linked yet.
  const bare = await openTestRepo();
  const r3 = mountApp(bare, opts);
  await screen.findByText(/\w/);
  snap(look, 'S2.1 no vessel linked');
  r3.unmount();
}
