import { Pressable, StyleSheet, Text, View } from 'react-native';

import { fonts, radius } from '../../theme/tokens';
import { Icon } from '../../ui/Icon';
import { useStrings, useTheme } from '../../ui/preferences';
import { canStepDown, canStepUp, stepCrew } from './model';

// S1 crew card: 64dp minus / plus buttons around the count, 1-24.
export function CrewStepper({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const c = useTheme();
  const t = useStrings();
  const step = (delta: number, enabled: boolean, label: string, icon: 'minus' | 'plus') => (
    <Pressable
      testID={`crew-${icon}`}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !enabled }}
      disabled={!enabled}
      onPress={() => onChange(stepCrew(value, delta))}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: pressed ? c.border : c.raised, opacity: enabled ? 1 : 0.4 },
      ]}
    >
      <Icon name={icon} size={26} strokeWidth={2.2} color={c.text} />
    </Pressable>
  );

  return (
    <View testID="crew-stepper" style={[styles.card, { backgroundColor: c.surface }]}>
      <View style={styles.label}>
        <Icon name="users" size={20} color={c.text} />
        <Text style={[styles.labelText, { color: c.text }]}>{t.crew}</Text>
      </View>
      <View style={styles.stepper}>
        {step(-1, canStepDown(value), t.crewDown, 'minus')}
        <Text testID="crew-count" style={[styles.count, { color: c.text }]}>
          {value}
        </Text>
        {step(1, canStepUp(value), t.crewUp, 'plus')}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: radius,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  label: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  labelText: { fontFamily: fonts.sansSemiBold, fontSize: 17 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  button: { width: 64, height: 64, borderRadius: radius, alignItems: 'center', justifyContent: 'center' },
  count: {
    width: 64,
    textAlign: 'center',
    fontFamily: fonts.monoSemiBold,
    fontSize: 32,
    fontVariant: ['tabular-nums'],
  },
});
