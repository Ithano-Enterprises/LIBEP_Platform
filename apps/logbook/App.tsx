import {
  IBMPlexMono_400Regular,
  IBMPlexMono_500Medium,
  IBMPlexMono_600SemiBold,
} from '@expo-google-fonts/ibm-plex-mono';
import {
  IBMPlexSans_400Regular,
  IBMPlexSans_500Medium,
  IBMPlexSans_600SemiBold,
} from '@expo-google-fonts/ibm-plex-sans';
import { useFonts } from 'expo-font';
import { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { PlaceholderScreen } from './src/screens/PlaceholderScreen';
import { NIGHT, plexFonts, systemFonts } from './src/theme/tokens';
import { PreferencesProvider } from './src/ui/preferences';

export default function App() {
  // Fonts ship inside the app bundle, so this works offline.
  const [fontsLoaded, fontError] = useFonts({
    IBMPlexSans_400Regular,
    IBMPlexSans_500Medium,
    IBMPlexSans_600SemiBold,
    IBMPlexMono_400Regular,
    IBMPlexMono_500Medium,
    IBMPlexMono_600SemiBold,
  });

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
      <PreferencesProvider fonts={fontError ? systemFonts : plexFonts}>
        <PlaceholderScreen />
      </PreferencesProvider>
    </SafeAreaProvider>
  );
}
