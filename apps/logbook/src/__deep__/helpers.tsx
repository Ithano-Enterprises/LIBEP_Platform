import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { LogbookProvider } from '../data/LogbookProvider';
import type { Repository } from '../data/repository';
import type { SqlDb } from '../data/sql';
import type { SyncQueue } from '../data/sync/queue';
import type { Gps } from '../data/types';
import { devSpecies } from '../dev/fixtures/reference';
import { seedDevFixtures } from '../dev/fixtures/seed';
import type { Lang } from '../i18n/strings';
import { AppScreens } from '../screens/AppScreens';
import { openTestRepo } from '../test/sqlite';
import { setWindow } from '../test/window';
import type { Mode } from '../theme/tokens';
import { PreferencesProvider } from '../ui/preferences';

// Shared set-up for the deep tests: the whole app (AppScreens) over an
// in-memory store, with a scripted clock and GPS. Modelled on the
// sandbox scenario in .lamu-local/lamu-sandbox/fishermanDay.test.tsx.

export type Ctx = Awaited<ReturnType<typeof openTestRepo>>;

export const sid = (name: string) => devSpecies.find((s) => s.local_name === name)!.id;
const quote = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Matches the figure on its own, never inside a larger number ("9.7 t" does not match "189.7 t"). */
export const esc = (s: string) => new RegExp(`(^|[^0-9.])${quote(s)}($|[^0-9])`);

export const LEDGER_TABLES = ['trip_starts', 'catches', 'catch_corrections', 'trip_closes'] as const;

/** A store with the dev reference data. `openTrip`/`history` as in the dev seed. */
export async function seeded(opts: { openTrip?: boolean; history?: boolean } = {}) {
  const ctx = await openTestRepo();
  await seedDevFixtures(ctx.db, ctx.deps, { openTrip: false, history: false, ...opts });
  return ctx;
}

export function makeLocator(initial: Gps | null = { latitude: -2.27, longitude: 40.93, gps_accuracy_m: 12 }) {
  let gps = initial;
  return {
    locator: { getFix: jest.fn(async () => gps) },
    setGps: (g: Gps | null) => {
      gps = g;
    },
  };
}

/** Mounts the app the way App.tsx does, at the given window size. */
export function mountApp(
  ctx: Ctx,
  opts: {
    width?: number;
    height?: number;
    locator?: { getFix(): Promise<Gps | null> };
    lang?: Lang;
    mode?: Mode;
    repo?: Repository;
  } = {},
) {
  const width = opts.width ?? 360;
  const height = opts.height ?? 740;
  setWindow({ width, height });
  const metrics = { frame: { x: 0, y: 0, width, height }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
  const repo = opts.repo ?? ctx.repo;
  const open = () => Promise.resolve(repo);
  const locator = opts.locator ?? makeLocator().locator;
  const now = () => ctx.deps.clock.now();
  const ui = () => (
    <SafeAreaProvider initialMetrics={metrics}>
      <LogbookProvider open={open}>
        <PreferencesProvider initialLang={opts.lang} initialMode={opts.mode}>
          <AppScreens now={now} locator={locator} />
        </PreferencesProvider>
      </LogbookProvider>
    </SafeAreaProvider>
  );
  return render(ui());
}

export function press(id: string) {
  fireEvent.press(screen.getByTestId(id));
}

/** Backspace until the keypad figure is empty (the correction sheet starts with e.g. "18.0"). */
export function clearKeys(max = 8) {
  for (let i = 0; i < max; i++) press('key-back');
}

export function typeKeys(v: string) {
  for (const k of v.split('')) press(`key-${k}`);
}

/** Home → S1 → start with the default crew → home. */
export async function startTripUI(crewDelta = 0) {
  await screen.findByTestId('primary');
  press('primary');
  await screen.findByTestId('crew-stepper');
  for (let i = 0; i < Math.abs(crewDelta); i++) press(crewDelta > 0 ? 'crew-plus' : 'crew-minus');
  press('primary');
  await screen.findByTestId('trip-total');
}

/** From S3.3 (menu visible): pick, type, save, wait for the confirmation card. */
export async function saveCatchUI(fish: string, tonnes: string) {
  press(await (async () => {
    await screen.findByTestId(`fish-${fish}`);
    return `fish-${fish}`;
  })());
  await screen.findByTestId('entry-sheet');
  typeKeys(tonnes);
  press('save');
  await screen.findByTestId('confirm-card');
}

/** From the confirmation card: back to the menu for the next fish. */
export async function logAnother() {
  press('log-another');
  await waitFor(() => expect(screen.queryByTestId('confirm-card')).toBeNull());
}

/** Home → S3.3 → save one catch → back home. */
export async function logCatchUI(fish: string, tonnes: string) {
  await screen.findByTestId('primary');
  press('primary');
  await saveCatchUI(fish, tonnes);
  press('view-list');
  await screen.findByTestId('trip-total');
}

export async function count(db: SqlDb, table: string, where = '1 = 1', params: (string | number)[] = []) {
  return (await db.getFirstAsync<{ n: number }>(`SELECT count(*) AS n FROM ${table} WHERE ${where}`, params))!.n;
}

/** Every row of every ledger table, for before/after comparisons. */
export async function ledgerSnapshot(db: SqlDb) {
  const out: Record<string, unknown[]> = {};
  for (const t of LEDGER_TABLES) out[t] = await db.getAllAsync(`SELECT * FROM ${t} ORDER BY id`, []);
  return out;
}

/** Runs the queue until it has nothing more to send; returns every outcome. */
export async function drain(q: SyncQueue, max = 50) {
  const outcomes = [];
  for (let i = 0; i < max; i++) {
    const o = await q.runOnce();
    outcomes.push(o);
    if (o.kind !== 'sent') break;
  }
  return outcomes;
}

/** Walks a rendered host tree. */
export type Node = { type: string; props: Record<string, unknown>; children: (Node | string)[] | null };
export function walk(node: Node | Node[] | null, fn: (n: Node) => void) {
  if (!node) return;
  if (Array.isArray(node)) return node.forEach((n) => walk(n, fn));
  fn(node);
  for (const c of node.children ?? []) if (typeof c !== 'string') walk(c, fn);
}
export function textOf(node: Node): string {
  return (node.children ?? []).map((c) => (typeof c === 'string' ? c : textOf(c))).join('');
}
