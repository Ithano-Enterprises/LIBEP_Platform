import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { PreferencesProvider, type Unit } from '../ui/preferences';

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

// Renders a screen with the same providers as App.tsx.
export function renderWithProviders(ui: ReactElement, opts: { unit?: Unit } = {}) {
  return render(
    <SafeAreaProvider initialMetrics={metrics}>
      <PreferencesProvider initialUnit={opts.unit}>{ui}</PreferencesProvider>
    </SafeAreaProvider>,
  );
}
