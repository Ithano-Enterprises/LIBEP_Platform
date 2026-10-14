import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fonts } from '../theme/tokens';
import { Icon } from '../ui/Icon';
import { usePreferences, useStrings, useTheme } from '../ui/preferences';
import { EntryDetailBody } from './entryDetail/EntryDetailBody';

// Entry detail, phone: full screen with a back link to the trip.
export function EntryDetailScreen({ catchId, onDone }: { catchId: string; onDone: () => void }) {
  const { mode } = usePreferences();
  const c = useTheme();
  const t = useStrings();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onDone();
      return true;
    });
    return () => sub.remove();
  }, [onDone]);

  return (
    <View testID="screen" style={[styles.screen, { backgroundColor: c.bg, paddingTop: insets.top }]}>
      <StatusBar style={mode === 'night' ? 'light' : 'dark'} />
      <View style={styles.top}>
        <Pressable
          testID="back"
          accessibilityRole="button"
          accessibilityLabel={t.back}
          onPress={onDone}
          style={styles.back}
        >
          <Icon name="back" size={22} strokeWidth={2} color={c.text} />
          <Text style={[styles.backText, f.sansMedium, { color: c.text }]}>{t.trip}</Text>
        </Pressable>
      </View>
      <EntryDetailBody catchId={catchId} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  top: { paddingTop: 4, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' },
  back: { height: 56, paddingRight: 12, marginLeft: -6, flexDirection: 'row', alignItems: 'center', gap: 4 },
  backText: { fontFamily: fonts.sansMedium, fontSize: 17 },
});
