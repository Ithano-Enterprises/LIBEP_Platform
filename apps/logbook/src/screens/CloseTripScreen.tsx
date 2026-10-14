import { StatusBar } from 'expo-status-bar';
import { useEffect, useState, type ReactNode } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fonts, radius } from '../theme/tokens';
import { BackButton } from '../ui/BackButton';
import { formatDay, formatQuantity, formatTime, sumTonnes } from '../ui/format';
import { HoldBox } from '../ui/HoldBox';
import { Icon } from '../ui/Icon';
import { usePreferences, useStrings, useTheme } from '../ui/preferences';
import { TierChip } from '../ui/TierChip';
import { byType, cleanDistance, parseDistance } from './closeTrip/model';
import { SitePicker } from './closeTrip/SitePicker';
import { useCloseTrip } from './closeTrip/useCloseTrip';
import { CrewStepper } from './startTrip/CrewStepper';
import { stateKey } from './tripHome/model';
import { stateStyle } from './tripHome/stateStyle';

const systemNow = () => new Date();
/** By-type rows shown before "Zaidi", as the design. */
const TOP_TYPES = 3;

// S4 Close trip, phone layout. Arrival is the time of Tuma. Crew starts
// from the trip start, the site from the vessel's assigned site. After
// Tuma the trip is read-only.
export function CloseTripScreen({
  onDone,
  now = systemNow,
}: {
  onDone: () => void;
  now?: () => Date;
}) {
  const { mode, lang } = usePreferences();
  const c = useTheme();
  const t = useStrings();
  const insets = useSafeAreaInsets();
  const { data, error, submit } = useCloseTrip(null);
  const [crew, setCrew] = useState<number | null>(null);
  const [siteId, setSiteId] = useState<string | null>(null);
  const [distance, setDistance] = useState('');
  const [typesOpen, setTypesOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [clock, setClock] = useState(now);

  useEffect(() => {
    const id = setInterval(() => setClock(now()), 15_000);
    return () => clearInterval(id);
  }, [now]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onDone();
      return true;
    });
    return () => sub.remove();
  }, [onDone]);

  const shell = (children: ReactNode, sub?: string) => (
    <View testID="screen" style={[styles.screen, { backgroundColor: c.bg, paddingTop: insets.top }]}>
      <StatusBar style={mode === 'night' ? 'light' : 'dark'} />
      <View style={[styles.header, { borderBottomColor: c.border }]}>
        <BackButton onPress={onDone} />
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: c.text }]}>{t.closeTrip}</Text>
          {sub ? (
            <Text style={[styles.sub, { color: c.dim }]} numberOfLines={1}>
              {sub}
            </Text>
          ) : null}
        </View>
      </View>
      {children}
    </View>
  );

  if (error) return shell(<Text style={[styles.error, { color: c.danger }]}>{error.message}</Text>);
  if (!data) return shell(null);
  const { profile, start, close, closeState, entries, sites } = data;
  if (!profile || !start) {
    return shell(<Text style={[styles.error, { color: c.dim }]}>{t.noEntries}</Text>);
  }

  const sub = `${profile.vessel.name} · ${profile.vessel.registration}`;
  const closed = !!close;
  const homeId = profile.home_site.id;
  const crewValue = close?.crew_count ?? crew ?? start.crew_count;
  const siteValue = close?.landing_site_id ?? siteId ?? homeId;
  const distanceText = close ? (close.distance_km == null ? '' : String(close.distance_km)) : distance;
  const total = sumTonnes(entries.map((e) => e.quantity));
  const types = byType(entries);
  const shown = typesOpen ? types : types.slice(0, TOP_TYPES);
  const classLabel = `${profile.vessel.tonnage_class} t`;
  const arrival = close ? formatTime(close.arrival_at) : formatTime(clock.toISOString());
  const k = stateKey[closeState ?? 'on_device'];
  const s = stateStyle(k, c);

  const onSubmit = async () => {
    if (closed || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      await submit({
        tripId: start.trip_id,
        arrivalAt: now(),
        crewCount: crewValue,
        landingSiteId: siteValue,
        distanceKm: parseDistance(distance),
      });
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return shell(
    <>
      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} keyboardShouldPersistTaps="handled">
        <View style={[styles.arrival, { borderColor: c.border }]}>
          <View style={styles.arrivalText}>
            <View style={styles.inline}>
              <Icon name="lock" size={14} strokeWidth={2} color={c.dim} />
              <Text style={[styles.small, { color: c.dim }]}>{t.arrival}</Text>
            </View>
            <Text style={[styles.date, { color: c.text }]}>
              {formatDay(close ? new Date(close.arrival_at) : clock, lang)}
            </Text>
          </View>
          <Text testID="arrival-time" style={[styles.arrivalTime, { color: c.text }]}>
            {arrival}
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: c.surface }]}>
          <Text style={[styles.label, { color: c.dim }]}>{t.totalCatch}</Text>
          <View style={styles.totalRow}>
            <View style={styles.totalFig}>
              <Text testID="close-total" style={[styles.total, { color: c.text }]}>
                {formatQuantity(total)}
              </Text>
              <Text style={[styles.totalUnit, { color: c.dim }]}>t</Text>
            </View>
            <View style={styles.inline}>
              <Text style={[styles.estimate, { color: c.dim }]}>{t.estimate}</Text>
              <TierChip tier="S" size={22} />
            </View>
          </View>
        </View>

        {total > profile.vessel.tonnage_class ? (
          <View testID="over-hint" style={styles.inline}>
            <Icon name="alert" size={16} strokeWidth={2} color={c.accent} />
            <Text style={[styles.hint, { color: c.accent }]}>{t.tripOverHint.replace('{c}', classLabel)}</Text>
          </View>
        ) : null}

        <SitePicker sites={sites} homeId={homeId} value={siteValue} onChange={setSiteId} disabled={closed} />

        <View>
          <Text style={[styles.label, styles.typesLabel, { color: c.dim }]}>{t.byType}</Text>
          {shown.map((g) => (
            <View key={g.species_id} testID={`type-${g.name}`} style={[styles.typeRow, { borderTopColor: c.border }]}>
              <Icon name="fish" size={20} color={c.dim} />
              <Text style={[styles.typeName, { color: c.text }]}>{g.name}</Text>
              {g.hold ? <HoldBox code={g.hold} /> : null}
              <View style={styles.spacer} />
              <Text style={[styles.count, { color: c.dim }]}>×{g.n}</Text>
              <View style={styles.typeFig}>
                <Text style={[styles.typeValue, { color: c.text }]}>{formatQuantity(g.t)}</Text>
                <Text style={[styles.count, { color: c.dim }]}>t</Text>
              </View>
              <TierChip tier="S" />
            </View>
          ))}
          {types.length > TOP_TYPES ? (
            <Pressable
              testID="types-toggle"
              accessibilityRole="button"
              accessibilityState={{ expanded: typesOpen }}
              onPress={() => setTypesOpen((o) => !o)}
              style={[styles.typesToggle, { borderTopColor: c.border }]}
            >
              <Icon name={typesOpen ? 'chevU' : 'chevD'} size={18} strokeWidth={2} color={c.dim} />
              <Text style={[styles.typesToggleText, { color: c.text }]}>
                {typesOpen ? t.less : `${t.more} (+${types.length - TOP_TYPES})`}
              </Text>
            </Pressable>
          ) : null}
        </View>

        <CrewStepper value={crewValue} onChange={setCrew} disabled={closed} />

        <View style={styles.inline}>
          <Icon name="link" size={18} color={c.dim} />
          <Text style={[styles.linked, { color: c.text }]}>
            {t.linkedTo.replace('{n}', String(entries.length))} · {profile.vessel.registration}
          </Text>
        </View>

        <View style={[styles.distanceRow, { borderTopColor: c.border }]}>
          <View style={styles.distanceText}>
            <Text style={[styles.distanceLabel, { color: c.dim }]}>{t.distance}</Text>
            <Text style={[styles.small, { color: c.dim }]}>{t.optional}</Text>
          </View>
          <View style={styles.inline}>
            <TextInput
              testID="distance"
              value={distanceText}
              onChangeText={(v) => setDistance(cleanDistance(v))}
              editable={!closed}
              keyboardType="decimal-pad"
              placeholder="—"
              placeholderTextColor={c.dim}
              style={[styles.distanceInput, { backgroundColor: c.surface, borderColor: c.border, color: c.text }]}
            />
            <Text style={[styles.km, { color: c.dim }]}>km</Text>
          </View>
        </View>
        {saveError ? <Text style={[styles.error, { color: c.danger }]}>{saveError}</Text> : null}
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: c.border, paddingBottom: 16 + insets.bottom }]}>
        {closed ? (
          <View testID="read-only" style={[styles.readOnly, { borderColor: c.border }]}>
            <View style={styles.inline}>
              <Icon name={s.icon} size={20} strokeWidth={2} color={s.color} />
              <Text style={[styles.readOnlyState, { color: s.color }]}>{t.states[k]}</Text>
            </View>
            <Text style={[styles.small, { color: c.dim }]}>{t.readOnly}</Text>
          </View>
        ) : (
          <Pressable
            testID="submit"
            accessibilityRole="button"
            accessibilityState={{ disabled: saving, busy: saving }}
            disabled={saving}
            onPress={onSubmit}
            style={({ pressed }) => [styles.primary, { backgroundColor: pressed ? c.accentPress : c.accent }]}
          >
            <Icon name="send" size={22} strokeWidth={2} color={c.onAccent} />
            <Text style={[styles.primaryText, { color: c.onAccent }]}>{t.submit}</Text>
          </Pressable>
        )}
      </View>
    </>,
    sub,
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    paddingTop: 4,
    paddingRight: 16,
    paddingBottom: 10,
    paddingLeft: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderBottomWidth: 1,
  },
  headerText: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontFamily: fonts.sansSemiBold, fontSize: 24, lineHeight: 28 },
  sub: { fontFamily: fonts.mono, fontSize: 13 },
  error: { fontFamily: fonts.mono, fontSize: 13, padding: 16 },
  body: { flex: 1 },
  bodyContent: { paddingTop: 12, paddingHorizontal: 16, paddingBottom: 20, gap: 12 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  small: { fontFamily: fonts.sans, fontSize: 13 },
  arrival: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: radius,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  arrivalText: { gap: 2 },
  date: { fontFamily: fonts.sans, fontSize: 15 },
  arrivalTime: { fontFamily: fonts.monoSemiBold, fontSize: 24, fontVariant: ['tabular-nums'] },
  card: { paddingVertical: 14, paddingHorizontal: 16, borderRadius: radius, gap: 10 },
  label: { fontFamily: fonts.sansMedium, fontSize: 13, letterSpacing: 13 * 0.08, textTransform: 'uppercase' },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  totalFig: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  total: { fontFamily: fonts.monoSemiBold, fontSize: 48, lineHeight: 50, fontVariant: ['tabular-nums'] },
  totalUnit: { fontFamily: fonts.mono, fontSize: 20 },
  estimate: { fontFamily: fonts.sansMedium, fontSize: 15 },
  hint: { fontFamily: fonts.sansMedium, fontSize: 13, flexShrink: 1 },
  typesLabel: { paddingHorizontal: 2, paddingBottom: 6 },
  typeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, borderTopWidth: 1 },
  typeName: { fontFamily: fonts.sans, fontSize: 17 },
  spacer: { flex: 1 },
  count: { fontFamily: fonts.mono, fontSize: 13 },
  typeFig: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'flex-end', gap: 4, minWidth: 72 },
  typeValue: { fontFamily: fonts.monoSemiBold, fontSize: 17, fontVariant: ['tabular-nums'] },
  typesToggle: { height: 56, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4, borderTopWidth: 1 },
  typesToggleText: { fontFamily: fonts.sansMedium, fontSize: 17 },
  linked: { fontFamily: fonts.sans, fontSize: 15, flexShrink: 1 },
  distanceRow: {
    paddingTop: 12,
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  distanceText: { gap: 2 },
  distanceLabel: { fontFamily: fonts.sans, fontSize: 15 },
  distanceInput: {
    width: 96,
    height: 56,
    borderRadius: radius,
    borderWidth: 1,
    paddingHorizontal: 12,
    textAlign: 'right',
    fontFamily: fonts.monoSemiBold,
    fontSize: 20,
  },
  km: { fontFamily: fonts.mono, fontSize: 15 },
  footer: { paddingTop: 8, paddingHorizontal: 16, borderTopWidth: 1, alignItems: 'center' },
  primary: {
    width: '100%',
    maxWidth: 480,
    height: 64,
    borderRadius: radius,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  primaryText: { fontFamily: fonts.sansSemiBold, fontSize: 20 },
  readOnly: {
    width: '100%',
    maxWidth: 480,
    minHeight: 64,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderRadius: radius,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  readOnlyState: { fontFamily: fonts.sansSemiBold, fontSize: 17 },
});
