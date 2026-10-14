import { StatusBar } from 'expo-status-bar';
import { useEffect, useState, type ReactNode } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { DeviceProfile } from '../data/types';
import { fonts, radius } from '../theme/tokens';
import { BackButton } from '../ui/BackButton';
import { formatQuantity } from '../ui/format';
import { Icon, type IconName } from '../ui/Icon';
import { useIsTablet } from '../ui/layout';
import { usePreferences, useStrings, useTheme, useUnit } from '../ui/preferences';
import { TierChip } from '../ui/TierChip';
import { ExcludedSheet } from './grounds/ExcludedSheet';
import { FilterChips } from './grounds/FilterChips';
import { FiltersSheet } from './grounds/FiltersSheet';
import { GroundsMap } from './grounds/GroundsMap';
import {
  buildGrounds,
  DEFAULT_FILTERS,
  formatCoord,
  MIN_TRIPS,
  rankSpots,
  spotEntries,
  spotOfCatch,
  type Filters,
  type Metric,
} from './grounds/model';
import { SpotDetail } from './grounds/SpotDetail';
import { SpotEntries } from './grounds/SpotEntries';
import { TopSpots } from './grounds/TopSpots';
import { useGrounds, type GroundsData } from './grounds/useGrounds';

const systemNow = () => new Date();
/** Phone panel heights, as the design's peek and half sheets. */
const PEEK = 232;
const HALF = 344;

type Mode = 'list' | 'detail' | 'entries';

// S5 My grounds. A heat map of where this captain has caught fish, from
// this device's own catches only. Works offline. Phone: map with a bottom
// panel (top spots, spot detail, entries). Tablet (600dp and up): map left,
// panel right.
export function GroundsScreen({
  onDone,
  now = systemNow,
  focusCatchId = null,
}: {
  onDone: () => void;
  now?: () => Date;
  /** Open with the spot of this catch selected ("Ona kwenye ramani"). */
  focusCatchId?: string | null;
}) {
  const c = useTheme();
  const t = useStrings();
  const { data, error } = useGrounds();

  if (error) {
    return (
      <Shell onDone={onDone}>
        <Text style={[styles.error, { color: c.danger }]}>{error.message}</Text>
      </Shell>
    );
  }
  if (!data) return <Shell onDone={onDone} />;
  if (!data.profile) {
    return (
      <Shell onDone={onDone}>
        <Text style={[styles.error, { color: c.dim }]}>{t.noVessel}</Text>
      </Shell>
    );
  }
  return <GroundsView data={data} profile={data.profile} onDone={onDone} now={now} focusCatchId={focusCatchId} />;
}

function Shell({
  onDone,
  children,
  sub,
  side,
}: {
  onDone: () => void;
  children?: ReactNode;
  sub?: ReactNode;
  side?: ReactNode;
}) {
  const { mode: theme } = usePreferences();
  const c = useTheme();
  const t = useStrings();
  const insets = useSafeAreaInsets();
  const wide = useIsTablet();
  return (
  const unit = useUnit();
    <View testID="screen" style={[styles.screen, { backgroundColor: c.bg, paddingTop: insets.top }]}>
      <StatusBar style={theme === 'night' ? 'light' : 'dark'} />
      <View style={[styles.header, wide && styles.headerWide]}>
        <BackButton onPress={onDone} />
        <View style={styles.headerText}>
          <View style={styles.inline}>
            <Icon name="map" size={22} color={c.accent} />
            <Text style={[styles.title, f.sansSemiBold, { color: c.text }]}>{t.groundsTitle}</Text>
          </View>
          {sub}
        </View>
        {side}
      </View>
      {children}
    </View>
  );
}

/** Where "Ona kwenye ramani" lands: that catch's spot, widening the range if needed. */
function initialFocus(data: GroundsData, now: Date, catchId: string | null) {
  const none = { filters: DEFAULT_FILTERS, selected: null as string | null, mode: 'list' as Mode };
  if (!catchId) return none;
  const inDefault = spotOfCatch(buildGrounds(data.catches, { now, ...DEFAULT_FILTERS }).spots, catchId);
  if (inDefault) return { filters: DEFAULT_FILTERS, selected: inDefault.key, mode: 'detail' as Mode };
  const all: Filters = { ...DEFAULT_FILTERS, range: 'all' };
  const spot = spotOfCatch(buildGrounds(data.catches, { now, ...all }).spots, catchId);
  return spot ? { filters: all, selected: spot.key, mode: 'detail' as Mode } : none;
}

