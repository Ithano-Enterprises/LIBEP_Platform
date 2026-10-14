import { Pressable, StyleSheet, Text, View } from 'react-native';

import { monthNames } from '../../i18n/strings';
import { fonts, radius } from '../../theme/tokens';
import { formatQuantity, formatTime } from '../../ui/format';
import { HoldBox } from '../../ui/HoldBox';
import { Icon } from '../../ui/Icon';
import { PlaceholderTag } from '../../ui/PlaceholderTag';
import { usePreferences, useStrings, useTheme } from '../../ui/preferences';
import { TierChip } from '../../ui/TierChip';
import { daysAgo, formatCoord, formatWindow, type Spot } from './model';

/** Few trips: the averages are rough (design shows the note at 2 trips). */
const ROUGH_TRIPS = 2;
const BAR_OPACITY = [1, 0.72, 0.5];

// S5.2 spot detail: trips, total and average (S), plant weight (W) from
// closed trips, species split, best time and month, last fished.
export function SpotDetail({
  spot,
  glosses,
  now,
  onSeeEntries,
  wide = false,
}: {
  spot: Spot;
  glosses: Record<string, string | null>;
  now: Date;
  onSeeEntries: () => void;
  wide?: boolean;
}) {
  const c = useTheme();
  const t = useStrings();
  const { lang } = usePreferences();
  const ago = daysAgo(spot.lastAt, now);
  const tile = (label: string, value: React.ReactNode, sub: React.ReactNode, id: string) => (
    <View testID={id} style={[styles.tile, { backgroundColor: wide ? c.surface : c.raised }]}>
      <Text style={[styles.tileLabel, { color: c.dim }]}>{label}</Text>
      {value}
      {sub}
    </View>
  );
  const fig = (v: string) => (
    <View style={styles.fig}>
      <Text style={[styles.figValue, { color: c.text }]}>{v}</Text>
      <Text style={[styles.unit, { color: c.dim }]}>t</Text>
    </View>
  );

  return (
    <View testID="spot-detail" style={styles.wrap}>
      <View style={styles.inline}>
        <Text style={[styles.coord, { color: c.dim }]}>{formatCoord(spot.lat, spot.lon)}</Text>
      </View>
      <View style={styles.tiles}>
        {tile(
          t.tripsL,
          <Text style={[styles.figValue, { color: c.text }]}>{spot.trips}</Text>,
          <Text style={[styles.tileSub, { color: c.dim }]}>{t.tripsHere}</Text>,
          'tile-trips',
        )}
        {tile(t.totalL, fig(formatQuantity(spot.t)), <TierChip tier="S" size={16} />, 'tile-total')}
        {tile(
          t.avgL,
          fig(formatQuantity(spot.avg)),
          <View style={styles.inline}>
            <TierChip tier="S" size={16} />
            <Text style={[styles.tileSub, { color: c.dim }]}>{t.perTrip}</Text>
          </View>,
          'tile-avg',
        )}
      </View>
      {spot.trips <= ROUGH_TRIPS ? (
        <View testID="rough" style={styles.inline}>
          <Icon name="info" size={16} color={c.dim} />
          <Text style={[styles.note, { color: c.dim }]}>{t.rough.replace('{n}', String(spot.trips))}</Text>
        </View>
      ) : null}
      {spot.plantT != null ? (
        <View testID="spot-plant" style={styles.inline}>
          <Icon name="check" size={18} strokeWidth={2} color={c.ok} />
          <Text style={[styles.plant, { color: c.ok }]}>{t.plantPre}</Text>
          <Text style={[styles.plantValue, { color: c.ok }]}>{formatQuantity(spot.plantT)} t</Text>
          <TierChip tier="W" />
          <Text style={[styles.plant, { color: c.ok }]}>
            {t.plantPost.replace('{a}', String(spot.plantTrips)).replace('{b}', String(spot.trips))}
          </Text>
        </View>
      ) : (
        <View testID="spot-no-plant" style={styles.inline}>
          <Icon name="clock" size={18} color={c.dim} />
          <Text style={[styles.note, { color: c.dim }]}>{t.plantNo}</Text>
        </View>
      )}

      <View style={styles.bars}>
        <Text style={[styles.section, { color: c.dim }]}>{t.speciesL}</Text>
        {spot.bySpecies.map((s, i) => (
          <View key={s.species_id} testID={`bar-${s.name}`} style={styles.bar}>
            <View style={styles.barHead}>
              <View style={styles.inline}>
                <Icon name="fish" size={18} color={c.dim} />
                <Text style={[styles.barName, { color: c.text }]}>{s.name}</Text>
                {s.hold ? <HoldBox code={s.hold} /> : null}
                {lang === 'en' && glosses[s.species_id] ? (
                  <Text style={[styles.note, { color: c.dim }]}>{glosses[s.species_id]}</Text>
                ) : null}
              </View>
              <View style={styles.inline}>
                <Text style={[styles.barValue, { color: c.text }]}>{formatQuantity(s.t)}</Text>
                <Text style={[styles.unit, { color: c.dim }]}>t</Text>
                <TierChip tier="S" size={16} />
              </View>
            </View>
            <View style={[styles.track, { backgroundColor: c.raised }]}>
              <View
                style={{
                  height: '100%',
                  width: `${Math.min(100, (s.t / spot.t) * 100)}%`,
                  backgroundColor: c.accent,
                  opacity: BAR_OPACITY[i] ?? 0.5,
                }}
              />
            </View>
          </View>
        ))}
      </View>

      <View style={styles.facts}>
        <View style={styles.fact}>
          <Text style={[styles.tileLabel, { color: c.dim }]}>{t.bestTime}</Text>
          <Text style={[styles.factValue, { color: c.text }]}>{formatWindow(spot.bestHour)}</Text>
        </View>
        <View style={styles.fact}>
          <Text style={[styles.tileLabel, { color: c.dim }]}>{t.bestMonths}</Text>
          <View style={styles.inline}>
            <Text style={[styles.factValue, { color: c.text }]}>{monthNames[lang][spot.bestMonth]}</Text>
            {/* [TO CONFIRM: season mapping, client confirms Kaskazi/Kusi months] */}
            <PlaceholderTag />
          </View>
        </View>
        <View style={styles.fact}>
          <Text style={[styles.tileLabel, { color: c.dim }]}>{t.last}</Text>
          <Text testID="spot-last" style={[styles.factValue, { color: c.text }]}>
            {ago === 0 ? `${t.today} ${formatTime(spot.lastAt)}` : t.daysAgo.replace('{n}', String(ago))}
          </Text>
        </View>
      </View>

      <Pressable
        testID="see-entries"
        accessibilityRole="button"
        onPress={onSeeEntries}
        style={({ pressed }) => [styles.button, { borderColor: c.border, backgroundColor: pressed ? c.raised : 'transparent' }]}
      >
        <Icon name="list" size={20} color={c.text} />
        <Text style={[styles.buttonText, { color: c.text }]}>{t.seeEntries}</Text>
      </Pressable>
      <Text style={[styles.note, { color: c.dim }]}>{t.groundsNote}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 16 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  coord: { fontFamily: fonts.mono, fontSize: 13 },
  tiles: { flexDirection: 'row', gap: 8 },
  tile: { flex: 1, minWidth: 0, padding: 10, borderRadius: radius, gap: 6 },
  tileLabel: { fontFamily: fonts.sans, fontSize: 13 },
  tileSub: { fontFamily: fonts.sans, fontSize: 12 },
  fig: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  figValue: { fontFamily: fonts.monoSemiBold, fontSize: 24, fontVariant: ['tabular-nums'] },
  unit: { fontFamily: fonts.mono, fontSize: 13 },
  note: { fontFamily: fonts.sans, fontSize: 15, lineHeight: 20, flexShrink: 1 },
  plant: { fontFamily: fonts.sansMedium, fontSize: 15 },
  plantValue: { fontFamily: fonts.monoSemiBold, fontSize: 15 },
  bars: { gap: 10 },
  section: { fontFamily: fonts.sansMedium, fontSize: 13, letterSpacing: 13 * 0.08, textTransform: 'uppercase' },
  bar: { gap: 6 },
  barHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  barName: { fontFamily: fonts.sans, fontSize: 17 },
  barValue: { fontFamily: fonts.monoSemiBold, fontSize: 17 },
  track: { height: 10, borderRadius: 3, overflow: 'hidden' },
  facts: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 12, columnGap: 16 },
  fact: { gap: 3, minWidth: 120 },
  factValue: { fontFamily: fonts.monoSemiBold, fontSize: 15 },
  button: {
    height: 56,
    borderRadius: radius,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonText: { fontFamily: fonts.sansMedium, fontSize: 17 },
});
