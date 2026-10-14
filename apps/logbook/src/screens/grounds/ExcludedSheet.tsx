import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fonts, radius } from '../../theme/tokens';
import { formatDay, formatQuantity, formatTime } from '../../ui/format';
import { Icon } from '../../ui/Icon';
import { usePreferences, useStrings, useTheme } from '../../ui/preferences';
import { TierChip } from '../../ui/TierChip';
import type { Excluded } from './model';

// Entries left off the map, with why. Positions cannot be edited
// (append-only), so there is nothing to fix here.
export function ExcludedSheet({ excluded, onClose }: { excluded: Excluded[]; onClose: () => void }) {
  const c = useTheme();
  const t = useStrings();
  const { lang } = usePreferences();
  const insets = useSafeAreaInsets();
  const noGps = excluded.some((e) => e.reason === 'no_gps');
  const afterClose = excluded.some((e) => e.reason === 'after_close');
  return (
    <>
      <Pressable testID="ex-scrim" accessibilityLabel={t.close} onPress={onClose} style={[StyleSheet.absoluteFill, styles.scrim]} />
      <View
        testID="ex-sheet"
        style={[styles.sheet, { backgroundColor: c.surface, borderTopColor: c.border, paddingBottom: 20 + insets.bottom }]}
      >
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.title}>
            <Icon name="eyeOff" size={20} color={c.dim} />
            <Text style={[styles.titleText, { color: c.text }]}>{t.exTitle}</Text>
          </View>
          {excluded.map(({ catch: x, reason }) => (
            <View key={x.id} style={[styles.row, { borderTopColor: c.border }]}>
              <View style={styles.what}>
                <Text style={[styles.species, { color: c.text }]}>{x.species_local_name}</Text>
                <Text style={[styles.meta, { color: c.dim }]}>
                  {formatDay(new Date(x.recorded_at), lang)} · {formatTime(x.recorded_at)} ·{' '}
                  {reason === 'no_gps' ? t.exNoGps : t.exPort}
                </Text>
              </View>
              <Text style={[styles.value, { color: c.text }]}>{formatQuantity(x.quantity)}</Text>
              <Text style={[styles.meta, { color: c.dim }]}>t</Text>
              <TierChip tier="S" />
            </View>
          ))}
          {afterClose ? <Text style={[styles.why, { color: c.text }]}>{t.exWhy}</Text> : null}
          {noGps ? (
            <Text style={[styles.why, { color: c.text }]}>
              {t.excludedN.replace('{n}', String(excluded.filter((e) => e.reason === 'no_gps').length))}: {t.exNoGps}.
            </Text>
          ) : null}
          <View style={styles.lock}>
            <Icon name="lock" size={16} color={c.dim} />
            <Text style={[styles.meta, { color: c.dim }]}>{t.exLock}</Text>
          </View>
          <Pressable
            testID="ex-close"
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [styles.close, { borderColor: c.border, backgroundColor: pressed ? c.raised : 'transparent' }]}
          >
            <Text style={[styles.closeText, { color: c.text }]}>{t.close}</Text>
          </Pressable>
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  scrim: { backgroundColor: 'rgba(5,9,10,0.55)', zIndex: 30 },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '80%',
    paddingTop: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    zIndex: 31,
  },
  content: { gap: 12 },
  title: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  titleText: { fontFamily: fonts.sansSemiBold, fontSize: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 10, borderTopWidth: 1 },
  what: { flex: 1, gap: 2 },
  species: { fontFamily: fonts.sansMedium, fontSize: 17 },
  meta: { fontFamily: fonts.mono, fontSize: 13 },
  value: { fontFamily: fonts.monoSemiBold, fontSize: 17 },
  why: { fontFamily: fonts.sans, fontSize: 15, lineHeight: 21 },
  lock: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  close: { height: 56, borderRadius: radius, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontFamily: fonts.sansMedium, fontSize: 17 },
});
