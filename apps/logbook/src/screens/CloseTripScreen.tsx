import { StatusBar } from 'expo-status-bar';
import { useEffect, useState, type ReactNode } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { radius } from '../theme/tokens';
import { BackButton } from '../ui/BackButton';
import { CREW_RETURNED_MIN } from '../data/repository';
import { formatDay, formatQuantity, formatTime, sumKg } from '../ui/format';
import { HoldBox } from '../ui/HoldBox';
import { Icon } from '../ui/Icon';
import { useIsTablet } from '../ui/layout';
import { useFontSet, usePreferences, useStrings, useTheme, useUnit } from '../ui/preferences';
import { TierChip } from '../ui/TierChip';
import { byType, cleanDistance, crewMismatch, parseDistance } from './closeTrip/model';
import { SitePicker } from './closeTrip/SitePicker';
import { useCloseTrip } from './closeTrip/useCloseTrip';
import { CrewStepper } from './startTrip/CrewStepper';
import { stateKey } from './tripHome/model';
import { stateStyle } from './tripHome/stateStyle';

const systemNow = () => new Date();
/** By-type rows shown before "Zaidi", as the design. */
const TOP_TYPES = 3;

// S4 Close trip. Arrival is the time of Tuma. Crew returned starts from
// crew departed, the site from the vessel's assigned site. If the
// headcounts differ, Tuma asks the captain to confirm, with an optional
// reason; it never blocks the close. After Tuma the trip is read-only.
// Tablet (600dp and up): two columns, the site options always shown, Tuma
// at the bottom right.
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
  const wide = useIsTablet();
  const f = useFontSet();
  const unit = useUnit();
  const [crew, setCrew] = useState<number | null>(null);
  const [confirmCrew, setConfirmCrew] = useState(false);
  const [crewReason, setCrewReason] = useState('');
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
          <Text style={[styles.title, f.sansSemiBold, { color: c.text }]}>{t.closeTrip}</Text>
          {sub ? (
            <Text style={[styles.sub, f.mono, { color: c.dim }]} numberOfLines={1}>
              {sub}
            </Text>
          ) : null}
        </View>
      </View>
      {children}
    </View>
  );

  if (error) return shell(<Text style={[styles.error, f.mono, { color: c.danger }]}>{error.message}</Text>);
  if (!data) return shell(null);
  const { profile, start, close, closeState, entries, sites } = data;
  if (!profile || !start) {
    return shell(<Text style={[styles.error, f.mono, { color: c.dim }]}>{t.noEntries}</Text>);
  }

  const sub = `${profile.vessel.name} · ${profile.vessel.registration}`;
  const closed = !!close;
  const homeId = profile.home_site.id;
  const crewValue = close?.crew_returned ?? crew ?? start.crew_departed;
  const mismatch = crewMismatch(start.crew_departed, crewValue);
  const siteValue = close?.landing_site_id ?? siteId ?? homeId;
  const distanceText = close ? (close.distance_km == null ? '' : String(close.distance_km)) : distance;
  const total = sumKg(entries.map((e) => e.quantity));
  const types = byType(entries);
  const shown = typesOpen ? types : types.slice(0, TOP_TYPES);
  const classLabel = `${profile.vessel.tonnage_class} t`;
  const arrival = close ? formatTime(close.arrival_at) : formatTime(clock.toISOString());
  const k = stateKey[closeState ?? 'on_device'];
  const s = stateStyle(k, c);

  const onSubmit = async (confirmed = false) => {
    if (closed || saving) return;
    if (mismatch && !confirmed) {
      setConfirmCrew(true);
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await submit({
        tripId: start.trip_id,
        arrivalAt: now(),
        crewReturned: crewValue,
        crewChangeReason: mismatch ? crewReason : null,
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
      <ScrollView
        style={styles.body}
        contentContainerStyle={wide ? styles.bodyWide : styles.bodyContent}
        keyboardShouldPersistTaps="handled"
      >
        {wide ? (
          <View style={styles.columns}>
            <View style={styles.column}>
              <View style={[styles.arrival, { borderColor: c.border }]}>
                <View style={styles.arrivalText}>
                  <View style={styles.inline}>
                    <Icon name="lock" size={14} strokeWidth={2} color={c.dim} />
                    <Text style={[styles.small, f.sans, { color: c.dim }]}>{t.arrival}</Text>
                  </View>
                  <Text style={[styles.date, f.sans, { color: c.text }]}>
                    {formatDay(close ? new Date(close.arrival_at) : clock, lang)}
                  </Text>
                </View>
                <Text testID="arrival-time" style={[styles.arrivalTime, f.monoSemiBold, { color: c.text }]}>
                  {arrival}
                </Text>
              </View>

              <View style={[styles.card, { backgroundColor: c.surface }]}>
                <Text style={[styles.label, f.sansMedium, { color: c.dim }]}>{t.totalCatch}</Text>
                <View style={styles.totalRow}>
                  <View style={styles.totalFig}>
                    <Text testID="close-total" style={[styles.total, f.monoSemiBold, { color: c.text }]}>
                      {formatQuantity(total, unit)}
                    </Text>
                    <Text style={[styles.totalUnit, f.mono, { color: c.dim }]}>{unit}</Text>
                  </View>
                  <View style={styles.inline}>
                    <Text style={[styles.estimate, f.sansMedium, { color: c.dim }]}>{t.estimate}</Text>
                    <TierChip tier="S" size={22} />
                  </View>
                </View>
              </View>

              {total > profile.vessel.tonnage_class * 1000 ? (
                <View testID="over-hint" style={styles.inline}>
                  <Icon name="alert" size={16} strokeWidth={2} color={c.accent} />
                  <Text style={[styles.hint, f.sansMedium, { color: c.accent }]}>{t.tripOverHint.replace('{c}', classLabel)}</Text>
                </View>
              ) : null}

              <View>
                <Text style={[styles.label, f.sansMedium, styles.typesLabel, { color: c.dim }]}>{t.byType}</Text>
                {shown.map((g) => (
                  <View key={g.key} testID={`type-${g.name}`} style={[styles.typeRow, { borderTopColor: c.border }]}>
                    <Icon name="fish" size={20} color={c.dim} />
                    <Text style={[styles.typeName, f.sans, { color: c.text }]}>{g.name}</Text>
                    {g.hold ? <HoldBox code={g.hold} /> : null}
                    <View style={styles.spacer} />
                    <Text style={[styles.count, f.mono, { color: c.dim }]}>×{g.n}</Text>
                    <View style={styles.typeFig}>
                      <Text style={[styles.typeValue, f.monoSemiBold, { color: c.text }]}>{formatQuantity(g.kg, unit)}</Text>
                      <Text style={[styles.count, f.mono, { color: c.dim }]}>{unit}</Text>
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
                    <Text style={[styles.typesToggleText, f.sansMedium, { color: c.text }]}>
                      {typesOpen ? t.less : `${t.more} (+${types.length - TOP_TYPES})`}
                    </Text>
                  </Pressable>
                ) : null}
              </View>

            </View>
            <View style={styles.column}>
              <CrewStepper
                value={crewValue}
                onChange={(n) => {
                  setCrew(n);
                  setConfirmCrew(false);
                }}
                disabled={closed}
                min={CREW_RETURNED_MIN}
              />
              {closed && close.crew_change_reason ? (
                <Text testID="crew-reason-shown" style={[styles.small, f.sans, { color: c.dim }]}>
                  {close.crew_change_reason}
                </Text>
              ) : null}

              <SitePicker sites={sites} homeId={homeId} value={siteValue} onChange={setSiteId} disabled={closed} wide={wide} />

              <View style={styles.inline}>
                <Icon name="link" size={18} color={c.dim} />
                <Text style={[styles.linked, f.sans, { color: c.text }]}>
                  {t.linkedTo.replace('{n}', String(entries.length))} · {profile.vessel.registration}
                </Text>
              </View>

              <View style={[styles.distanceRow, { borderTopColor: c.border }]}>
                <View style={styles.distanceText}>
                  <Text style={[styles.distanceLabel, f.sans, { color: c.dim }]}>{t.distance}</Text>
                  <Text style={[styles.small, f.sans, { color: c.dim }]}>{t.optional}</Text>
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
                    style={[styles.distanceInput, f.monoSemiBold, { backgroundColor: c.surface, borderColor: c.border, color: c.text }]}
                  />
                  <Text style={[styles.km, f.mono, { color: c.dim }]}>km</Text>
                </View>
              </View>
            </View>
          </View>
        ) : (
          <>
            <View style={[styles.arrival, { borderColor: c.border }]}>
              <View style={styles.arrivalText}>
                <View style={styles.inline}>
                  <Icon name="lock" size={14} strokeWidth={2} color={c.dim} />
                  <Text style={[styles.small, f.sans, { color: c.dim }]}>{t.arrival}</Text>
                </View>
                <Text style={[styles.date, f.sans, { color: c.text }]}>
                  {formatDay(close ? new Date(close.arrival_at) : clock, lang)}
                </Text>
              </View>
              <Text testID="arrival-time" style={[styles.arrivalTime, f.monoSemiBold, { color: c.text }]}>
                {arrival}
              </Text>
            </View>

            <View style={[styles.card, { backgroundColor: c.surface }]}>
              <Text style={[styles.label, f.sansMedium, { color: c.dim }]}>{t.totalCatch}</Text>
              <View style={styles.totalRow}>
                <View style={styles.totalFig}>
                  <Text testID="close-total" style={[styles.total, f.monoSemiBold, { color: c.text }]}>
                    {formatQuantity(total, unit)}
                  </Text>
                  <Text style={[styles.totalUnit, f.mono, { color: c.dim }]}>{unit}</Text>
                </View>
                <View style={styles.inline}>
                  <Text style={[styles.estimate, f.sansMedium, { color: c.dim }]}>{t.estimate}</Text>
                  <TierChip tier="S" size={22} />
                </View>
              </View>
            </View>

            {total > profile.vessel.tonnage_class * 1000 ? (
              <View testID="over-hint" style={styles.inline}>
                <Icon name="alert" size={16} strokeWidth={2} color={c.accent} />
                <Text style={[styles.hint, f.sansMedium, { color: c.accent }]}>{t.tripOverHint.replace('{c}', classLabel)}</Text>
              </View>
            ) : null}

            <SitePicker sites={sites} homeId={homeId} value={siteValue} onChange={setSiteId} disabled={closed} />

            <View>
              <Text style={[styles.label, f.sansMedium, styles.typesLabel, { color: c.dim }]}>{t.byType}</Text>
              {shown.map((g) => (
                <View key={g.key} testID={`type-${g.name}`} style={[styles.typeRow, { borderTopColor: c.border }]}>
                  <Icon name="fish" size={20} color={c.dim} />
                  <Text style={[styles.typeName, f.sans, { color: c.text }]}>{g.name}</Text>
                  {g.hold ? <HoldBox code={g.hold} /> : null}
                  <View style={styles.spacer} />
                  <Text style={[styles.count, f.mono, { color: c.dim }]}>×{g.n}</Text>
                  <View style={styles.typeFig}>
                    <Text style={[styles.typeValue, f.monoSemiBold, { color: c.text }]}>{formatQuantity(g.kg, unit)}</Text>
                    <Text style={[styles.count, f.mono, { color: c.dim }]}>{unit}</Text>
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
                  <Text style={[styles.typesToggleText, f.sansMedium, { color: c.text }]}>
                    {typesOpen ? t.less : `${t.more} (+${types.length - TOP_TYPES})`}
                  </Text>
                </Pressable>
              ) : null}
            </View>

            <CrewStepper
              value={crewValue}
              onChange={(n) => {
                setCrew(n);
                setConfirmCrew(false);
              }}
              disabled={closed}
              min={CREW_RETURNED_MIN}
            />
            {closed && close.crew_change_reason ? (
              <Text testID="crew-reason-shown" style={[styles.small, f.sans, { color: c.dim }]}>
                {close.crew_change_reason}
              </Text>
            ) : null}

            <View style={styles.inline}>
              <Icon name="link" size={18} color={c.dim} />
              <Text style={[styles.linked, f.sans, { color: c.text }]}>
                {t.linkedTo.replace('{n}', String(entries.length))} · {profile.vessel.registration}
              </Text>
            </View>

            <View style={[styles.distanceRow, { borderTopColor: c.border }]}>
              <View style={styles.distanceText}>
                <Text style={[styles.distanceLabel, f.sans, { color: c.dim }]}>{t.distance}</Text>
                <Text style={[styles.small, f.sans, { color: c.dim }]}>{t.optional}</Text>
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
                  style={[styles.distanceInput, f.monoSemiBold, { backgroundColor: c.surface, borderColor: c.border, color: c.text }]}
                />
                <Text style={[styles.km, f.mono, { color: c.dim }]}>km</Text>
              </View>
            </View>
          </>
        )}
        {saveError ? <Text style={[styles.error, f.mono, { color: c.danger }]}>{saveError}</Text> : null}
      </ScrollView>

      <View
        style={[
          styles.footer,
          wide && styles.footerWide,
          { borderTopColor: c.border, paddingBottom: (wide ? 24 : 16) + insets.bottom },
        ]}
      >
        {!closed && confirmCrew && mismatch ? (
          <View testID="crew-mismatch" style={[styles.mismatch, { borderColor: c.accent, backgroundColor: c.surface }]}>
            <View style={styles.inline}>
              <Icon name="alert" size={18} strokeWidth={2} color={c.accent} />
              <Text style={[styles.hint, f.sansMedium, { color: c.accent }]}>
                {t.crewMismatch.replace('{r}', String(crewValue)).replace('{d}', String(start.crew_departed))}
              </Text>
            </View>
            <TextInput
              testID="crew-reason"
              value={crewReason}
              onChangeText={setCrewReason}
              placeholder={t.crewReasonPh}
              placeholderTextColor={c.dim}
              accessibilityLabel={t.crewReasonPh}
              style={[styles.reasonInput, f.sans, { backgroundColor: c.bg, borderColor: c.border, color: c.text }]}
            />
            <View style={styles.mismatchActions}>
              <Pressable
                testID="crew-edit"
                accessibilityRole="button"
                onPress={() => setConfirmCrew(false)}
                style={[styles.secondary, { borderColor: c.border }]}
              >
                <Text style={[styles.secondaryText, f.sansSemiBold, { color: c.text }]}>{t.crewEdit}</Text>
              </Pressable>
              <Pressable
                testID="crew-confirm"
                accessibilityRole="button"
                accessibilityState={{ disabled: saving, busy: saving }}
                disabled={saving}
                onPress={() => onSubmit(true)}
                style={({ pressed }) => [styles.secondary, { borderColor: c.accent, backgroundColor: pressed ? c.raised : 'transparent' }]}
              >
                <Text style={[styles.secondaryText, f.sansSemiBold, { color: c.accent }]}>{t.crewConfirm}</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
        {closed ? (
          <View testID="read-only" style={[styles.readOnly, { borderColor: c.border }]}>
            <View style={styles.inline}>
              <Icon name={s.icon} size={20} strokeWidth={2} color={s.color} />
              <Text style={[styles.readOnlyState, f.sansSemiBold, { color: s.color }]}>{t.states[k]}</Text>
            </View>
            <Text style={[styles.small, f.sans, { color: c.dim }]}>{t.readOnly}</Text>
          </View>
        ) : (
          <Pressable
            testID="submit"
            accessibilityRole="button"
            accessibilityState={{ disabled: saving, busy: saving }}
            disabled={saving}
            onPress={() => onSubmit()}
            style={({ pressed }) => [styles.primary, { backgroundColor: pressed ? c.accentPress : c.accent }]}
          >
            <Icon name="send" size={22} strokeWidth={2} color={c.onAccent} />
            <Text style={[styles.primaryText, f.sansSemiBold, { color: c.onAccent }]}>{t.submit}</Text>
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
  title: { fontSize: 24, lineHeight: 28 },
  sub: { fontSize: 13 },
  error: { fontSize: 13, padding: 16 },
  body: { flex: 1 },
  bodyContent: { paddingTop: 12, paddingHorizontal: 16, paddingBottom: 20, gap: 12 },
  bodyWide: { paddingVertical: 24, paddingHorizontal: 32, maxWidth: 1100, width: '100%', alignSelf: 'center' },
  columns: { flexDirection: 'row', gap: 24, alignItems: 'flex-start' },
  column: { flex: 1, minWidth: 0, gap: 12 },
  footerWide: { alignItems: 'flex-end', paddingTop: 12, paddingHorizontal: 32 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  mismatch: { alignSelf: 'stretch', borderWidth: 1, borderRadius: radius, padding: 12, gap: 10, marginBottom: 10 },
  reasonInput: { height: 56, borderRadius: radius, borderWidth: 1, paddingHorizontal: 14, fontSize: 15 },
  mismatchActions: { flexDirection: 'row', gap: 8 },
  secondary: {
    flex: 1,
    minHeight: 56,
    borderRadius: radius,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  secondaryText: { fontSize: 16, textAlign: 'center' },
  small: { fontSize: 13 },
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
  date: { fontSize: 15 },
  arrivalTime: { fontSize: 24, fontVariant: ['tabular-nums'] },
  card: { paddingVertical: 14, paddingHorizontal: 16, borderRadius: radius, gap: 10 },
  label: { fontSize: 13, letterSpacing: 13 * 0.08, textTransform: 'uppercase' },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  totalFig: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  total: { fontSize: 48, lineHeight: 50, fontVariant: ['tabular-nums'] },
  totalUnit: { fontSize: 20 },
  estimate: { fontSize: 15 },
  hint: { fontSize: 13, flexShrink: 1 },
  typesLabel: { paddingHorizontal: 2, paddingBottom: 6 },
  typeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, borderTopWidth: 1 },
  typeName: { fontSize: 17 },
  spacer: { flex: 1 },
  count: { fontSize: 13 },
  typeFig: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'flex-end', gap: 4, minWidth: 72 },
  typeValue: { fontSize: 17, fontVariant: ['tabular-nums'] },
  typesToggle: { height: 56, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4, borderTopWidth: 1 },
  typesToggleText: { fontSize: 17 },
  linked: { fontSize: 15, flexShrink: 1 },
  distanceRow: {
    paddingTop: 12,
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  distanceText: { gap: 2 },
  distanceLabel: { fontSize: 15 },
  distanceInput: {
    width: 96,
    height: 56,
    borderRadius: radius,
    borderWidth: 1,
    paddingHorizontal: 12,
    textAlign: 'right',
    fontSize: 20,
  },
  km: { fontSize: 15 },
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
  primaryText: { fontSize: 20 },
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
  readOnlyState: { fontSize: 17 },
});
