import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fonts } from '../theme/tokens';
import { PreferenceToggles } from '../ui/PreferenceToggles';
import { usePreferences, useStrings, useTheme } from '../ui/preferences';

// Scaffold screen: shows the design tokens, fonts and strings, and the
// Night/Day + SW/EN toggles. Replaced by S2.1 Trip home in a later slice.
export function PlaceholderScreen() {
  const { mode } = usePreferences();
  const c = useTheme();
  const t = useStrings();
  const insets = useSafeAreaInsets();

  return (
    <View
      testID="screen"
      style={[styles.screen, { backgroundColor: c.bg, paddingTop: insets.top + 12 }]}
    >
      <StatusBar style={mode === 'night' ? 'light' : 'dark'} />
      <View style={styles.header}>
        <Text style={[styles.title, { color: c.text }]}>{t.trip}</Text>
        <PreferenceToggles />
      </View>
      <View style={styles.empty}>
        <Text style={[styles.emptyTitle, { color: c.text }]}>{t.noEntries}</Text>
        <Text style={[styles.emptyBody, { color: c.dim }]}>{t.startToLog}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 16 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: { fontFamily: fonts.sansSemiBold, fontSize: 24, flexShrink: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyTitle: { fontFamily: fonts.sansSemiBold, fontSize: 20 },
  emptyBody: { fontFamily: fonts.sans, fontSize: 16, textAlign: 'center' },
});
