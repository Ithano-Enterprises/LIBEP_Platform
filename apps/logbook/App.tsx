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
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { PlaceholderScreen } from './src/screens/PlaceholderScreen';
import { NIGHT } from './src/theme/tokens';
import { PreferencesProvider } from './src/ui/preferences';

export default function App() {
  // Fonts ship inside the app bundle, so this works offline.
  const [fontsLoaded] = useFonts({
    IBMPlexSans_400Regular,
    IBMPlexSans_500Medium,
    IBMPlexSans_600SemiBold,
    IBMPlexMono_400Regular,
    IBMPlexMono_500Medium,
    IBMPlexMono_600SemiBold,
  });

  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: NIGHT.bg }} />;

  return (
    <SafeAreaProvider>
      <PreferencesProvider>
        <PlaceholderScreen />
      </PreferencesProvider>
    </SafeAreaProvider>
  );
}
