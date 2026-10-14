import { Pressable, StyleSheet, Text, View } from 'react-native';

import { fonts } from '../../theme/tokens';
import { formatQuantity } from '../../ui/format';
import { Icon } from '../../ui/Icon';
import { usePreferences, useStrings, useTheme } from '../../ui/preferences';
import { TierChip } from '../../ui/TierChip';
import { heatColours } from './heat';
import { formatCoord, heatStep, metricValue, type Metric, type Spot } from './model';

// Ranked spots (64dp rows): the accessible way to pick a spot on a moving
// boat, instead of tapping small map cells. Spots are named by position:
// there is no gazetteer of landmarks yet. [TO CONFIRM: spot names]
export function TopSpots({
  ranked,
  metric,
  selected,
  onSelect,
  limit,
}: {
  ranked: Spot[];
  metric: Metric;
  selected: string | null;
  onSelect: (key: string) => void;
  limit?: number;
}) {
  const c = useTheme();
  const t = useStrings();
  const { mode } = usePreferences();
  const heat = heatColours(mode);
  const values = ranked.map((s) => metricValue(s, metric));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const trips = metric === 'trips';

  return (
    <View>
      {ranked.slice(0, limit).map((s, i) => {
        const sel = s.key === selected;
        return (
          <Pressable
            key={s.key}
            testID={`spot-${s.key}`}
            accessibilityRole="button"
            accessibilityState={{ selected: sel }}
            onPress={() => onSelect(s.key)}
            style={({ pressed }) => [
              styles.row,
              { borderTopColor: c.border, backgroundColor: sel || pressed ? c.raised : 'transparent' },
            ]}
          >
            <Text style={[styles.rank, { color: c.dim }]}>{i + 1}</Text>
            <View
              style={[
                styles.swatch,
                { backgroundColor: heat.fill[heatStep(metricValue(s, metric), min, max) - 1], borderColor: c.border },
              ]}
            />
            <View style={styles.name}>
              <Text style={[styles.coord, { color: c.text }]} numberOfLines={1}>
                {formatCoord(s.lat, s.lon)}
              </Text>
              <View style={styles.secondary}>
                <Text style={[styles.secondaryText, { color: c.dim }]}>
                  {trips ? `${formatQuantity(s.t)} t` : `${s.trips} ${t.tripsWord}`}
                </Text>
                {trips ? <TierChip tier="S" size={16} /> : null}
              </View>
            </View>
            <View style={styles.primary}>
              <Text testID={`spot-value-${s.key}`} style={[styles.value, { color: c.text }]}>
                {trips ? String(s.trips) : formatQuantity(s.t)}
              </Text>
              <Text style={[styles.unit, { color: c.dim }]}>{trips ? t.tripsWord : 't'}</Text>
              {trips ? null : <TierChip tier="S" />}
            </View>
            <Icon name="chevR" size={18} strokeWidth={2} color={c.dim} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 12,
    paddingRight: 10,
    borderTopWidth: 1,
  },
  rank: { width: 18, fontFamily: fonts.monoSemiBold, fontSize: 15, textAlign: 'right' },
  swatch: { width: 24, height: 24, borderRadius: 4, borderWidth: 1 },
  name: { flex: 1, minWidth: 0, gap: 2 },
  coord: { fontFamily: fonts.monoSemiBold, fontSize: 15 },
  secondary: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  secondaryText: { fontFamily: fonts.mono, fontSize: 13 },
  primary: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  value: { fontFamily: fonts.monoSemiBold, fontSize: 20, fontVariant: ['tabular-nums'] },
  unit: { fontFamily: fonts.mono, fontSize: 13, marginRight: 4 },
});
