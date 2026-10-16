import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { deviceLocator, type Locator } from '../data/location';
import type { Gps, MenuItem } from '../data/types';
import { radius } from '../theme/tokens';
import { BackButton } from '../ui/BackButton';
import { formatTime } from '../ui/format';
import { Icon } from '../ui/Icon';
import { useFontSet, usePreferences, useStrings, useTheme } from '../ui/preferences';
import { EntrySheet } from './logCatch/EntrySheet';
import { MenuTile } from './logCatch/MenuTile';
import { filterMenu, parseEntry } from './logCatch/model';
import { useLogCatch } from './logCatch/useLogCatch';

const systemNow = () => new Date();

// S3.3 Log catch, phone layout. Pick a fish from the vessel's menu, type
// the estimate on the built-in keypad, save. Time, GPS and vessel are
// captured by the app. Saving returns to the trip home.
export function LogCatchScreen({
  onDone,
  now = systemNow,
  locator = deviceLocator,
}: {
  /** Back to S2.1, after saving or from the back button. */
  onDone: () => void;
  now?: () => Date;
  locator?: Locator;
}) {
  const { mode } = usePreferences();
  const c = useTheme();
  const t = useStrings();
  const insets = useSafeAreaInsets();
  const { data, error, save } = useLogCatch();
  const [query, setQuery] = useState('');
  const f = useFontSet();
  const [pick, setPick] = useState<MenuItem | null>(null);
  const [value, setValue] = useState('');
  const [note, setNote] = useState('');
  const [gps, setGps] = useState<Gps | null>(null);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [clock, setClock] = useState(now);
  const fix = useRef<Promise<Gps | null> | null>(null);

  useEffect(() => {
    const id = setInterval(() => setClock(now()), 15_000);
    return () => clearInterval(id);
  }, [now]);

  const closeSheet = useCallback(() => {
    fix.current = null; // a late fix for a closed sheet is dropped
    setPick(null);
    setValue('');
    setNote('');
    setSaveError(null);
  }, []);

  // Android back closes the sheet first, then leaves the screen.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (pick) closeSheet();
      else onDone();
      return true;
    });
    return () => sub.remove();
  }, [pick, closeSheet, onDone]);

  const shell = (children: ReactNode) => (
    <View testID="screen" style={[styles.screen, { backgroundColor: c.bg, paddingTop: insets.top }]}>
      <StatusBar style={mode === 'night' ? 'light' : 'dark'} />
      {children}
    </View>
  );

  if (error) {
    return shell(<Text style={[styles.error, f.mono, { color: c.danger }]}>{error.message}</Text>);
  }
  if (!data) return shell(null);
  if (!data.profile) {
    // [TO CONFIRM: device enrolment screen; not in the design yet]
    return shell(<Text style={[styles.error, f.mono, { color: c.dim }]}>{t.noVessel}</Text>);
  }

  const { profile, openTrip, menu } = data;
  const tripOpen = !!openTrip;
  const visible = filterMenu(menu, query);
  const menuLabel = `${t.menu}: ${profile.vessel.tonnage_class} t`;

  const onPick = (item: MenuItem) => {
    if (!tripOpen || pick?.id === item.id) return;
    setPick(item);
    setValue('');
    setNote('');
    setSaveError(null);
    // Position is read once per pick, so it is close to the catch.
    setLocating(true);
    setGps(null);
    const p = locator.getFix();
    fix.current = p;
    p.then((g) => {
      if (fix.current !== p) return;
      setGps(g);
      setLocating(false);
    });
  };

  const onSave = async () => {
    const quantity = parseEntry(value);
    if (!pick || quantity == null || saving) return;
    setSaving(true);
    try {
      const position = (await fix.current) ?? null;
      await save({ speciesId: pick.id, quantity, gps: position, note });
      closeSheet();
      onDone();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return shell(
    <>
      <View style={[styles.header, { borderBottomColor: c.border }]}>
        <BackButton onPress={onDone} />
        <View style={styles.headerText}>
          <Text style={[styles.title, f.sansSemiBold, { color: c.text }]} numberOfLines={1}>
            {t.logCatch}
          </Text>
          <Text style={[styles.sub, f.mono, { color: c.dim }]} numberOfLines={1}>
            {profile.vessel.name} · {profile.vessel.registration}
          </Text>
          <View style={[styles.menuChip, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Icon name="weight" size={15} color={c.text} />
            <Text style={[styles.menuChipText, f.monoSemiBold, { color: c.text }]}>{menuLabel}</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        keyboardShouldPersistTaps="handled"
      >
        {!tripOpen ? (
          <View testID="no-trip" style={[styles.noTrip, { borderColor: c.accent }]}>
            <Icon name="alert" size={18} strokeWidth={2} color={c.accent} />
            <Text style={[styles.noTripText, f.sansMedium, { color: c.accent }]}>{t.startToLog}</Text>
          </View>
        ) : null}
        <View style={styles.search}>
          <View style={styles.searchIcon} pointerEvents="none">
            <Icon name="search" size={18} color={c.dim} />
          </View>
          {/* Never auto-focused: the keyboard would cover the menu. */}
          <TextInput
            testID="search"
            value={query}
            onChangeText={setQuery}
            placeholder={t.search}
            placeholderTextColor={c.dim}
            autoCorrect={false}
            autoCapitalize="none"
            style={[styles.searchInput, f.sans, { backgroundColor: c.surface, borderColor: c.border, color: c.text }]}
          />
        </View>
        {/* DEV FIXTURE menus and hold codes, as the design marks them. */}
        <Text style={[styles.placeholderLine, f.mono, { color: c.dim }]}>
          placeholder list · hold codes: placeholder · {menuLabel}
        </Text>
        <View style={styles.grid}>
          {visible.map((m) => (
            <MenuTile
              key={m.id}
              item={m}
              active={pick?.id === m.id}
              disabled={!tripOpen}
              onPress={() => onPick(m)}
            />
          ))}
        </View>
      </ScrollView>

      {pick ? (
        <>
          <Pressable
            testID="scrim"
            accessibilityLabel={t.back}
            onPress={closeSheet}
            style={[StyleSheet.absoluteFill, styles.scrim]}
          />
          <View
            style={[
              styles.sheetWrap,
              { backgroundColor: c.surface, borderColor: c.border, paddingBottom: 12 + insets.bottom },
            ]}
          >
            <ScrollView keyboardShouldPersistTaps="handled">
              <EntrySheet
                item={pick}
                value={value}
                onChange={setValue}
                note={note}
                onNote={setNote}
                time={formatTime(clock.toISOString())}
                gps={gps}
                locating={locating}
                registration={profile.vessel.registration}
                saving={saving}
                onSave={onSave}
              />
              {saveError ? (
                <Text style={[styles.saveError, f.mono, { color: c.danger }]}>{saveError}</Text>
              ) : null}
            </ScrollView>
          </View>
        </>
      ) : null}
    </>,
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  error: { fontSize: 13, padding: 16 },
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
  headerText: { flex: 1, minWidth: 0, gap: 3 },
  title: { fontSize: 24, lineHeight: 28 },
  sub: { fontSize: 13 },
  menuChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 28,
    paddingHorizontal: 9,
    marginTop: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  menuChipText: { fontSize: 13 },
  body: { flex: 1 },
  bodyContent: { paddingTop: 12, paddingHorizontal: 16, paddingBottom: 16, gap: 10 },
  noTrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radius,
    borderWidth: 1,
  },
  noTripText: { fontSize: 15, flexShrink: 1 },
  search: { maxWidth: 520 },
  searchIcon: { position: 'absolute', left: 14, top: 19, zIndex: 1 },
  searchInput: {
    height: 56,
    borderRadius: radius,
    borderWidth: 1,
    paddingLeft: 42,
    paddingRight: 14,
    fontSize: 15,
  },
  placeholderLine: { fontSize: 12, paddingHorizontal: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  scrim: { backgroundColor: 'rgba(4,9,10,0.6)', zIndex: 4 },
  sheetWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '94%',
    paddingTop: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    zIndex: 5,
  },
  saveError: { fontSize: 13, paddingTop: 8 },
});
