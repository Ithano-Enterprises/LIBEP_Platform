import { StatusBar } from 'expo-status-bar';
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { StateKey } from '../i18n/strings';
import { fonts, radius, touchTarget } from '../theme/tokens';
import { formatQuantity, formatTime, sumTonnes } from '../ui/format';
import { Icon } from '../ui/Icon';
import { usePreferences, useStrings, useTheme } from '../ui/preferences';
import { TierChip } from '../ui/TierChip';
import { EntryRow } from './tripHome/EntryRow';
import { FilterRow } from './tripHome/FilterRow';
import { Header } from './tripHome/Header';
import { countByState, filterEntries, hasRepeatedFigures } from './tripHome/model';
import { NoticesCard } from './tripHome/NoticesCard';
import { PreviousTrips } from './tripHome/PreviousTrips';
import { useTripHome } from './tripHome/useTripHome';

// S2.1 Trip home, phone layout. Start trip (S1), Log catch (S3.3), Close
// trip (S4) and entry detail are later slices; their buttons are shown
// but not wired yet.
export function TripHomeScreen({ now = () => new Date() }: { now?: () => Date }) {
  const { mode } = usePreferences();
  const c = useTheme();
  const t = useStrings();
  const insets = useSafeAreaInsets();
  const { data, error } = useTripHome();
  const [filter, setFilter] = useState<StateKey | null>(null);
  const [noticesOff, setNoticesOff] = useState(false);
  const unit = 't' as const;

  const shell = (children: ReactNode) => (
    <View testID="screen" style={[styles.screen, { backgroundColor: c.bg, paddingTop: insets.top }]}>
      <StatusBar style={mode === 'night' ? 'light' : 'dark'} />
      {children}
    </View>
  );

  if (error) {
    return shell(<Text style={[styles.error, { color: c.danger }]}>{error.message}</Text>);
  }
  if (!data) return shell(null);
  if (!data.profile) {
    // [TO CONFIRM: device enrolment screen; not in the design yet]
    return shell(<Text style={[styles.error, { color: c.dim }]}>No vessel linked to this device.</Text>);
  }

  const { openTrip, entries, closedTrips } = data;
  const counts = countByState(entries);
  const visible = filterEntries(entries, filter);
  const total = sumTonnes(entries.map((e) => e.quantity));
  const showNotices = !!openTrip && !noticesOff && hasRepeatedFigures(entries);

  return shell(
    <>
      <Header profile={data.profile} />

      <View style={styles.titleRow}>
        <View style={styles.titleText}>
          <Text style={[styles.title, { color: c.text }]}>{t.trip}</Text>
          {openTrip ? (
            <View style={styles.tripLine}>
              <Text style={[styles.tripLineText, { color: c.dim }]}>
                {t.started} {formatTime(openTrip.departure_at)} · {entries.length} {t.entriesWord} ·
              </Text>
              <Text testID="trip-total" style={[styles.tripTotal, { color: c.text }]}>
                {formatQuantity(total, unit)} {unit}
              </Text>
              <TierChip tier="S" size={17} />
            </View>
          ) : null}
        </View>
        {openTrip ? (
          <Pressable
            testID="close-trip"
            accessibilityRole="button"
            accessibilityState={{ disabled: true }}
            style={[styles.closeButton, { borderColor: c.border }]}
          >
            <Icon name="flag" size={18} strokeWidth={2} color={c.text} />
            <Text style={[styles.closeText, { color: c.text }]}>{t.closeTrip}</Text>
          </Pressable>
        ) : null}
      </View>

      {openTrip ? (
        <View>
          <FilterRow counts={counts} total={entries.length} active={filter} onChange={setFilter} />
        </View>
      ) : null}

      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        {showNotices ? <NoticesCard onDismiss={() => setNoticesOff(true)} /> : null}
        {visible.map((e) => (
          <EntryRow key={e.id} entry={e} unit={unit} />
        ))}
        {visible.length === 0 ? (
          <View testID="empty" style={styles.empty}>
            <Icon name="fish" size={32} strokeWidth={1.4} color={c.dim} />
            <Text style={[styles.emptyTitle, { color: c.dim }]}>{t.noEntries}</Text>
            {!openTrip ? <Text style={[styles.emptyBody, { color: c.dim }]}>{t.startToLog}</Text> : null}
          </View>
        ) : null}
        <PreviousTrips trips={closedTrips} now={now()} unit={unit} />
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: 16 + insets.bottom }]}>
        <Pressable
          testID="primary"
          accessibilityRole="button"
          accessibilityState={{ disabled: true }}
          style={[styles.primary, { backgroundColor: c.accent }]}
        >
          <Icon name={openTrip ? 'plus' : 'play'} size={22} strokeWidth={2.2} color={c.onAccent} />
          <Text style={[styles.primaryText, { color: c.onAccent }]}>
            {openTrip ? t.logCatch : t.startTrip}
          </Text>
        </Pressable>
      </View>
    </>,
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  error: { fontFamily: fonts.mono, fontSize: 13, padding: 16 },
  titleRow: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  titleText: { flexShrink: 1, minWidth: 0, gap: 2 },
  title: { fontFamily: fonts.sansSemiBold, fontSize: 22, lineHeight: 26 },
  tripLine: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 5 },
  tripLineText: { fontFamily: fonts.sans, fontSize: 13 },
  tripTotal: { fontFamily: fonts.monoSemiBold, fontSize: 13, fontVariant: ['tabular-nums'] },
  closeButton: {
    height: touchTarget,
    paddingHorizontal: 14,
    borderRadius: radius,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  closeText: { fontFamily: fonts.sansMedium, fontSize: 17 },
  list: { flex: 1 },
  listContent: { paddingTop: 8, paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
  empty: { paddingVertical: 28, alignItems: 'center', gap: 8 },
  emptyTitle: { fontFamily: fonts.sansMedium, fontSize: 17 },
  emptyBody: { fontFamily: fonts.sans, fontSize: 15, textAlign: 'center' },
  footer: { paddingTop: 8, paddingHorizontal: 16 },
  primary: {
    height: 64,
    borderRadius: radius,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  primaryText: { fontFamily: fonts.sansSemiBold, fontSize: 20 },
});
