import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { CatchHistory, DeviceProfile, Entry } from '../../data/types';
import { radius } from '../../theme/tokens';
import { formatQuantity, formatSigned, formatTime } from '../../ui/format';
import { HoldBox } from '../../ui/HoldBox';
import { Icon } from '../../ui/Icon';
import { PlaceholderTag } from '../../ui/PlaceholderTag';
import { useFontSet, usePreferences, useStrings, useTheme } from '../../ui/preferences';
import { TierChip } from '../../ui/TierChip';
import { formatGps } from '../logCatch/model';
import { stateKey } from '../tripHome/model';
import { stateStyle } from '../tripHome/stateStyle';

// Entry detail content (design S2.1 detail): estimate S, actual W or "not
// weighed yet", the difference, linked records, provenance, and Sahihisha.
// Used full screen on phone; the tablet pane comes later.
export function EntryDetail({
  entry,
  history,
  profile,
  gloss,
  canCorrect,
  onCorrect,
}: {
  entry: Entry;
  history: CatchHistory | null;
  profile: DeviceProfile;
  gloss: string | null;
  canCorrect: boolean;
  onCorrect: () => void;
}) {
  const c = useTheme();
  const t = useStrings();
  const { lang } = usePreferences();
  const f = useFontSet();
  const k = stateKey[entry.sync_state];
  const s = stateStyle(k, c);
  const w = entry.plant_weight_t;
  const corrected = entry.correction_count > 0;
  const gps =
    entry.latitude == null || entry.longitude == null
      ? null
      : { latitude: entry.latitude, longitude: entry.longitude, gps_accuracy_m: entry.gps_accuracy_m };
  const lastEdit = history?.corrections.at(-1)?.recorded_at ?? entry.recorded_at;

  const prov: [string, string][] = [
    [t.idL, entry.short_ref],
    [t.deviceL, entry.device_id.slice(0, 8).toUpperCase()],
    [t.time, formatTime(entry.recorded_at)],
    ['GPS', formatGps(gps)],
    [t.zoneL, t.zone], // [TO CONFIRM: zone source]
    [t.season, '--'], // [TO CONFIRM: season source]
    [t.waterTemp, '-- °C'], // [TO CONFIRM: sensor]
    [t.vesselIdL, profile.vessel.registration],
  ];

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <View style={styles.headText}>
          <Text style={[styles.no, f.mono, { color: c.dim }]}>
            {t.entry} {entry.short_ref}
          </Text>
          <View style={styles.what}>
            <Icon name="fish" size={24} color={c.dim} />
            <Text testID="detail-species" style={[styles.species, f.sansSemiBold, { color: c.text }]}>
              {entry.species_local_name}
            </Text>
            {entry.hold_code ? <HoldBox code={entry.hold_code} size={26} /> : null}
          </View>
          {lang === 'en' && gloss ? <Text style={[styles.gloss, f.sans, { color: c.dim }]}>{gloss}</Text> : null}
        </View>
        <View style={styles.state}>
          <Icon name={s.icon} size={18} strokeWidth={2} color={s.color} />
          <Text style={[styles.stateText, f.sansSemiBold, { color: s.color }]}>{t.states[k]}</Text>
        </View>
      </View>

      {corrected ? (
        <View testID="revision-line" style={styles.line}>
          <Icon name="pencil" size={18} color={c.dim} />
          <Text style={[styles.lineText, f.sans, { color: c.dim }]}>
            {t.correctionOf} {entry.short_ref}
          </Text>
        </View>
      ) : null}

      {k === 'checking' ? (
        <View testID="checking-note" style={[styles.checking, { borderColor: c.border }]}>
          <Icon name="search" size={18} color={c.dim} />
          <Text style={[styles.checkingText, f.sans, { color: c.text }]}>{t.checkingLine}</Text>
          <PlaceholderTag />
        </View>
      ) : null}

      <View style={[styles.card, { backgroundColor: c.surface }]}>
        {/* Design note: whether the captain sees the plant weight is [TO CONFIRM]. */}
        <View style={styles.cardTag}>
          <PlaceholderTag />
        </View>
        <View style={styles.figRow}>
          <View style={styles.figLabel}>
            <Text style={[styles.figTitle, f.sansSemiBold, { color: c.text }]}>{t.estimate}</Text>
            <Text style={[styles.figMeta, f.sans, { color: c.dim }]}>
              {formatTime(lastEdit)} · {t.captain}
            </Text>
          </View>
          <View style={styles.fig}>
            <Text testID="detail-estimate" style={[styles.figValue, f.monoSemiBold, { color: c.text }]}>
              {formatQuantity(entry.quantity)}
            </Text>
            <Text style={[styles.figUnit, f.mono, { color: c.dim }]}>t</Text>
            <TierChip tier="S" size={22} />
          </View>
        </View>
        <View style={[styles.divider, { backgroundColor: c.border }]} />
        <View style={styles.figRow}>
          <View style={styles.figLabel}>
            <Text style={[styles.figTitle, f.sansSemiBold, { color: c.text }]}>{t.actual}</Text>
            {w != null && entry.plant_weighed_at ? (
              <Text style={[styles.figMeta, f.sans, { color: c.dim }]}>
                {formatTime(entry.plant_weighed_at)} · {t.weighedAt}
              </Text>
            ) : null}
          </View>
          {w != null ? (
            <View style={styles.fig}>
              <Text testID="detail-actual" style={[styles.figValue, f.monoSemiBold, { color: c.text }]}>
                {formatQuantity(w)}
              </Text>
              <Text style={[styles.figUnit, f.mono, { color: c.dim }]}>t</Text>
              <TierChip tier="W" size={22} />
            </View>
          ) : (
            <View style={styles.notWeighed}>
              <Icon name="clock" size={18} color={c.dim} />
              <Text style={[styles.lineText, f.sans, { color: c.dim }]}>{t.notWeighed}</Text>
            </View>
          )}
        </View>
        {w != null ? (
          <>
            <View style={[styles.divider, { backgroundColor: c.border }]} />
            <View style={[styles.figRow, styles.diffRow]}>
              <Text style={[styles.lineText, f.sans, { color: c.dim }]}>{t.diffL}</Text>
              <View style={[styles.fig, styles.diffFig]}>
                <Text testID="detail-diff" style={[styles.diffValue, f.monoSemiBold, { color: c.text }]}>
                  {formatSigned(w - entry.quantity)}
                </Text>
                <Text style={[styles.diffUnit, f.mono, { color: c.dim }]}>t</Text>
              </View>
            </View>
          </>
        ) : null}
      </View>

      {history && history.corrections.length > 0 ? (
        <View testID="linked" style={styles.linked}>
          <View style={styles.linkedTitle}>
            <Text style={[styles.sectionLabel, f.sansMedium, { color: c.dim }]}>{t.linked}</Text>
          </View>
          <View style={styles.linkedGrid}>
            {[history.original, ...history.corrections].map((r, i) => {
              const current = i === history.corrections.length;
              return (
                <View
                  key={r.id}
                  testID={`linked-${i}`}
                  style={[
                    styles.linkedCard,
                    current
                      ? { backgroundColor: c.raised, borderWidth: 2, borderColor: c.accent }
                      : { borderWidth: 1, borderColor: c.border },
                  ]}
                >
                  <Text style={[styles.linkedLabel, f.sans, { color: c.dim }]}>
                    {i === 0 ? t.original : `${t.correction} ${i}`}
                  </Text>
                  <Text style={[styles.linkedMeta, f.mono, { color: c.dim }]}>{formatTime(r.recorded_at)}</Text>
                  <View style={styles.linkedFig}>
                    <Text style={[styles.linkedValue, f.monoSemiBold, { color: c.text }]}>{formatQuantity(r.quantity)}</Text>
                    <Text style={[styles.linkedMeta, f.mono, { color: c.dim }]}>t</Text>
                    <TierChip tier="S" size={18} />
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      ) : null}

      <View style={[styles.prov, { borderColor: c.border }]}>
        <View style={styles.line}>
          <Icon name="lock" size={14} strokeWidth={2} color={c.dim} />
          <Text style={[styles.provTitle, f.sansMedium, { color: c.dim }]}>{t.prov}</Text>
        </View>
        <View style={styles.provGrid}>
          {prov.map(([label, value]) => (
            <View key={label} style={styles.provCell}>
              <Text style={[styles.provLabel, f.sans, { color: c.dim }]}>{label}</Text>
              <Text style={[styles.provValue, f.monoMedium, { color: c.text }]}>{value}</Text>
            </View>
          ))}
        </View>
      </View>

      {canCorrect && w == null ? (
        <Pressable
          testID="correct"
          accessibilityRole="button"
          onPress={onCorrect}
          style={({ pressed }) => [
            styles.correct,
            { borderColor: c.border, backgroundColor: pressed ? c.raised : 'transparent' },
          ]}
        >
          <Icon name="pencil" size={20} color={c.text} />
          <Text style={[styles.correctText, f.sansMedium, { color: c.text }]}>{t.correct}</Text>
        </Pressable>
      ) : null}
      {w != null ? (
        <View testID="corr-closed" style={styles.line}>
          <Icon name="lock" size={18} color={c.dim} />
          <Text style={[styles.lineText, f.sans, { color: c.dim }]}>{t.corrClosed}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14 },
  head: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  headText: { gap: 4, flexShrink: 1 },
  no: { fontSize: 13 },
  what: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  species: { fontSize: 28, lineHeight: 32, flexShrink: 1 },
  gloss: { fontSize: 15 },
  state: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 20 },
  stateText: { fontSize: 15 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  lineText: { fontSize: 15, lineHeight: 20, flexShrink: 1 },
  checking: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderRadius: radius,
  },
  checkingText: { flex: 1, fontSize: 15, lineHeight: 20 },
  card: { paddingVertical: 14, paddingHorizontal: 16, borderRadius: radius },
  cardTag: { alignSelf: 'flex-end', marginBottom: 8 },
  figRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 64 },
  figLabel: { gap: 3, flexShrink: 1 },
  figTitle: { fontSize: 17 },
  figMeta: { fontSize: 13 },
  fig: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  figValue: { fontSize: 32, lineHeight: 34, fontVariant: ['tabular-nums'] },
  figUnit: { fontSize: 17, marginRight: 4 },
  notWeighed: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  divider: { height: 1 },
  diffRow: { minHeight: 48 },
  diffFig: { marginRight: 36 },
  diffValue: { fontSize: 20, fontVariant: ['tabular-nums'] },
  diffUnit: { fontSize: 15 },
  linked: { gap: 8 },
  linkedTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionLabel: { fontSize: 13, letterSpacing: 13 * 0.08, textTransform: 'uppercase' },
  linkedGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  linkedCard: { flexBasis: '46%', flexGrow: 1, minHeight: 88, paddingVertical: 10, paddingHorizontal: 12, borderRadius: radius, gap: 3 },
  linkedLabel: { fontSize: 13 },
  linkedMeta: { fontSize: 13 },
  linkedFig: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6 },
  linkedValue: { fontSize: 20, fontVariant: ['tabular-nums'] },
  prov: { paddingVertical: 12, paddingHorizontal: 14, borderWidth: 1, borderStyle: 'dashed', borderRadius: radius, gap: 10 },
  provTitle: { fontSize: 13 },
  provGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 10, columnGap: 12 },
  provCell: { flexBasis: '46%', flexGrow: 1, gap: 2, minWidth: 0 },
  provLabel: { fontSize: 12 },
  provValue: { fontSize: 13 },
  correct: {
    height: 56,
    maxWidth: 360,
    width: '100%',
    borderRadius: radius,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  correctText: { fontSize: 17 },
});
