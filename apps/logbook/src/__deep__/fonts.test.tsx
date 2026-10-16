import { render, screen } from '@testing-library/react-native';
import { useFonts } from 'expo-font';

import App from '../../App';
import { NIGHT, plexFonts, systemFonts } from '../theme/tokens';
import { seeded, textOf, walk, type Node } from './helpers';

// Area 12: font fallback. The IBM Plex fonts ship in the bundle, but if
// loading them fails the app must still open and every screen must use
// the system font.

jest.mock('expo-font', () => ({ useFonts: jest.fn() }));
jest.mock('expo-network', () => ({
  useNetworkState: jest.fn(() => ({ isConnected: false, isInternetReachable: false })),
}));
jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context/jest/mock').default);
// App opens the on-device store; here it gets an in-memory one.
const mockOpen = jest.fn();
jest.mock('../data/open', () => ({ openLogbook: () => mockOpen() }));

const useFontsMock = useFonts as unknown as jest.Mock;
const PLEX = new Set<string>(Object.values(plexFonts).map((f) => f.fontFamily as string));

async function store() {
  const ctx = await seeded({ openTrip: true });
  mockOpen.mockResolvedValue(ctx.repo);
}

function fontFamilies() {
  const used = new Set<string>();
  walk(screen.toJSON() as unknown as Node, (n) => {
    if (n.type !== 'Text') return;
    const styles = ([] as unknown[]).concat(n.props.style ?? []).flat(Infinity) as ({ fontFamily?: string } | null)[];
    for (const s of styles) if (s?.fontFamily) used.add(s.fontFamily);
  });
  return used;
}

describe('fonts', () => {
  it('loaded: the app opens on trip home with IBM Plex', async () => {
    await store();
    useFontsMock.mockReturnValue([true, null]);
    render(<App />);
    await screen.findByTestId('trip-total');
    expect([...fontFamilies()].every((f) => PLEX.has(f))).toBe(true);
  });

  it('still loading: a plain night background, nothing else', async () => {
    await store();
    useFontsMock.mockReturnValue([false, null]);
    render(<App />);
    const root = screen.toJSON() as unknown as Node;
    expect(root.props.style).toMatchObject({ backgroundColor: NIGHT.bg });
    expect(textOf(root)).toBe('');
  });

  // BUG-16 (fixed by PR #29): when the fonts failed to load, App kept the
  // blank loading view for good. It now opens with the system font set.
  it('failed: the app still opens on trip home', async () => {
    await store();
    useFontsMock.mockReturnValue([false, new Error('font load failed')]);
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    render(<App />);
    await screen.findByTestId('trip-total', {}, { timeout: 3000 });
    const system = new Set(Object.values(systemFonts).map((f) => f.fontFamily as string));
    const used = [...fontFamilies()];
    expect(used.length).toBeGreaterThan(0);
    expect(used.every((f) => system.has(f) && !PLEX.has(f))).toBe(true);
    warn.mockRestore();
  });
});
