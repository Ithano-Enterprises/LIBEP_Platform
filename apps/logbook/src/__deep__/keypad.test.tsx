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
  // Whole kg: no decimal key, at most 6 digits [TO CONFIRM: keypad digit limit].
  it.each([
    ['0', '0'],
    ['0 0 0', '0'],
    ['0 0 7', '7'],
    ['1 5', '15'],
    ['2 4 0 0', '2400'],
    ['1 2 3 4 5 6', '123456'],
    ['1 2 3 4 5 6 7', '123456'], // six digits at most
    ['back', ''],
    ['back back', ''],
    ['2 back', ''],
    ['1 5 back', '1'],
    ['1 0', '10'],
    ['1 0 0', '100'],
  ])('%s → %p', (keys, want) => {
    expect(seq(keys)).toBe(want);
  });

  it('every figure the keypad can build is whole kg with at most 6 digits', () => {
    const keys: Key[] = ['0', '1', '9', 'back'];
    let frontier = new Set(['']);
    const all = new Set(['']);
    for (let d = 0; d < 9; d++) {
      const next = new Set<string>();
      for (const v of frontier) for (const k of keys) {
        const n = pressKey(v, k);
        if (!all.has(n)) next.add(n);
        all.add(n);
      }
      frontier = next;
    }
    for (const v of all) {
      expect(v).toMatch(/^\d{0,6}$/);
      expect(/^0\d/.test(v)).toBe(false); // no leading zeros
    }
  });

  it.each([
    ['', 500, '500'],
    ['', 1000, '1000'],
    ['15', 500, '515'],
    ['2400', 500, '2900'],
    ['2400', 1000, '3400'],
    ['19500', 500, '20000'],
  ])('quick add %p + %p → %p', (from, step, want) => {
    expect(quickAdd(from, step)).toBe(want);
    expect(parseEntry(quickAdd(from, step))).not.toBeNull();
  });

  it('repeated quick keys add whole kg', () => {
    let v = '';
    for (let i = 0; i < 37; i++) v = quickAdd(v, 500);
    expect(v).toBe('18500');
    v = '15';
    for (let i = 0; i < 30; i++) v = quickAdd(v, 1000);
    expect(v).toBe('30015');
  });

  // BUG-7 (fixed): the quick keys ignored the keypad's digit limit; past the
  // limit they now leave the figure unchanged.
  it.each([
    ['999999', 1000],
    ['999600', 500],
  ])('quick add on %p + %p keeps at most 6 digits', (from, step) => {
    expect(quickAdd(from, step)).toBe(from);
  });

  it.each(['2.4', '0.5', '15.0', '-1', '1e3', ' 15'])('%p is not a quantity', (v) => {
    expect(parseEntry(v)).toBeNull();
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
  it('Save stays disabled for "" and "0", enables at 1 kg; there is no decimal key', async () => {
    await openLog();
    press('fish-tewa');
    await screen.findByTestId('entry-sheet');
    expect(screen.queryByTestId('key-.')).toBeNull();
    expect(disabled('save')).toBe(true);
    expect(screen.getByTestId('entry-value')).toHaveTextContent('0');
    press('key-0');
    expect(disabled('save')).toBe(true);
    press('key-1');
    expect(screen.getByTestId('entry-value')).toHaveTextContent(/^1$/);
    expect(disabled('save')).toBe(false);
    press('key-back');
    expect(disabled('save')).toBe(true);
  });

  it('a 15 kg catch is saved as 15 kg, not rounded away', async () => {
    const ctx = await openLog();
    press('fish-tewa');
    typeKeys('15');
    expect(screen.getByTestId('entry-value')).toHaveTextContent(/^15$/);
    press('save');
    await screen.findByTestId('confirm-card');
    expect(screen.getByTestId('confirm-weight')).toHaveTextContent(/^15$/);
    const [e] = await ctx.repo.listTripEntries((await ctx.repo.getOpenTrip())!.trip_id);
    expect(e).toMatchObject({ quantity: 15, unit: 'kg' });
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
    typeKeys('0071');
    expect(screen.getByTestId('entry-value')).toHaveTextContent(/^71$/);
    press('quick-500');
    expect(screen.getByTestId('entry-value')).toHaveTextContent(/^571$/);
    press('quick-1000');
    expect(screen.getByTestId('entry-value')).toHaveTextContent(/^1571$/);
    for (let i = 0; i < 6; i++) press('key-back');
    expect(screen.getByTestId('entry-value')).toHaveTextContent(/^0$/);
    press('quick-1000');
    press('quick-500');
    expect(screen.getByTestId('entry-value')).toHaveTextContent(/^1500$/);
  });

  it('picking another fish clears the figure; the same fish again keeps it', async () => {
    await openLog();
    press('fish-tewa');
    typeKeys('330');
    press('fish-tewa');
    expect(screen.getByTestId('entry-value')).toHaveTextContent(/^330$/);
    // On phone the sheet covers the menu; close it with the scrim and pick another.
    press('scrim');
    press('fish-kibua');
    await screen.findByTestId('entry-sheet');
    expect(screen.getByTestId('entry-value')).toHaveTextContent(/^0$/);
  });

  it('"Tafuta" is never auto-focused and filters the menu by name or gloss; "Other" always stays', async () => {
    await openLog();
    const search = screen.getByTestId('search');
    // Menu fish only; the "Other" tile is counted apart.
    const menuTiles = () => screen.queryAllByTestId(/^fish-(?!other$)/);
    expect(search.props.autoFocus).toBeFalsy();
    expect(menuTiles()).toHaveLength(devMenus[20].length);
    fireEvent.changeText(search, 'ngur');
    await waitFor(() => expect(menuTiles()).toHaveLength(1));
    expect(screen.getByTestId('fish-nguru')).toBeTruthy();
    fireEvent.changeText(search, 'barracuda');
    await waitFor(() => expect(screen.getByTestId('fish-mzia')).toBeTruthy());
    expect(menuTiles()).toHaveLength(1);
    // Nothing on the menu matches: "Other" is still there to type the name.
    fireEvent.changeText(search, 'qqq');
    await waitFor(() => expect(menuTiles()).toHaveLength(0));
    expect(screen.getByTestId('fish-other')).toBeTruthy();
    fireEvent.changeText(search, '');
    await waitFor(() => expect(menuTiles()).toHaveLength(devMenus[20].length));
  });

  it('"Other": the typed name is saved exactly as typed, with species_id null and no hold code', async () => {
    const ctx = await openLog();
    press('fish-other');
    await screen.findByTestId('other-name');
    typeKeys('15');
    expect(disabled('save')).toBe(true); // a name is needed
    fireEvent.changeText(screen.getByTestId('other-name'), '  Pweza  mdogo');
    expect(disabled('save')).toBe(false);
    press('save');
    await screen.findByTestId('confirm-card');
    const [e] = await ctx.repo.listTripEntries((await ctx.repo.getOpenTrip())!.trip_id);
    expect(e).toMatchObject({ species_id: null, species_local_name: '  Pweza  mdogo', hold_code: null, quantity: 15 });
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
    expect(screen.getAllByTestId(/^fish-/)).toHaveLength(devMenus[20].length + 1); // + Other
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
