import { StyleSheet, Text, View } from 'react-native';

import { fonts, radius } from '../../theme/tokens';
import { Icon } from '../../ui/Icon';
import { useStrings, useTheme } from '../../ui/preferences';

// S1 departure time: captured by the app, never typed, so shown locked.
export function DepartureBox({ time }: { time: string }) {
  const c = useTheme();
  const t = useStrings();
  return (
    <View
      testID="departure"
      accessible
      accessibilityLabel={`${t.departure}, ${t.autoCap}, ${time}`}
      style={[styles.box, { borderColor: c.border }]}
    >
      <View style={styles.labels}>
        <View style={styles.labelRow}>
          <Icon name="lock" size={14} strokeWidth={2} color={c.dim} />
          <Text style={[styles.small, { color: c.dim }]}>{t.departure}</Text>
        </View>
        <Text style={[styles.small, { color: c.dim }]}>{t.autoCap}</Text>
      </View>
      <Text testID="departure-time" style={[styles.time, { color: c.text }]}>
        {time}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: radius,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  labels: { gap: 2, flexShrink: 1 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  small: { fontFamily: fonts.sans, fontSize: 13 },
  time: { fontFamily: fonts.monoSemiBold, fontSize: 24, fontVariant: ['tabular-nums'] },
});
