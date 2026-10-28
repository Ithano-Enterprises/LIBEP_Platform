import { StatusBar } from 'expo-status-bar';
import { useEffect, useState, type ReactNode } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { radius } from '../theme/tokens';
import { BackButton } from '../ui/BackButton';
import { formatQuantity } from '../ui/format';
import { Icon, type IconName } from '../ui/Icon';
import { useFontSet, usePreferences, useStrings, useTheme, useUnit } from '../ui/preferences';
import { TierChip } from '../ui/TierChip';
import { ExcludedSheet } from './grounds/ExcludedSheet';
import { GroundsMap } from './grounds/GroundsMap';
import { buildGrounds, MIN_TRIPS, rankSpots, type Metric } from './grounds/model';
import { TopSpots } from './grounds/TopSpots';
import { useGrounds } from './grounds/useGrounds';

const systemNow = () => new Date();
/** Bottom panel height when collapsed, as the design's peek. */
const PEEK = 232;

// S5 My grounds, phone. A heat map of where this captain has caught fish,
// from this device's own catches only, last 90 days. Works offline.
export function GroundsScreen({ onDone, now = systemNow }: { onDone: () => void; now?: () => Date }) {
  const { mode } = usePreferences();
  const c = useTheme();
  const t = useStrings();
  const insets = useSafeAreaInsets();
  const { data, error } = useGrounds();
  const f = useFontSet();
  const unit = useUnit();
  const [metric, setMetric] = useState<Metric>('trips');
  const [selected, setSelected] = useState<string | null>(null);
  const [full, setFull] = useState(false);
  const [exOpen, setExOpen] = useState(false);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (exOpen) setExOpen(false);
      else onDone();
      return true;
    });
    return () => sub.remove();
  }, [exOpen, onDone]);

  const shell = (children: ReactNode, sub?: ReactNode) => (
    <View testID="screen" style={[styles.screen, { backgroundColor: c.bg, paddingTop: insets.top }]}>
      <StatusBar style={mode === 'night' ? 'light' : 'dark'} />
      <View style={styles.header}>
        <BackButton onPress={onDone} />
        <View style={styles.headerText}>
          <View style={styles.inline}>
            <Icon name="map" size={22} color={c.accent} />
            <Text style={[styles.title, f.sansSemiBold, { color: c.text }]}>{t.groundsTitle}</Text>
          </View>
          {sub}
        </View>
      </View>
      {children}
    </View>
  );

  if (error) return shell(<Text style={[styles.error, f.mono, { color: c.danger }]}>{error.message}</Text>);
  if (!data) return shell(null);
  if (!data.profile) {
    return shell(<Text style={[styles.error, f.mono, { color: c.dim }]}>{t.noVessel}</Text>);
  }

  const grounds = buildGrounds(data.catches, { now: now(), range: '90', species: [] });
  const ranked = rankSpots(grounds.spots, metric);
  const empty = data.tripsLogged < MIN_TRIPS;
  const boatCatch = data.openTrip
    ? data.catches.find((x) => x.trip_id === data.openTrip!.trip_id && x.latitude != null && x.longitude != null)
    : undefined;
  const boat = boatCatch ? { lat: boatCatch.latitude!, lon: boatCatch.longitude! } : null;

  const sub = empty ? (
    <Text style={[styles.sub, f.sans, { color: c.dim }]}>
      {t.tripsN.replace('{n}', String(data.tripsLogged))} · {t.days90}
    </Text>
  ) : (
    <View style={styles.inline}>
      <Text style={[styles.sub, f.sans, { color: c.dim }]}>
        {t.tripsN.replace('{n}', String(grounds.tripCount))} · {t.days90} ·
      </Text>
      <Text testID="grounds-total" style={[styles.total, f.monoSemiBold, { color: c.text }]}>
        {formatQuantity(grounds.totalKg, unit)} {unit}
      </Text>
      <TierChip tier="S" />
    </View>
  );

  if (empty) {
    return shell(
      <>
        <View style={styles.body}>
          <GroundsMap
            spots={[]}
            metric={metric}
            selected={null}
            onSelect={() => {}}
            boat={null}
            homeName={data.profile.home_site.name}
            legend={false}
          />
        </View>
        <View testID="grounds-empty" style={[styles.emptyPanel, { backgroundColor: c.surface, borderTopColor: c.border, paddingBottom: 16 + insets.bottom }]}>
          <Icon name="map" size={32} strokeWidth={1.4} color={c.dim} />
          <Text style={[styles.emptyText, f.sansMedium, { color: c.text }]}>{t.empty}</Text>
          <Text testID="grounds-progress" style={[styles.progress, f.monoSemiBold, { color: c.dim }]}>
            {Math.min(data.tripsLogged, MIN_TRIPS)} / {MIN_TRIPS}
          </Text>
          <Pressable
            testID="grounds-back-trip"
            accessibilityRole="button"
            onPress={onDone}
            style={({ pressed }) => [styles.primary, { backgroundColor: pressed ? c.accentPress : c.accent }]}
          >
            <Text style={[styles.primaryText, f.sansSemiBold, { color: c.onAccent }]}>{t.backTrip}</Text>
          </Pressable>
        </View>
      </>,
      sub,
    );
  }

  const metrics: [Metric, string, IconName][] = [
    ['trips', t.metricTrips, 'boat'],
    ['tonnes', `${t.metricT} (t)`, 'fish'],
  ];

  return shell(
    <>
      <View style={styles.seg}>
        {metrics.map(([id, label, icon], i) => {
          const on = metric === id;
          return (
            <Pressable
              key={id}
              testID={`metric-${id}`}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              onPress={() => setMetric(id)}
              style={[
                styles.segButton,
                i === 0 ? styles.segLeft : styles.segRight,
                { borderColor: on ? c.accent : c.border, backgroundColor: on ? c.accent : c.surface },
              ]}
            >
              <Icon name={icon} size={18} strokeWidth={2} color={on ? c.onAccent : c.text} />
              <Text numberOfLines={1} style={[styles.segText, f.sansMedium, { color: on ? c.onAccent : c.text }, on && f.sansSemiBold]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.body}>
        {full ? null : (
          <GroundsMap
            spots={grounds.spots}
            metric={metric}
            selected={selected}
            onSelect={setSelected}
            boat={boat}
            homeName={data.profile.home_site.name}
          />
        )}
        <View
          testID="grounds-panel"
          style={[
            styles.panel,
            full ? styles.panelFull : { height: PEEK },
            { backgroundColor: c.surface, borderTopColor: c.border },
          ]}
        >
          <View style={styles.handleRow}>
            <View style={[styles.handle, { backgroundColor: c.border }]} />
          </View>
          <View style={styles.topBar}>
            <View style={styles.topText}>
              <View style={styles.inline}>
                <Icon name="rank" size={20} color={c.accent} />
                <Text style={[styles.panelTitle, f.sansSemiBold, { color: c.text }]}>{t.top}</Text>
              </View>
              <Text style={[styles.sub, f.sans, { color: c.dim }]}>{metric === 'trips' ? t.byTrips : t.byT}</Text>
            </View>
            <Pressable
              testID="grounds-expand"
              accessibilityRole="button"
              accessibilityLabel={full ? t.collapse : t.expand}
              onPress={() => setFull((f) => !f)}
              style={[styles.expand, { borderColor: c.border }]}
            >
              <Icon name={full ? 'chevD' : 'chevU'} size={22} strokeWidth={2} color={c.text} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ paddingBottom: 12 + insets.bottom }}>
            <TopSpots ranked={ranked} metric={metric} selected={selected} onSelect={setSelected} limit={full ? undefined : 1} />
            {grounds.excluded.length ? (
              <Pressable
                testID="grounds-excluded"
                accessibilityRole="button"
                onPress={() => setExOpen(true)}
                style={({ pressed }) => [
                  styles.exRow,
                  { borderTopColor: c.border, backgroundColor: pressed ? c.raised : 'transparent' },
                ]}
              >
                <Icon name="eyeOff" size={20} color={c.dim} />
                <Text style={[styles.exText, f.sans, { color: c.text }]}>
                  {t.excludedN.replace('{n}', String(grounds.excluded.length))}
                </Text>
                <Icon name="chevR" size={18} strokeWidth={2} color={c.dim} />
              </Pressable>
            ) : null}
            <View style={styles.notes}>
              <View style={styles.inline}>
                <Icon name="wifiOff" size={16} color={c.dim} />
                <Text style={[styles.note, f.sans, { color: c.dim }]}>{t.offline}</Text>
              </View>
              <View style={styles.inline}>
                <Icon name="lock" size={16} color={c.dim} />
                <Text style={[styles.note, f.sans, { color: c.dim }]}>{t.privacy}</Text>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
      {exOpen ? <ExcludedSheet excluded={grounds.excluded} onClose={() => setExOpen(false)} /> : null}
    </>,
    sub,
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { height: 64, flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: 16, paddingLeft: 4 },
  headerText: { flex: 1, minWidth: 0, gap: 2 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  title: { fontSize: 22, lineHeight: 26 },
  sub: { fontSize: 15 },
  total: { fontSize: 15, fontVariant: ['tabular-nums'] },
  error: { fontSize: 13, padding: 16 },
  seg: { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 8 },
  segButton: {
    flex: 1,
    height: 56,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
  },
  segLeft: { borderTopLeftRadius: radius, borderBottomLeftRadius: radius },
  segRight: { borderTopRightRadius: radius, borderBottomRightRadius: radius },
  segText: { fontSize: 17, flexShrink: 1 },
  body: { flex: 1 },
  panel: {
    borderTopWidth: 1,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -8 },
  },
  panelFull: { flex: 1, borderTopLeftRadius: 0, borderTopRightRadius: 0 },
  handleRow: { height: 12, alignItems: 'center', justifyContent: 'center' },
  handle: { width: 36, height: 4, borderRadius: 2 },
  topBar: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 16, paddingRight: 10, paddingBottom: 4 },
  topText: { flex: 1, minWidth: 0, gap: 1 },
  panelTitle: { fontSize: 20 },
  expand: { width: 56, height: 56, borderRadius: radius, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  exRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 16, paddingRight: 10, borderTopWidth: 1 },
  exText: { flex: 1, fontSize: 15 },
  notes: { paddingTop: 10, paddingHorizontal: 16, gap: 6 },
  note: { fontSize: 15 },
  emptyPanel: { alignItems: 'center', gap: 12, paddingTop: 24, paddingHorizontal: 16, borderTopWidth: 1 },
  emptyText: { fontSize: 17, textAlign: 'center' },
  progress: { fontSize: 20 },
  primary: { alignSelf: 'stretch', height: 64, borderRadius: radius, alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontSize: 20 },
});
