import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';

import { devHoldCodes, devMenus } from '../dev/fixtures/reference';
import { filterMenu, parseEntry, pressKey, quickAdd, type Key } from '../screens/logCatch/model';
import { mountApp, press, seeded, startTripUI, typeKeys } from './helpers';

// Area 3: keypad and input on S3.3, at the model and through the screen.

jest.mock('expo-network', () => ({
  useNetworkState: jest.fn(() => ({ isConnected: false, isInternetReachable: false })),
}));

const seq = (keys: string, start = '') =>
  keys.split(' ').filter(Boolean).reduce((v, k) => pressKey(v, k as Key), start);

describe('keypad model', () => {
  it.each([
    ['0', '0'],
    ['0 0 0', '0'],
    ['0 0 7', '7'],
    ['0 . 5', '0.5'],
    ['. 5', '0.5'],
    ['. .', '0.'],
    ['1 . . 2', '1.2'],
    ['1 . 2 . 3', '1.2'],
    ['1 . 2 3', '1.2'], // one decimal only
    ['1 2 3 4 5 6', '12345'], // five digits at most
    ['1 2 3 4 . 5 6', '1234.5'],
    ['1 2 3 4 5 . 6', '12345.'],
    ['back', ''],
    ['back back', ''],
    ['2 . back', '2'],
    ['2 . 4 back back back', ''],
    ['1 0', '10'],
    ['1 0 0', '100'],
  ])('%s → %p', (keys, want) => {
    expect(seq(keys)).toBe(want);
  });

  it('every figure the keypad can build has at most 5 digits and 1 decimal', () => {
    const keys: Key[] = ['0', '1', '9', '.', 'back'];
    let frontier = new Set(['']);
    const all = new Set(['']);
    for (let d = 0; d < 8; d++) {
      const next = new Set<string>();
      for (const v of frontier) for (const k of keys) {
        const n = pressKey(v, k);
        if (!all.has(n)) next.add(n);
        all.add(n);
      }
      frontier = next;
    }
    for (const v of all) {
      expect(v.replace('.', '').length).toBeLessThanOrEqual(5);
      expect((v.split('.')[1] ?? '').length).toBeLessThanOrEqual(1);
      expect(v.split('.').length).toBeLessThanOrEqual(2);
      expect(/^0\d/.test(v)).toBe(false); // no leading zeros
    }
  });

  it.each([
    ['', 0.5, '0.5'],
    ['', 1, '1'],
    ['0.', 0.5, '0.5'],
    ['2.4', 0.5, '2.9'],
    ['2.5', 0.5, '3'],
    ['2.4', 1, '3.4'],
    ['0.1', 0.5, '0.6'],
    ['19.9', 0.5, '20.4'],
  ])('quick add %p + %p → %p', (from, step, want) => {
    expect(quickAdd(from, step)).toBe(want);
    expect(parseEntry(quickAdd(from, step))).not.toBeNull();
  });

  it('repeated +0.5 stays on one decimal (no float drift)', () => {
    let v = '';
    for (let i = 0; i < 37; i++) v = quickAdd(v, 0.5);
    expect(v).toBe('18.5');
    v = '0.1';
    for (let i = 0; i < 30; i++) v = quickAdd(v, 1);
    expect(v).toBe('30.1');
  });

  // BUG-7: the quick keys ignore the keypad's 5-digit limit: 99999 + 1 gives
  // "100000" and 9999.9 + 0.5 gives "10000.4", figures the keys alone refuse.
  it.failing.each([
    ['99999', 1],
    ['9999.9', 0.5],
    ['99999', 0.5],
  ])('quick add on %p + %p keeps at most 5 digits', (from, step) => {
    expect(quickAdd(from, step).replace('.', '').length).toBeLessThanOrEqual(5);
  });

  it('search matches the local name or the English gloss, case and spaces ignored', () => {
    const menu = [
      { id: '1', local_name: 'tewa', english_gloss: 'grouper', sort: 0, hold_code: 'A' as const },
      { id: '2', local_name: 'nguru', english_gloss: 'kingfish', sort: 1, hold_code: 'B' as const },
      { id: '3', local_name: 'chaa', english_gloss: null, sort: 2, hold_code: null },
    ];
    expect(filterMenu(menu, '').map((m) => m.id)).toEqual(['1', '2', '3']);
    expect(filterMenu(menu, '   ').map((m) => m.id)).toEqual(['1', '2', '3']);
    expect(filterMenu(menu, ' TEW ').map((m) => m.id)).toEqual(['1']);
    expect(filterMenu(menu, 'king').map((m) => m.id)).toEqual(['2']);
    expect(filterMenu(menu, 'a').map((m) => m.id)).toEqual(['1', '3']);
    expect(filterMenu(menu, 'zzz')).toEqual([]);
  });
});

async function openLog() {
  const ctx = await seeded();
  mountApp(ctx);
  await startTripUI();
  press('primary');
  await screen.findByTestId('search');
  return ctx;
}

const disabled = (id: string) => !!screen.getByTestId(id).props.accessibilityState?.disabled;

