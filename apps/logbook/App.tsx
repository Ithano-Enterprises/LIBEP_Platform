import { useFonts } from 'expo-font';
import { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { LogbookProvider, openLogbook } from './src/data';
import { createMockTransport } from './src/data/sync/mockTransport';
import { SyncLoop } from './src/data/sync/SyncLoop';
import { AppScreens } from './src/screens/AppScreens';
import { NIGHT, plexFontAssets, plexFonts, systemFonts } from './src/theme/tokens';
import { PreferencesProvider } from './src/ui/preferences';

// Stable reference so the store opens once.
const openStore = () => openLogbook();

// No real sync transport yet. In development, EXPO_PUBLIC_DEV_SYNC=mock
// sends through the mock (no network) so states can be watched changing.
const syncTransport =
  __DEV__ && process.env.EXPO_PUBLIC_DEV_SYNC === 'mock' ? createMockTransport().transport : null;

export default function App() {
  // Fonts ship inside the app bundle, so this works offline.
  const [fontsLoaded, fontError] = useFonts(plexFontAssets);

  useEffect(() => {
    if (fontError) console.warn('[logbook] IBM Plex fonts failed to load; using system fonts.', fontError);
  }, [fontError]);

  // Dark splash while loading. If loading fails, carry on with system fonts
  // rather than staying on a blank screen.
  if (!fontsLoaded && !fontError) {
    return <View testID="font-splash" style={{ flex: 1, backgroundColor: NIGHT.bg }} />;
  }

  return (
    <SafeAreaProvider>
      <LogbookProvider open={openStore}>
        <SyncLoop transport={syncTransport} />
        <PreferencesProvider fonts={fontError ? systemFonts : plexFonts}>
          <AppScreens />
        </PreferencesProvider>
      </LogbookProvider>
    </SafeAreaProvider>
  );
}
