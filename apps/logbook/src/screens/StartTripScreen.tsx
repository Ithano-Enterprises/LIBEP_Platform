import { StatusBar } from 'expo-status-bar';
import { useEffect, useState, type ReactNode } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CREW_DEFAULT } from '../data/repository';
import { fonts, radius, touchTarget } from '../theme/tokens';
import { formatDay, formatTime } from '../ui/format';
import { Icon } from '../ui/Icon';
import { usePreferences, useStrings, useTheme } from '../ui/preferences';
import { CrewStepper } from './startTrip/CrewStepper';
import { DepartureBox } from './startTrip/DepartureBox';
import { startMode } from './startTrip/model';
import { SiteNotice } from './startTrip/SiteNotice';
import { useStartTrip } from './startTrip/useStartTrip';
import { VesselCard } from './startTrip/VesselCard';

const systemNow = () => new Date();

// S1 Start trip, phone layout. Ready: pick crew, departure is the time of
// the tap. Blocked (a trip is already open): no stepper, back to S2.1.
// The header back button returns to S2.1 without starting a trip.
export function StartTripScreen({
  onDone,
  now = systemNow,
}: {
  /** Back to S2.1, after starting a trip or from the blocked state. */
  onDone: () => void;
  now?: () => Date;
}) {
  const { mode, lang } = usePreferences();
  const c = useTheme();
  const t = useStrings();
  const insets = useSafeAreaInsets();
  const { data, error, start } = useStartTrip();
  const [crew, setCrew] = useState(CREW_DEFAULT);
  const [saving, setSaving] = useState(false);
  const [clock, setClock] = useState(now);

  // Keep the shown departure current; the saved one is taken at the tap.
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

  const { profile, openTrip } = data;
  const blocked = startMode(openTrip) === 'blocked';

  const onPress = async () => {
    if (blocked) return onDone();
    if (saving) return;
    setSaving(true);
    try {
      if (await start(crew, now())) onDone();
    } finally {
      setSaving(false);
    }
  };

  return shell(
    <>
      <View style={[styles.header, { borderBottomColor: c.border }]}>
        <Pressable
          testID="back"
          accessibilityRole="button"
          accessibilityLabel={t.back}
          onPress={onDone}
          style={({ pressed }) => [styles.back, pressed && { backgroundColor: c.raised }]}
        >
          <Icon name="back" size={24} strokeWidth={2} color={c.text} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: c.text }]}>{t.startTrip}</Text>
          <Text style={[styles.date, { color: c.dim }]}>{formatDay(clock, lang)}</Text>
        </View>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        <VesselCard profile={profile} />
        {blocked ? null : <CrewStepper value={crew} onChange={setCrew} />}
        <DepartureBox time={openTrip ? formatTime(openTrip.departure_at) : formatTime(clock.toISOString())} />
        {blocked ? (
          <View testID="trip-open-note" style={styles.note}>
            <Icon name="alert" size={18} strokeWidth={2} color={c.accent} />
            <Text style={[styles.noteText, { color: c.text }]}>{t.tripOpenNote}</Text>
          </View>
        ) : (
          <SiteNotice site={profile.home_site.name} />
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: 16 + insets.bottom }]}>
        <Pressable
          testID="primary"
          accessibilityRole="button"
          accessibilityState={{ disabled: saving, busy: saving }}
          disabled={saving}
          onPress={onPress}
          style={({ pressed }) => [styles.primary, { backgroundColor: pressed ? c.accentPress : c.accent }]}
        >
          <Icon name={blocked ? 'chevR' : 'play'} size={20} strokeWidth={2.2} color={c.onAccent} />
          <Text style={[styles.primaryText, { color: c.onAccent }]}>{blocked ? t.goOpen : t.startTrip}</Text>
        </Pressable>
      </View>
    </>,
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  error: { fontFamily: fonts.mono, fontSize: 13, padding: 16 },
  // Same header layout as S3.3: back button, then the title.
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
  back: {
    width: touchTarget,
    height: touchTarget,
    borderRadius: radius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontFamily: fonts.sansSemiBold, fontSize: 24, lineHeight: 28 },
  date: { fontFamily: fonts.sans, fontSize: 13 },
  body: { flex: 1 },
  bodyContent: { padding: 16, gap: 12 },
  note: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  noteText: { fontFamily: fonts.sansMedium, fontSize: 15, flexShrink: 1 },
  footer: { paddingTop: 8, paddingHorizontal: 16, alignItems: 'center' },
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
});
