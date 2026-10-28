import { Pressable, StyleSheet, Text, View } from 'react-native';

import { radius } from '../../theme/tokens';
import { Icon } from '../../ui/Icon';
import { useFontSet, useStrings, useTheme } from '../../ui/preferences';
import { pressKey, QUICK_STEPS_KG, quickAdd, type Key } from './model';

// Built-in keypad (no system keyboard) for whole kg: 4 columns, 56dp keys,
// quick keys +500 kg / +1000 kg, and the voice key shown as coming soon.
// No decimal key: the captain enters whole kg.
export function Keypad({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const c = useTheme();
  const t = useStrings();
  const f = useFontSet();

  const digit = (k: Key, label: string = k) => (
    <Pressable
      key={k}
      testID={`key-${k}`}
      accessibilityRole="button"
      accessibilityLabel={k === 'back' ? t.backspace : label}
      onPress={() => onChange(pressKey(value, k))}
      style={({ pressed }) => [styles.key, { backgroundColor: pressed ? c.border : c.raised }]}
    >
      <Text style={[styles.digit, f.monoSemiBold, { color: c.text }]}>{label}</Text>
    </Pressable>
  );

  const quick = (step: number) => (
    <Pressable
      key={`q${step}`}
      testID={`quick-${step}`}
      accessibilityRole="button"
      onPress={() => onChange(quickAdd(value, step))}
      style={({ pressed }) => [
        styles.key,
        styles.quick,
        { borderColor: c.accent, backgroundColor: pressed ? c.raised : 'transparent' },
      ]}
    >
      <Text
        style={[styles.quickText, f.monoSemiBold, { color: c.accent }]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >{`+${step} kg`}</Text>
    </Pressable>
  );

  return (
    <View style={styles.grid}>
      <View style={styles.row}>
        {digit('1')}
        {digit('2')}
        {digit('3')}
        {digit('back', '⌫')}
      </View>
      <View style={styles.row}>
        {digit('4')}
        {digit('5')}
        {digit('6')}
        {quick(QUICK_STEPS_KG[0])}
      </View>
      <View style={styles.row}>
        {digit('7')}
        {digit('8')}
        {digit('9')}
        {quick(QUICK_STEPS_KG[1])}
      </View>
      <View style={styles.row}>
        <View style={styles.zero}>{digit('0')}</View>
        <View
          testID="voice"
          accessible
          accessibilityRole="button"
          accessibilityLabel={t.soon}
          accessibilityState={{ disabled: true }}
          style={[styles.key, styles.mic, { borderColor: c.border }]}
        >
          <Icon name="mic" size={18} color={c.dim} />
          <Text style={[styles.micText, f.sansMedium, { color: c.dim }]}>{t.soon}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { gap: 6 },
  row: { flexDirection: 'row', gap: 6 },
  key: {
    flex: 1,
    height: 56,
    borderRadius: radius,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  digit: { fontSize: 24 },
  zero: { flex: 2, flexDirection: 'row' },
  quick: { borderWidth: 1.5 },
  quickText: { fontSize: 15 },
  mic: { flex: 2, borderWidth: 1, borderStyle: 'dashed', opacity: 0.7 },
  micText: { fontSize: 15 },
});