describe('S3.3 keypad through the screen', () => {
  it('Save stays disabled for "", "0", "0.", "0.0" and enables at 0.1', async () => {
    await openLog();
    press('fish-tewa');
    await screen.findByTestId('entry-sheet');
    expect(disabled('save')).toBe(true);
    expect(screen.getByTestId('entry-value')).toHaveTextContent('0');
    press('key-0');
    expect(disabled('save')).toBe(true);
    press('key-.');
    expect(screen.getByTestId('entry-value')).toHaveTextContent('0.');
    expect(disabled('save')).toBe(true);
    press('key-0');
    expect(disabled('save')).toBe(true);
    press('key-back');
    press('key-1');
    expect(screen.getByTestId('entry-value')).toHaveTextContent('0.1');
    expect(disabled('save')).toBe(false);
    // A disabled Save writes nothing.
    press('key-back');
    press('key-back');
    press('key-back');
    expect(disabled('save')).toBe(true);
  });

  it('a disabled Save writes nothing when pressed', async () => {
    const ctx = await openLog();
    press('fish-tewa');
    await screen.findByTestId('entry-sheet');
    const trip = (await ctx.repo.getOpenTrip())!;
    press('save');
    press('key-0');
    press('save');
    await new Promise((r) => setTimeout(r, 50));
    expect(await ctx.repo.listTripEntries(trip.trip_id)).toHaveLength(0);
    expect(screen.queryByTestId('confirm-card')).toBeNull();
  });

  it('key sequences on screen match the model, and quick keys add', async () => {
    await openLog();
    press('fish-nguru');
    await screen.findByTestId('entry-sheet');
    typeKeys('0071.23');
    expect(screen.getByTestId('entry-value')).toHaveTextContent(/^71\.2$/);
    press('quick-0.5');
    expect(screen.getByTestId('entry-value')).toHaveTextContent(/^71\.7$/);
    press('quick-1');
    expect(screen.getByTestId('entry-value')).toHaveTextContent(/^72\.7$/);
    for (let i = 0; i < 6; i++) press('key-back');
    expect(screen.getByTestId('entry-value')).toHaveTextContent(/^0$/);
    press('quick-1');
    press('quick-0.5');
    expect(screen.getByTestId('entry-value')).toHaveTextContent(/^1\.5$/);
  });

  it('picking another fish clears the figure; the same fish again keeps it', async () => {
    await openLog();
    press('fish-tewa');
    typeKeys('3.3');
    press('fish-tewa');
    expect(screen.getByTestId('entry-value')).toHaveTextContent(/^3\.3$/);
    // On phone the sheet covers the menu; close it with the scrim and pick another.
    press('scrim');
    press('fish-kibua');
    await screen.findByTestId('entry-sheet');
    expect(screen.getByTestId('entry-value')).toHaveTextContent(/^0$/);
  });

  it('"Tafuta" is never auto-focused and filters the menu by name or gloss', async () => {
    await openLog();
    const search = screen.getByTestId('search');
    expect(search.props.autoFocus).toBeFalsy();
    expect(screen.getAllByTestId(/^fish-/)).toHaveLength(devMenus[20].length);
    fireEvent.changeText(search, 'ngur');
    await waitFor(() => expect(screen.getAllByTestId(/^fish-/)).toHaveLength(1));
    expect(screen.getByTestId('fish-nguru')).toBeTruthy();
    fireEvent.changeText(search, 'barracuda');
    await waitFor(() => expect(screen.getByTestId('fish-mzia')).toBeTruthy());
    expect(screen.getAllByTestId(/^fish-/)).toHaveLength(1);
    fireEvent.changeText(search, 'qqq');
    await waitFor(() => expect(screen.queryAllByTestId(/^fish-/)).toHaveLength(0));
    fireEvent.changeText(search, '');
    await waitFor(() => expect(screen.getAllByTestId(/^fish-/)).toHaveLength(devMenus[20].length));
  });

  it('"Tafuta" is cleared by "Rekodi samaki mwingine"', async () => {
    await openLog();
    fireEvent.changeText(screen.getByTestId('search'), 'tew');
    press('fish-tewa');
    typeKeys('1');
    press('save');
    await screen.findByTestId('confirm-card');
    press('log-another');
    await waitFor(() => expect(screen.getByTestId('search').props.value).toBe(''));
    expect(screen.getAllByTestId(/^fish-/)).toHaveLength(devMenus[20].length);
  });

  it('every fish tile shows its own hold code, and the sheet repeats it', async () => {
    await openLog();
    for (const name of devMenus[20]) {
      const tile = screen.getByTestId(`fish-${name}`);
      const code = devHoldCodes[name];
      if (code) expect(within(tile).getByText(code)).toBeTruthy();
      for (const other of ['A', 'B', 'C', 'D'].filter((x) => x !== code)) {
        expect(within(tile).queryByText(other)).toBeNull();
      }
    }
    press('fish-kibua');
    const sheet = await screen.findByTestId('entry-sheet');
    expect(within(sheet).getByText(devHoldCodes.kibua)).toBeTruthy();
  });

  it('the voice key is shown as coming soon and does nothing', async () => {
    await openLog();
    press('fish-tewa');
    typeKeys('2');
    const voice = screen.getByTestId('voice');
    expect(voice.props.accessibilityState).toEqual({ disabled: true });
    fireEvent.press(voice);
    expect(screen.getByTestId('entry-value')).toHaveTextContent(/^2$/);
  });

  it('the note is cut at 80 characters and saved trimmed', async () => {
    const ctx = await openLog();
    press('fish-tewa');
    typeKeys('1');
    press('add-note');
    fireEvent.changeText(screen.getByTestId('note'), `  ${'x'.repeat(100)}`);
    press('save');
    await screen.findByTestId('confirm-card');
    const trip = (await ctx.repo.getOpenTrip())!;
    const [e] = await ctx.repo.listTripEntries(trip.trip_id);
    expect(e.note).toBe('x'.repeat(78));
  });
});
