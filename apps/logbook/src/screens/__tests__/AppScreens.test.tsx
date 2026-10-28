import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { LogbookProvider } from '../../data/LogbookProvider';
import { seedDevReference } from '../../dev/fixtures/seed';
import { openTestRepo } from '../../test/sqlite';
import { formatTime } from '../../ui/format';
import { PreferencesProvider } from '../../ui/preferences';
import { AppScreens } from '../AppScreens';

jest.mock('expo-network', () => ({
  useNetworkState: jest.fn(() => ({ isConnected: true, isInternetReachable: true })),
}));

const metrics = {
  frame: { x: 0, y: 0, width: 360, height: 740 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

describe('S2.1 -> S1 -> S2.1', () => {
  it('Anza safari opens S1; starting returns to a new empty trip', async () => {
    const ctx = await openTestRepo();
    await seedDevReference(ctx.db);
    const now = ctx.deps.clock.now();
    const open = () => Promise.resolve(ctx.repo);
    const clock = () => now;
    render(
      <SafeAreaProvider initialMetrics={metrics}>
        <LogbookProvider open={open}>
          <PreferencesProvider>
            <AppScreens now={clock} />
          </PreferencesProvider>
        </LogbookProvider>
      </SafeAreaProvider>,
    );

    await screen.findByText('Anza safari ili kurekodi samaki.');
    fireEvent.press(screen.getByTestId('primary'));
    await screen.findByTestId('crew-stepper');

    fireEvent.press(screen.getByTestId('primary'));
    await screen.findByText('Rekodi samaki');
    expect(screen.getByText(`Ilianza ${formatTime(now.toISOString())} · 0 maingizo ·`)).toBeTruthy();
    expect(screen.getByText('Hakuna maingizo bado')).toBeTruthy();
    expect(screen.getByTestId('primary')).toBeDisabled();
  });
});
