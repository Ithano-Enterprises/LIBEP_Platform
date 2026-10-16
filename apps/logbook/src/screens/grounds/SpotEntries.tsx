import { StyleSheet, Text, View } from 'react-native';

import type { GroundsCatch } from '../../data/types';
import { radius } from '../../theme/tokens';
import { formatDay, formatQuantity, formatTime } from '../../ui/format';
import { HoldBox } from '../../ui/HoldBox';
import { Icon } from '../../ui/Icon';
import { useFontSet, usePreferences, useStrings, useTheme } from '../../ui/preferences';
import { TierChip } from '../../ui/TierChip';
import { stateKey } from '../tripHome/model';
import { stateStyle } from '../tripHome/stateStyle';

// S5.4 my entries at one spot, newest first. Read-only: corrections live in
// the trip screens.
export function SpotEntries({
  entries,
  glosses,
}: {
  entries: GroundsCatch[];
  glosses: Record<string, string | null>;
}) {
  const c = useTheme();
  const t = useStrings();
  const { lang } = usePreferences();
  const f = useFontSet();
  return (
    <View testID="spot-entries" style={styles.wrap}>
      <View style={styles.inline}>
        <Icon name="lock" size={14} strokeWidth={2} color={c.dim} />
        <Text style={[styles.meta, f.mono, { color: c.dim }]}>
          {t.readOnlyShort} · {entries.length} {t.entriesWord}
        </Text>
      </View>
      {entries.map((e) => {
        const k = stateKey[e.sync_state];
        const s = stateStyle(k, c);
        return (
          <View key={e.id} testID={`spot-entry-${e.id}`} style={[styles.row, { backgroundColor: c.raised }]}>
            <View style={styles.line}>
              <View style={styles.inline}>
                <Icon name="fish" size={18} color={c.dim} />
                <Text style={[styles.species, f.sans, { color: c.text }]}>{e.species_local_name}</Text>
                {e.hold_code ? <HoldBox code={e.hold_code} /> : null}
                {lang === 'en' && glosses[e.species_id] ? (
                  <Text style={[styles.meta, f.mono, { color: c.dim }]}>{glosses[e.species_id]}</Text>
                ) : null}
              </View>
              <View style={styles.inline}>
                <Text style={[styles.value, f.monoSemiBold, { color: c.text }]}>{formatQuantity(e.quantity)}</Text>
                <Text style={[styles.meta, f.mono, { color: c.dim }]}>t</Text>
                <TierChip tier="S" />
              </View>
            </View>
            <View style={styles.inline}>
              <Text style={[styles.meta, f.mono, { color: c.dim }]}>
                {formatDay(new Date(e.recorded_at), lang)} · {formatTime(e.recorded_at)} ·
              </Text>
              <Icon name={s.icon} size={14} strokeWidth={2} color={s.color} />
              <Text style={[styles.state, f.sansMedium, { color: s.color }]}>{t.states[k]}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  row: { minHeight: 64, paddingVertical: 8, paddingHorizontal: 12, borderRadius: radius, gap: 4, justifyContent: 'center' },
  line: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  species: { fontSize: 17 },
  value: { fontSize: 17 },
  meta: { fontSize: 13 },
  state: { fontSize: 13 },
});
