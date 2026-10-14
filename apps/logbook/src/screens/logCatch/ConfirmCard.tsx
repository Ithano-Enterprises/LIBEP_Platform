import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { CatchRecord } from '../../data/types';
import { radius } from '../../theme/tokens';
import { formatQuantity, formatTime } from '../../ui/format';
import { HoldBox } from '../../ui/HoldBox';
import { Icon } from '../../ui/Icon';
import { PlaceholderTag } from '../../ui/PlaceholderTag';
import { useFontSet, usePreferences, useStrings, useTheme, useUnit } from '../../ui/preferences';
import { TierChip } from '../../ui/TierChip';
import { stateStyle } from '../tripHome/stateStyle';
import { formatGps } from './model';

// Shown after Hifadhi: what was saved, then log another or go to the list.
// A new entry is always "saved on device" until the sync layer sends it.
export function ConfirmCard({
  record,
  gloss,
  onDismiss,
  onLogAnother,
  onViewList,
  inline = false,
}: {
  /** Tablet: shown in the entry pane instead of floating over the menu. */
  inline?: boolean;
  record: CatchRecord;
  gloss: string | null;
  onDismiss: () => void;
  onLogAnother: () => void;
  onViewList: () => void;
}) {
  const c = useTheme();
  const t = useStrings();
  const { lang } = usePreferences();
  const unit = useUnit();
  const f = useFontSet();
  const s = stateStyle('device', c);
  const gps =
    record.latitude == null || record.longitude == null
      ? null
      : { latitude: record.latitude, longitude: record.longitude, gps_accuracy_m: null };

  const field = (label: string, value: React.ReactNode) => (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, f.sans, { color: c.dim }]}>{label}</Text>
      {value}
    </View>
  );
  const mono = (v: string, id?: string) => (
    <Text testID={id} style={[styles.fieldValue, f.monoSemiBold, { color: c.text }]}>
      {v}
    </Text>
  );

  return (
    <View
      testID="confirm-card"
      style={inline ? styles.inline : [styles.card, { backgroundColor: c.surface, borderColor: c.border }]}
    >
      <View style={styles.titleRow}>
        <View style={styles.title}>
          <Icon name="check" size={22} strokeWidth={2.2} color={c.ok} />
          <Text style={[styles.titleText, f.sansSemiBold, { color: c.ok }]}>{t.savedTitle}</Text>
        </View>
        {inline ? null : (
          <Pressable
            testID="confirm-dismiss"
            accessibilityRole="button"
            accessibilityLabel={t.dismissL}
            onPress={onDismiss}
            style={styles.dismiss}
          >
            <Icon name="x" size={22} color={c.dim} />
          </Pressable>
        )}
      </View>

      <View style={[styles.summary, { backgroundColor: c.raised }]}>
        <View style={styles.what}>
          <Icon name="fish" size={22} color={c.dim} />
          <View style={styles.names}>
            <Text style={[styles.species, f.sansSemiBold, { color: c.text }]}>{record.species_local_name}</Text>
            {lang === 'en' && gloss ? <Text style={[styles.gloss, f.sans, { color: c.dim }]}>{gloss}</Text> : null}
          </View>
          {record.hold_code ? <HoldBox code={record.hold_code} size={24} /> : null}
        </View>
        <View style={styles.figureCol}>
          <View style={styles.figure}>
            <Text testID="confirm-weight" style={[styles.weight, f.monoSemiBold, { color: c.text }]}>
              {formatQuantity(record.quantity, unit)}
            </Text>
            <Text style={[styles.unit, f.mono, { color: c.dim }]}>{unit}</Text>
          </View>
          <View style={styles.estimate}>
            <Text style={[styles.estimateText, f.sansMedium, { color: c.dim }]}>{t.estimate}</Text>
            <TierChip tier="S" size={22} />
          </View>
        </View>
      </View>

      <View style={styles.grid}>
        {field(t.time, mono(formatTime(record.recorded_at)))}
        {field('GPS', mono(formatGps(gps)))}
        {field(t.idL, mono(record.short_ref, 'confirm-ref'))}
        {field(
          t.stateL,
          <View style={styles.state}>
            <Icon name={s.icon} size={16} strokeWidth={2} color={s.color} />
            <Text style={[styles.stateText, f.sansSemiBold, { color: s.color }]}>{t.states.device}</Text>
          </View>,
        )}
      </View>

      <View style={styles.reason}>
        <Text style={[styles.reasonText, f.sans, { color: c.dim }]}>{t.reason}</Text>
        <PlaceholderTag />
      </View>

      <View style={styles.actions}>
        <Pressable
          testID="log-another"
          accessibilityRole="button"
          onPress={onLogAnother}
          style={({ pressed }) => [styles.primary, { backgroundColor: pressed ? c.accentPress : c.accent }]}
        >
          <Icon name="plus" size={22} strokeWidth={2.2} color={c.onAccent} />
          <Text style={[styles.primaryText, f.sansSemiBold, { color: c.onAccent }]}>{t.logAnother}</Text>
        </Pressable>
        <Pressable
          testID="view-list"
          accessibilityRole="button"
          onPress={onViewList}
          style={({ pressed }) => [
            styles.secondary,
            { borderColor: c.border, backgroundColor: pressed ? c.raised : 'transparent' },
          ]}
        >
          <Icon name="list" size={20} color={c.text} />
          <Text style={[styles.secondaryText, f.sansMedium, { color: c.text }]}>{t.viewList}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 8,
    paddingTop: 14,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderWidth: 1,
    borderRadius: 14,
    gap: 12,
    zIndex: 5,
    elevation: 12,
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -12 },
  },
  inline: { gap: 16 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 32 },
  title: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  titleText: { fontSize: 20 },
  dismiss: { width: 56, height: 56, marginVertical: -12, marginRight: -14, alignItems: 'center', justifyContent: 'center' },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 14,
    borderRadius: radius,
  },
  what: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  names: { gap: 1, flexShrink: 1 },
  species: { fontSize: 20, lineHeight: 23 },
  gloss: { fontSize: 13 },
  figureCol: { alignItems: 'flex-end', gap: 6 },
  figure: { flexDirection: 'row', alignItems: 'baseline', gap: 5 },
  weight: { fontSize: 32, lineHeight: 34, fontVariant: ['tabular-nums'] },
  unit: { fontSize: 17 },
  estimate: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  estimateText: { fontSize: 15 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 10, columnGap: 12, paddingHorizontal: 2 },
  field: { flexBasis: '46%', flexGrow: 1, gap: 2 },
  fieldLabel: { fontSize: 13 },
  fieldValue: { fontSize: 15 },
  state: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stateText: { fontSize: 15 },
  reason: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  reasonText: { fontSize: 13, lineHeight: 18, flexShrink: 1 },
  actions: { gap: 8 },
  primary: {
    height: 64,
    borderRadius: radius,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  primaryText: { fontSize: 20 },
  secondary: {
    height: 56,
    borderRadius: radius,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryText: { fontSize: 17 },
});
