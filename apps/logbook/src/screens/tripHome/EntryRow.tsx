import { StyleSheet, Text, View } from 'react-native';

import type { Entry } from '../../data/types';
import { radius } from '../../theme/tokens';
import { formatQuantity, formatTime } from '../../ui/format';
import { Icon } from '../../ui/Icon';
import { useFontSet, useStrings, useTheme } from '../../ui/preferences';
import { TierChip } from '../../ui/TierChip';
import { stateKey } from './model';
import { stateStyle } from './stateStyle';

// One catch entry in the trip list (72dp). Opening the entry detail comes
// with the entry detail slice.
export function EntryRow({ entry, unit = 't' }: { entry: Entry; unit?: 't' | 'kg' }) {
  const c = useTheme();
  const t = useStrings();
  const f = useFontSet();
  const k = stateKey[entry.sync_state];
  const s = stateStyle(k, c);
  return (
    <View testID={`entry-${entry.id}`} style={[styles.row, { backgroundColor: c.surface }]}>
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
            <Text style={[styles.weight, f.monoSemiBold, { color: c.text }]}>{formatQuantity(entry.quantity, unit)}</Text>
            <Text style={[styles.unit, f.mono, { color: c.dim }]}>{unit}</Text>
            <View style={styles.tiers}>
              <TierChip tier="S" />
            </View>
          </View>
        </View>
        <View style={styles.meta}>
          <Text style={[styles.time, f.mono, { color: c.dim }]}>{formatTime(entry.recorded_at)}</Text>
          <View style={styles.state}>
            <Icon name={s.icon} size={14} strokeWidth={2} color={s.color} />
            <Text style={[styles.stateText, f.sansMedium, { color: s.color }]}>{t.states[k]}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

export function HoldBox({ code }: { code: string }) {
  const c = useTheme();
  const f = useFontSet();
  return (
    <View style={[styles.hold, { borderColor: c.text }]}>
      <Text style={[styles.holdText, f.monoSemiBold, { color: c.text }]}>{code}</Text>
    </View>
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
  hold: {
    width: 18,
    height: 18,
    borderWidth: 1.5,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  holdText: { fontSize: 12, includeFontPadding: false },
});
