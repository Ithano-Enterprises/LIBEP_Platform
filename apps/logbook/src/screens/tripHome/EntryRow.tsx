import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Entry } from '../../data/types';
import { radius } from '../../theme/tokens';
import { formatQuantity, formatTime } from '../../ui/format';
import { Icon } from '../../ui/Icon';
import { HoldBox } from '../../ui/HoldBox';
import { useFontSet, useStrings, useTheme, useUnit } from '../../ui/preferences';
import { TierChip } from '../../ui/TierChip';
import { stateKey } from './model';
import { stateStyle } from './stateStyle';

// One catch entry in the trip list (72dp); tap opens the entry detail.
// A weighed entry shows the plant weight with S and W chips and the
// estimate beside it, never one number made of both.
export function EntryRow({
  entry,
  onPress,
}: {
  entry: Entry;
  onPress?: (entry: Entry) => void;
}) {
  const unit = useUnit();
  const c = useTheme();
  const t = useStrings();
  const f = useFontSet();
  const k = stateKey[entry.sync_state];
  const s = stateStyle(k, c);
  const weighed = entry.plant_weight_kg != null;
  const note = weighed
    ? `· ${t.est} ${formatQuantity(entry.quantity, unit)}`
    : entry.correction_count > 0
      ? `· ${t.correctionOf} ${entry.short_ref}`
      : null;
  return (
    <Pressable
      testID={`entry-${entry.id}`}
      accessibilityRole="button"
      disabled={!onPress}
      onPress={() => onPress?.(entry)}
      style={({ pressed }) => [styles.row, { backgroundColor: pressed ? c.raised : c.surface }]}
    >
      <View style={[styles.edge, { backgroundColor: s.edge }]} />
      <View style={styles.body}>
        <View style={styles.line}>
          <View style={styles.what}>
            <Icon name="fish" size={20} strokeWidth={1.6} color={c.dim} />
            <Text style={[styles.species, f.sans, { color: c.text }]} numberOfLines={1}>
              {entry.species_local_name}
            </Text>
            {entry.hold_code ? <HoldBox code={entry.hold_code} /> : null}
          </View>
          <View style={styles.figure}>
            <Text style={[styles.weight, f.monoSemiBold, { color: c.text }]}>
              {formatQuantity(weighed ? entry.plant_weight_kg! : entry.quantity, unit)}
            </Text>
            <Text style={[styles.unit, f.mono, { color: c.dim }]}>{unit}</Text>
            <View style={styles.tiers}>
              <TierChip tier="S" />
              {weighed ? <TierChip tier="W" /> : null}
            </View>
          </View>
        </View>
        <View style={styles.meta}>
          <Text style={[styles.time, f.mono, { color: c.dim }]}>{formatTime(entry.recorded_at)}</Text>
          <View style={styles.state}>
            <Icon name={s.icon} size={14} strokeWidth={2} color={s.color} />
            <Text style={[styles.stateText, f.sansMedium, { color: s.color }]}>{t.states[k]}</Text>
          </View>
          {note ? (
            <Text style={[styles.time, f.mono, { color: c.dim }]} numberOfLines={1}>
              {note}
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', height: 72, borderRadius: radius, overflow: 'hidden' },
  edge: { width: 3 },
  body: { flex: 1, minWidth: 0, paddingVertical: 10, paddingLeft: 12, paddingRight: 14, justifyContent: 'center', gap: 6 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  what: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8 },
  species: { fontSize: 17, flexShrink: 1 },
  figure: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  weight: { fontSize: 20, fontVariant: ['tabular-nums'] },
  unit: { fontSize: 13 },
  tiers: { width: 55, flexDirection: 'row', gap: 3, marginLeft: 4, alignSelf: 'center' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  time: { fontSize: 13 },
  state: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  stateText: { fontSize: 13 },
});
