import { fireEvent, render, screen } from '@testing-library/react-native';
import { useFonts } from 'expo-font';
import { StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';
import mockSafeAreaContext from 'react-native-safe-area-context/jest/mock';

import App from '../App';
import { seedDevFixtures as mockSeed } from '../src/dev/fixtures/seed';
import { openTestRepo as mockOpenTestRepo } from '../src/test/sqlite';
import { NIGHT, plexFonts } from '../src/theme/tokens';

// App mounts the real SafeAreaProvider, which needs native metrics.
jest.mock('react-native-safe-area-context', () => mockSafeAreaContext);
jest.mock('expo-font', () => ({ useFonts: jest.fn() }));
jest.mock('expo-network', () => ({
  useNetworkState: () => ({ isConnected: true, isInternetReachable: true }),
}));
// App opens the on-device store; here it gets a seeded in-memory one.
jest.mock('../src/data/open', () => ({
  openLogbook: async () => {
    const ctx = await mockOpenTestRepo();
    await mockSeed(ctx.db, ctx.deps);
    return ctx.repo;
  },
}));

const mockUseFonts = useFonts as jest.MockedFunction<typeof useFonts>;

const fontFamilies = () =>
  screen.UNSAFE_root
    .findAllByType(Text)
    .map((node: { props: { style: StyleProp<TextStyle> } }) => StyleSheet.flatten(node.props.style)?.fontFamily);

describe('App font loading', () => {
  let warn: jest.SpyInstance;

  beforeEach(() => {
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warn.mockRestore();
    mockUseFonts.mockReset();
  });

  it('shows the dark splash while fonts load', () => {
    mockUseFonts.mockReturnValue([false, null]);
    render(<App />);

    expect(StyleSheet.flatten(screen.getByTestId('font-splash').props.style).backgroundColor).toBe(NIGHT.bg);
    expect(screen.UNSAFE_root.findAllByType(Text)).toHaveLength(0);
    expect(warn).not.toHaveBeenCalled();
  });

  it('renders the app in IBM Plex once fonts load', async () => {
    mockUseFonts.mockReturnValue([true, null]);
    render(<App />);

    expect(screen.queryByTestId('font-splash')).toBeNull();
    expect(StyleSheet.flatten((await screen.findByText('Safari ya leo')).props.style).fontFamily).toBe(
      plexFonts.sansSemiBold.fontFamily,
    );
    expect(warn).not.toHaveBeenCalled();
  });

  it('loads every font family the theme uses', () => {
    mockUseFonts.mockReturnValue([false, null]);
    render(<App />);

    // The map App.tsx actually passes to useFonts, not a copy of it.
    const loaded = Object.keys(mockUseFonts.mock.calls[0][0] as Record<string, unknown>);
    for (const { fontFamily } of Object.values(plexFonts)) {
      expect(loaded).toContain(fontFamily);
    }
  });

  it('falls back to system fonts and stays usable when fonts fail to load', async () => {
    const error = new Error('font file missing');
    mockUseFonts.mockReturnValue([false, error]);
    const { rerender } = render(<App />);

    expect(screen.queryByTestId('font-splash')).toBeNull();
    expect(await screen.findByText('Safari ya leo')).toBeTruthy();
    fireEvent.press(screen.getByTestId('toggle-lang'));
    expect(screen.getByText("Today's trip")).toBeTruthy();

    const families = fontFamilies();
    expect(families.length).toBeGreaterThan(0);
    for (const family of families) {
      expect(family).toBeTruthy();
      expect(family).not.toMatch(/IBMPlex/);
    }

    rerender(<App />);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('using system fonts'), error);
  });
});
