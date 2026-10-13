import { StyleSheet, Text, View } from 'react-native';

import { fonts, tierChip } from '../theme/tokens';
import { usePreferences } from './preferences';

// S (captain estimate) or W (plant weight) chip, as the design's chip().
export function TierChip({ tier, size = 19 }: { tier: 'S' | 'W'; size?: number }) {
  const { mode } = usePreferences();
  const box = { width: size, height: size };
  const text = { fontSize: Math.round(size * 0.68) };
  if (tier === 'W') {
    return (
      <View style={[styles.chip, box, { backgroundColor: tierChip.w.background, borderRadius: 2 }]}>
        <Text style={[styles.letter, text, { color: tierChip.w.text }]}>W</Text>
      </View>
    );
  }
  const day = mode === 'day';
  return (
    <View
      style={[
        styles.chip,
        box,
        { borderRadius: 5 },
        day
          ? { backgroundColor: tierChip.sDay.background }
          : { borderWidth: 1.5, borderColor: tierChip.sNight.border },
      ]}
    >
      <Text style={[styles.letter, text, { color: day ? tierChip.sDay.text : tierChip.sNight.text }]}>
        S
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { alignItems: 'center', justifyContent: 'center' },
  letter: { fontFamily: fonts.monoSemiBold, includeFontPadding: false },
});