function GroundsView({
  data,
  profile,
  onDone,
  now,
  focusCatchId,
}: {
  data: GroundsData;
  profile: DeviceProfile;
  onDone: () => void;
  now: () => Date;
  focusCatchId: string | null;
}) {
  const c = useTheme();
  const t = useStrings();
  const insets = useSafeAreaInsets();
  const wide = useIsTablet();
  const [focus] = useState(() => initialFocus(data, now(), focusCatchId));
  const [metric, setMetric] = useState<Metric>('trips');
  const [filters, setFilters] = useState<Filters>(focus.filters);
  const [selected, setSelected] = useState<string | null>(focus.selected);
  const [mode, setMode] = useState<Mode>(focus.mode);
  const [full, setFull] = useState(false);
  const [exOpen, setExOpen] = useState(false);
  const [fltOpen, setFltOpen] = useState(false);

  const back = () => {
    if (fltOpen) setFltOpen(false);
    else if (exOpen) setExOpen(false);
    else if (mode === 'entries') setMode('detail');
    else if (mode === 'detail') {
      setMode('list');
      setSelected(null);
    } else onDone();
  };
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      back();
      return true;
    });
    return () => sub.remove();
  });

  const shell = (children: ReactNode, sub?: ReactNode, side?: ReactNode) => (
    <Shell onDone={onDone} sub={sub} side={side}>
      {children}
    </Shell>
  );

  const today = now();
  const grounds = buildGrounds(data.catches, { now: today, ...filters });
  const ranked = rankSpots(grounds.spots, metric);
  const spot = grounds.spots.find((s) => s.key === selected) ?? null;
  const empty = data.tripsLogged < MIN_TRIPS;
  const glosses = Object.fromEntries(data.menu.map((m) => [m.id, m.english_gloss]));
  const boatCatch = data.openTrip
    ? data.catches.find((x) => x.trip_id === data.openTrip!.trip_id && x.latitude != null && x.longitude != null)
    : undefined;
  const boat = boatCatch ? { lat: boatCatch.latitude!, lon: boatCatch.longitude! } : null;
  const rangeText = { '30': t.r30, '90': t.days90, season: t.rSeason, all: t.rAll }[filters.range];
  const speciesNames = filters.species.map((id) => data.menu.find((m) => m.id === id)?.local_name ?? '?');

  const sub = empty ? (
    <Text style={[styles.sub, f.sans, { color: c.dim }]}>
      {t.tripsN.replace('{n}', String(data.tripsLogged))} · {t.days90}
    </Text>
  ) : (
    <View style={styles.inline}>
      <Text style={[styles.sub, { color: c.dim }]}>
        {speciesNames.length
          ? `${speciesNames.join(', ')} · ${t.spotsN.replace('{n}', String(grounds.spots.length))} ·`
          : `${t.tripsN.replace('{n}', String(grounds.tripCount))} · ${rangeText} ·`}
      </Text>
      <Text testID="grounds-total" style={[styles.total, f.monoSemiBold, { color: c.text }]}>
        {formatQuantity(grounds.totalKg, unit)} {unit}
      </Text>
      <TierChip tier="S" />
    </View>
  );

  const calmLines = (
    <View style={[styles.notes, wide && styles.notesWide]}>
      <View style={styles.inline}>
        <Icon name="wifiOff" size={16} color={c.dim} />
        <Text style={[styles.note, { color: c.dim }]}>{t.offline}</Text>
      </View>
      <View style={styles.inline}>
        <Icon name="lock" size={16} color={c.dim} />
        <Text style={[styles.note, { color: c.dim }]}>{t.privacy}</Text>
      </View>
    </View>
  );

  const map = (
    <GroundsMap
      spots={empty ? [] : grounds.spots}
      metric={metric}
      selected={selected}
      onSelect={(key) => {
        setSelected(key);
        setMode('detail');
      }}
      boat={empty ? null : boat}
      homeName={profile.home_site.name}
      legend={!empty && (wide || (mode === 'list' && !full))}
    />
  );

  if (empty) {
    return shell(
      <>
        <View style={styles.body}>{map}</View>
        <View
          testID="grounds-empty"
          style={[styles.emptyPanel, { backgroundColor: c.surface, borderTopColor: c.border, paddingBottom: 16 + insets.bottom }]}
        >
          <Icon name="map" size={32} strokeWidth={1.4} color={c.dim} />
          <Text style={[styles.emptyText, f.sansMedium, { color: c.text }]}>{t.empty}</Text>
          <Text testID="grounds-progress" style={[styles.progress, f.monoSemiBold, { color: c.dim }]}>
            {Math.min(data.tripsLogged, MIN_TRIPS)} / {MIN_TRIPS}
          </Text>
          <View style={styles.inline}>
            <Icon name="lock" size={16} color={c.dim} />
            <Text style={[styles.note, { color: c.dim }]}>{t.privacy}</Text>
          </View>
          <Pressable
            testID="grounds-back-trip"
            accessibilityRole="button"
            onPress={onDone}
            style={({ pressed }) => [styles.primary, { backgroundColor: pressed ? c.accentPress : c.accent }]}
          >
            <Icon name="back" size={22} strokeWidth={2.2} color={c.onAccent} />
            <Text style={[styles.primaryText, { color: c.onAccent }]}>{t.backTrip}</Text>
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
  const controls = (
    <View style={[styles.controls, wide && [styles.controlsWide, { borderBottomColor: c.border }]]}>
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
                wide ? styles.segWide : styles.segNarrow,
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
      <FilterChips value={filters} menu={data.menu} wide={wide} onOpen={() => setFltOpen(true)} />
    </View>
  );

  // Panel title and content by mode.
  const inSpot = (mode === 'detail' || mode === 'entries') && spot;
  const panelTitle = inSpot ? formatCoord(spot.lat, spot.lon) : t.top;
  const panelSub = inSpot
    ? mode === 'entries'
      ? t.entriesHere
      : `${t.tripsN.replace('{n}', String(spot.trips))} · ${rangeText}`
    : metric === 'trips'
      ? t.byTrips
      : t.byT;
  const panelBody = inSpot ? (
    mode === 'entries' ? (
      <SpotEntries entries={spotEntries(data.catches, spot)} glosses={glosses} />
    ) : (
      <SpotDetail spot={spot} glosses={glosses} now={today} wide={wide} onSeeEntries={() => setMode('entries')} />
    )
  ) : null;

  const panel = (
    <View
      testID="grounds-panel"
      style={
        wide
          ? [styles.panelWide, { backgroundColor: c.bg, borderLeftColor: c.border }]
          : [
              styles.panel,
              full || mode === 'entries' ? styles.panelFull : { height: mode === 'detail' ? HALF : PEEK },
              { backgroundColor: c.surface, borderTopColor: c.border },
            ]
      }
    >
      {wide ? null : (
        <View style={styles.handleRow}>
          <View style={[styles.handle, { backgroundColor: c.border }]} />
        </View>
      )}
      <View style={[styles.topBar, wide && styles.topBarWide]}>
        {inSpot ? <BackButton onPress={back} /> : null}
        <View style={styles.topText}>
          <View style={styles.inline}>
            {inSpot ? null : <Icon name="rank" size={20} color={c.accent} />}
            <Text testID="panel-title" style={[inSpot ? styles.panelTitleMono : styles.panelTitle, { color: c.text }]}>
              {panelTitle}
            </Text>
          </View>
          <Text style={[styles.sub, { color: c.dim }]} numberOfLines={1}>
            {panelSub}
          </Text>
        </View>
        {!wide && mode !== 'entries' ? (
          <Pressable
            testID="grounds-expand"
            accessibilityRole="button"
            accessibilityLabel={full ? t.collapse : t.expand}
            onPress={() => setFull((f) => !f)}
            style={[styles.expand, { borderColor: c.border }]}
          >
            <Icon name={full ? 'chevD' : 'chevU'} size={22} strokeWidth={2} color={c.text} />
          </Pressable>
        ) : null}
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: 16 + insets.bottom }}>
        {panelBody ? (
          <View style={[styles.detailPad, wide && styles.detailPadWide]}>{panelBody}</View>
        ) : (
          <>
            <TopSpots
              ranked={ranked}
              metric={metric}
              selected={selected}
              onSelect={(key) => {
                setSelected(key);
                setMode('detail');
              }}
              limit={wide || full ? undefined : 1}
            />
            {wide && !selected ? (
              <View testID="tap-hint" style={[styles.inline, styles.hint]}>
                <Icon name="target" size={18} color={c.dim} />
                <Text style={[styles.note, { color: c.dim }]}>{t.tapHint}</Text>
              </View>
            ) : null}
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
            {wide ? null : calmLines}
          </>
        )}
      </ScrollView>
    </View>
  );

  return shell(
    <>
      {controls}
      <View style={[styles.body, wide && styles.bodyWide]}>
        {wide ? (
          <View style={styles.mapWide}>{map}</View>
        ) : full || mode === 'entries' ? null : (
          map
        )}
        {panel}
      </View>
      {exOpen ? <ExcludedSheet excluded={grounds.excluded} onClose={() => setExOpen(false)} /> : null}
      {fltOpen ? (
        <FiltersSheet
          value={filters}
          menu={data.menu}
          catches={data.catches}
          now={today}
          wide={wide}
          onClose={() => setFltOpen(false)}
          onApply={(f) => {
            setFilters(f);
            setFltOpen(false);
            const still = buildGrounds(data.catches, { now: today, ...f }).spots.some((s) => s.key === selected);
            if (!still) {
              setSelected(null);
              setMode('list');
            }
          }}
        />
      ) : null}
    </>,
    sub,
    wide ? calmLines : undefined,
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { height: 64, flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: 16, paddingLeft: 4 },
  headerWide: { height: 72, gap: 12, paddingRight: 24, paddingLeft: 12 },
  headerText: { flex: 1, minWidth: 0, gap: 2 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  title: { fontFamily: fonts.sansSemiBold, fontSize: 22, lineHeight: 26 },
  sub: { fontFamily: fonts.sans, fontSize: 15 },
  total: { fontFamily: fonts.monoSemiBold, fontSize: 15, fontVariant: ['tabular-nums'] },
  error: { fontFamily: fonts.mono, fontSize: 13, padding: 16 },
  controls: { paddingHorizontal: 16, paddingBottom: 8, gap: 8 },
  controlsWide: { height: 72, flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 24, paddingBottom: 0, borderBottomWidth: 1 },
  seg: { flexDirection: 'row' },
  segButton: {
    height: 56,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
  },
  segNarrow: { flex: 1 },
  segWide: { width: 220 },
  segLeft: { borderTopLeftRadius: radius, borderBottomLeftRadius: radius },
  segRight: { borderTopRightRadius: radius, borderBottomRightRadius: radius },
  segText: { fontSize: 17, flexShrink: 1 },
  body: { flex: 1 },
  bodyWide: { flexDirection: 'row' },
  mapWide: { width: 768 },
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
  panelWide: { flex: 1, minWidth: 0, borderLeftWidth: 1 },
  handleRow: { height: 12, alignItems: 'center', justifyContent: 'center' },
  handle: { width: 36, height: 4, borderRadius: 2 },
  topBar: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 16, paddingRight: 10, paddingBottom: 4 },
  topBarWide: { minHeight: 72, paddingVertical: 8, paddingLeft: 24, paddingRight: 16 },
  topText: { flex: 1, minWidth: 0, gap: 1 },
  panelTitle: { fontFamily: fonts.sansSemiBold, fontSize: 20 },
  panelTitleMono: { fontFamily: fonts.monoSemiBold, fontSize: 18 },
  expand: { width: 56, height: 56, borderRadius: radius, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  detailPad: { paddingHorizontal: 16, paddingBottom: 20 },
  detailPadWide: { paddingTop: 4, paddingHorizontal: 24, paddingBottom: 24, maxWidth: 560 },
  hint: { paddingVertical: 12, paddingHorizontal: 24 },
  exRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 16, paddingRight: 10, borderTopWidth: 1 },
  exText: { flex: 1, fontSize: 15 },
  notes: { paddingTop: 10, paddingHorizontal: 16, gap: 6 },
  notesWide: { paddingTop: 0, paddingHorizontal: 0, alignItems: 'flex-end', gap: 4 },
  note: { fontFamily: fonts.sans, fontSize: 15 },
  emptyPanel: { alignItems: 'center', gap: 12, paddingTop: 24, paddingHorizontal: 16, borderTopWidth: 1 },
  emptyText: { fontFamily: fonts.sansMedium, fontSize: 17, textAlign: 'center' },
  progress: { fontFamily: fonts.monoSemiBold, fontSize: 20 },
  primary: {
    alignSelf: 'stretch',
    height: 64,
    borderRadius: radius,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  primaryText: { fontFamily: fonts.sansSemiBold, fontSize: 20 },
});
