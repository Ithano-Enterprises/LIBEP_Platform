import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PreferenceToggles } from '../ui/PreferenceToggles';
import { useFontSet, usePreferences, useStrings, useTheme } from '../ui/preferences';

// Scaffold screen: shows the design tokens, fonts and strings, and the
// Night/Day + SW/EN toggles. Replaced by S2.1 Trip home in a later slice.
export function PlaceholderScreen() {
  const { mode } = usePreferences();
  const c = useTheme();
  const f = useFontSet();
  const t = useStrings();
  const insets = useSafeAreaInsets();

  return (
    <View
      testID="screen"
      style={[styles.screen, { backgroundColor: c.bg, paddingTop: insets.top + 12 }]}
    >
      <StatusBar style={mode === 'night' ? 'light' : 'dark'} />
      <View style={styles.header}>
        <Text style={[styles.title, f.sansSemiBold, { color: c.text }]}>{t.trip}</Text>
        <PreferenceToggles />
      </View>
      <View style={styles.empty}>
        <Text style={[styles.emptyTitle, f.sansSemiBold, { color: c.text }]}>{t.noEntries}</Text>
        <Text style={[styles.emptyBody, f.sans, { color: c.dim }]}>{t.startToLog}</Text>
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
  title: { fontSize: 24, flexShrink: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyTitle: { fontSize: 20 },
  emptyBody: { fontSize: 16, textAlign: 'center' },
});
