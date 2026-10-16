import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { deviceLocator, type Locator } from '../data/location';
import type { CatchRecord, Gps, MenuItem } from '../data/types';
import { radius } from '../theme/tokens';
import { BackButton } from '../ui/BackButton';
import { formatTime } from '../ui/format';
import { Icon } from '../ui/Icon';
import { useIsTablet } from '../ui/layout';
import { useFontSet, usePreferences, useStrings, useTheme } from '../ui/preferences';
import { ConfirmCard } from './logCatch/ConfirmCard';
import { EntrySheet } from './logCatch/EntrySheet';
import { MenuTile } from './logCatch/MenuTile';
import { filterMenu, OTHER_ID, otherItem, parseEntry, plausibility } from './logCatch/model';
import { useLogCatch } from './logCatch/useLogCatch';

const systemNow = () => new Date();
/** Tablet menu: tiles at least 148dp wide, 8dp apart (design grid). */
const TILE_MIN = 148;
const TILE_GAP = 8;
const WIDE_PAD = 24;

export function gridTileWidth(inner: number): number {
  const cols = Math.max(1, Math.floor((inner + TILE_GAP) / (TILE_MIN + TILE_GAP)));
  return Math.floor((inner - TILE_GAP * (cols - 1)) / cols);
}

// S3.3 Log catch. Pick a fish from the vessel's menu, type the estimate in
// whole kg on the built-in keypad, save. "Other" lets the captain type the
// local name when the fish is not on the menu. Time, GPS and vessel are
// captured by the app.
// After saving, a confirmation card offers to log another or go to the
// list. Phone: the entry sheet and the card slide over the menu. Tablet
// (600dp and up): menu left, a 480dp entry pane right.
export function LogCatchScreen({
  onDone,
  now = systemNow,
  locator = deviceLocator,
}: {
  /** Back to S2.1, from "Tazama orodha" or the back button. */
  onDone: () => void;
  now?: () => Date;
  locator?: Locator;
}) {
  const { mode } = usePreferences();
  const c = useTheme();
  const t = useStrings();
  const insets = useSafeAreaInsets();
  const { data, error, save } = useLogCatch();
  const wide = useIsTablet();
  const [menuWidth, setMenuWidth] = useState(0);
  const [query, setQuery] = useState('');
  const f = useFontSet();
  const [pick, setPick] = useState<MenuItem | null>(null);
  const [value, setValue] = useState('');
  const [otherName, setOtherName] = useState('');
  const [note, setNote] = useState('');
  const [gps, setGps] = useState<Gps | null>(null);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ record: CatchRecord; gloss: string | null } | null>(null);
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
    setOtherName('');
    setNote('');
    setSaveError(null);
  }, []);

  // Android back closes the sheet or the card first, then leaves the screen.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (pick) closeSheet();
      else if (saved) setSaved(null);
      else onDone();
      return true;
    });
    return () => sub.remove();
  }, [pick, saved, closeSheet, onDone]);

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
  const classLabel = `${profile.vessel.tonnage_class} t`;
  const menuLabel = `${t.menu}: ${classLabel}`;
  const tileWidth = wide && menuWidth > 0 ? gridTileWidth(menuWidth - 2 * WIDE_PAD) : undefined;
  const check = plausibility(parseEntry(value), data.tripTotal, profile.vessel.tonnage_class);
  const hint =
    check === 'entry_over_class'
      ? t.capHint.replace('{c}', classLabel)
      : check === 'trip_would_pass'
        ? t.tripCapHint.replace('{c}', classLabel)
        : null;

  const onPick = (item: MenuItem) => {
    if (!tripOpen || pick?.id === item.id) return;
    setSaved(null);
    setPick(item);
    setValue('');
    setOtherName('');
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
    const other = pick.id === OTHER_ID;
    if (other && !otherName.trim()) return;
    setSaving(true);
    try {
      const position = (await fix.current) ?? null;
      const species = other
        ? { speciesId: null, speciesLocalName: otherName } // as typed (contract §2)
        : { speciesId: pick.id };
      const record = await save({ ...species, quantity, gps: position, note });
      closeSheet();
      setSaved({ record, gloss: pick.english_gloss });
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const sheet = pick ? (
    <>
      <EntrySheet
        item={pick}
        value={value}
        onChange={setValue}
        otherName={otherName}
        onOtherName={setOtherName}
        note={note}
        onNote={setNote}
        time={formatTime(clock.toISOString())}
        gps={gps}
        locating={locating}
        registration={profile.vessel.registration}
        saving={saving}
        onSave={onSave}
        hint={hint}
      />
      {saveError ? <Text style={[styles.saveError, f.mono, { color: c.danger }]}>{saveError}</Text> : null}
    </>
  ) : null;

  const confirm =
    saved && !pick ? (
      <ConfirmCard
        inline={wide}
        record={saved.record}
        gloss={saved.gloss}
        onDismiss={() => setSaved(null)}
        onLogAnother={() => {
          setSaved(null);
          setQuery('');
        }}
        onViewList={onDone}
      />
    ) : null;

  const menuChip = (
    <View style={[styles.menuChip, !wide && styles.menuChipNarrow, { backgroundColor: c.surface, borderColor: c.border }]}>
      <Icon name="weight" size={15} color={c.text} />
      <Text style={[styles.menuChipText, f.monoSemiBold, { color: c.text }]}>{menuLabel}</Text>
    </View>
  );

  return shell(
    <>
      <View style={[styles.header, wide && styles.headerWide, { borderBottomColor: c.border }]}>
        <BackButton onPress={onDone} />
        <View style={styles.headerText}>
          <Text style={[styles.title, f.sansSemiBold, { color: c.text }]} numberOfLines={1}>
            {t.logCatch}
          </Text>
          <Text style={[styles.sub, f.mono, { color: c.dim }]} numberOfLines={1}>
            {profile.vessel.name} · {profile.vessel.registration}
          </Text>
          {wide ? null : menuChip}
        </View>
        {wide ? menuChip : null}
      </View>

      <View style={[styles.body, wide && styles.bodyWide]}>
        <ScrollView
          style={styles.body}
          contentContainerStyle={[styles.bodyContent, wide && styles.bodyContentWide]}
          keyboardShouldPersistTaps="handled"
          onLayout={(e) => setMenuWidth(e.nativeEvent.layout.width)}
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
                width={tileWidth}
              />
            ))}
            <MenuTile
              testID="fish-other"
              item={otherItem(t.other)}
              active={pick?.id === OTHER_ID}
              disabled={!tripOpen}
              onPress={() => onPick(otherItem(t.other))}
              width={tileWidth}
            />
          </View>
        </ScrollView>

        {wide ? (
          <View testID="entry-pane" style={[styles.entryPane, { backgroundColor: c.surface, borderLeftColor: c.border }]}>
            <ScrollView
              contentContainerStyle={[styles.entryPaneContent, { paddingBottom: 20 + insets.bottom }]}
              keyboardShouldPersistTaps="handled"
            >
              {sheet ?? confirm ?? (
                <View testID="pick-prompt" style={styles.pickPrompt}>
                  <Icon name="fish" size={32} strokeWidth={1.4} color={c.dim} />
                  <Text style={[styles.pickText, f.sansMedium, { color: c.dim }]}>{t.pick}</Text>
                </View>
              )}
            </ScrollView>
          </View>
        ) : null}
      </View>

      {!wide && pick ? (
        <>
          <Pressable
            testID="scrim"
            accessibilityRole="button"
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
            <ScrollView keyboardShouldPersistTaps="handled">{sheet}</ScrollView>
          </View>
        </>
      ) : null}

      {!wide ? confirm : null}
    </>,
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  error: { fontSize: 13, padding: 16 },
  headerWide: { paddingTop: 6, paddingRight: 24, paddingBottom: 12, paddingLeft: 12, gap: 14 },
  bodyWide: { flexDirection: 'row' },
  bodyContentWide: { paddingVertical: 20, paddingHorizontal: WIDE_PAD },
  entryPane: { width: 480, borderLeftWidth: 1 },
  entryPaneContent: { paddingTop: 20, paddingHorizontal: 24, gap: 12, flexGrow: 1 },
  pickPrompt: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 48 },
  pickText: { fontSize: 20 },
  menuChipNarrow: { marginTop: 3 },
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
