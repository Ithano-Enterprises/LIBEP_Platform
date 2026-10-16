import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { GroundsCatch, MenuItem } from '../../data/types';
import { seasonGloss } from '../../i18n/strings';
import { radius } from '../../theme/tokens';
import { formatQuantity } from '../../ui/format';
import { HoldBox } from '../../ui/HoldBox';
import { Icon } from '../../ui/Icon';
import { PlaceholderTag } from '../../ui/PlaceholderTag';
import { useFontSet, usePreferences, useStrings, useTheme } from '../../ui/preferences';
import { TierChip } from '../../ui/TierChip';
import { buildGrounds, type Filters, type Range, type Season } from './model';

// S5.5 filters. Phone: a sheet from the bottom. Tablet: a popover. "Onyesha"
// shows the live result count before applying.
export function FiltersSheet({
  value,
  menu,
  catches,
  now,
  wide,
  onApply,
  onClose,
}: {
  value: Filters;
  menu: MenuItem[];
  catches: GroundsCatch[];
  now: Date;
  wide: boolean;
  onApply: (f: Filters) => void;
  onClose: () => void;
}) {
  const c = useTheme();
  const t = useStrings();
  const { lang } = usePreferences();
  const insets = useSafeAreaInsets();
  const f = useFontSet();
  const [draft, setDraft] = useState<Filters>(value);
  const result = buildGrounds(catches, { now, ...draft });
  const toggleSpecies = (id: string) =>
    setDraft((d) => ({
      ...d,
      species: d.species.includes(id) ? d.species.filter((x) => x !== id) : [...d.species, id],
    }));
  const rangeLabel: Record<Range, string> = { '30': t.r30, '90': t.r90, season: t.rSeason, all: t.rAll };
  const seasonLabel: Record<Season, string> = { all: t.all, kaskazi: t.kaskazi, kusi: t.kusi };

  const option = (on: boolean, onPress: () => void, label: string, testID: string, gloss?: string | null) => (
    <Pressable
      key={testID}
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={[
        styles.option,
        on ? { backgroundColor: c.accent, borderWidth: 2, borderColor: c.accent } : { backgroundColor: c.raised, borderWidth: 1, borderColor: c.border },
      ]}
    >
      <Text style={[styles.optionText, f.sansSemiBold, { color: on ? c.onAccent : c.text }]}>{label}</Text>
      {gloss ? <Text style={[styles.gloss, f.sans, { color: on ? c.onAccent : c.dim }]}>{gloss}</Text> : null}
    </Pressable>
  );

  return (
    <>
      <Pressable
        testID="flt-scrim"
        accessibilityLabel={t.close}
        onPress={onClose}
        style={[StyleSheet.absoluteFill, styles.scrim, !wide && styles.scrimDim]}
      />
      <View
        testID="flt-sheet"
        style={[
          wide ? styles.popover : styles.sheet,
          { backgroundColor: c.surface, borderColor: c.border },
        ]}
      >
        <View style={styles.head}>
          <Icon name="filter" size={20} color={c.text} />
          <Text style={[styles.title, f.sansSemiBold, { color: c.text }]}>{t.filters}</Text>
          <Pressable testID="flt-close" accessibilityRole="button" accessibilityLabel={t.close} onPress={onClose} style={styles.close}>
            <Icon name="x" size={22} color={c.dim} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.body}>
          <Text style={[styles.label, f.sansMedium, { color: c.dim }]}>{t.chipSpecies}</Text>
          <View style={styles.tiles}>
            {[{ id: null as string | null, item: null as MenuItem | null }, ...menu.map((m) => ({ id: m.id, item: m }))].map(
              ({ id, item }) => {
                const on = id == null ? draft.species.length === 0 : draft.species.includes(id);
                return (
                  <Pressable
                    key={id ?? 'all'}
                    testID={`flt-species-${item?.local_name ?? 'all'}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    onPress={() => (id == null ? setDraft((d) => ({ ...d, species: [] })) : toggleSpecies(id))}
                    style={[
                      styles.tile,
                      { flexBasis: wide ? '23%' : '31%' },
                      on ? { backgroundColor: c.accent, borderWidth: 2, borderColor: c.accent } : { backgroundColor: c.raised, borderWidth: 1, borderColor: c.border },
                    ]}
                  >
                    <View style={styles.tileTop}>
                      {item?.hold_code ? <HoldBox code={item.hold_code} /> : null}
                      <Icon name={item ? 'fish' : 'list'} size={18} color={on ? c.onAccent : c.dim} />
                    </View>
                    <Text style={[styles.optionText, f.sansSemiBold, { color: on ? c.onAccent : c.text }]}>{item?.local_name ?? t.all}</Text>
                    {lang === 'en' && item?.english_gloss ? (
                      <Text style={[styles.gloss, f.sans, { color: on ? c.onAccent : c.dim }]}>{item.english_gloss}</Text>
                    ) : null}
                  </Pressable>
                );
              },
            )}
          </View>
          <View style={styles.labelRow}>
            <Text style={[styles.label, f.sansMedium, { color: c.dim }]}>{t.chipSeason}</Text>
            <PlaceholderTag />
            <Text style={[styles.gloss, f.sans, { color: c.dim }]}>{t.seasonPh}</Text>
          </View>
          <View style={styles.options}>
            {(['all', 'kaskazi', 'kusi'] as Season[]).map((s) =>
              option(draft.season === s, () => setDraft((d) => ({ ...d, season: s })), seasonLabel[s], `flt-season-${s}`, s === 'all' ? null : seasonGloss[lang][s]),
            )}
          </View>
          <Text style={[styles.label, f.sansMedium, { color: c.dim }]}>{t.chipRange}</Text>
          <View style={styles.options}>
            {(['30', '90', 'season', 'all'] as Range[]).map((r) =>
              option(draft.range === r, () => setDraft((d) => ({ ...d, range: r })), rangeLabel[r], `flt-range-${r}`),
            )}
          </View>
        </ScrollView>
        <View style={[styles.foot, { borderTopColor: c.border, paddingBottom: 16 + (wide ? 0 : insets.bottom) }]}>
          <Pressable
            testID="flt-apply"
            accessibilityRole="button"
            onPress={() => onApply(draft)}
            style={({ pressed }) => [styles.apply, { backgroundColor: pressed ? c.accentPress : c.accent }]}
          >
            <Icon name="check" size={22} strokeWidth={2.2} color={c.onAccent} />
            <Text style={[styles.applyText, f.sansSemiBold, { color: c.onAccent }]}>{t.show}</Text>
            <Text testID="flt-count" style={[styles.count, f.mono, { color: c.onAccent }]}>
              {t.spotsN.replace('{n}', String(result.spots.length))} ·{' '}
              {draft.species.length
                ? `${formatQuantity(result.totalT)} t`
                : t.tripsN.replace('{n}', String(result.tripCount)).toLowerCase()}
            </Text>
            {draft.species.length ? <TierChip tier="S" /> : null}
          </Pressable>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  scrim: { zIndex: 30 },
  scrimDim: { backgroundColor: 'rgba(5,9,10,0.55)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: 56,
    borderTopWidth: 1,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
    zIndex: 31,
  },
  popover: {
    position: 'absolute',
    left: 476,
    top: 176,
    width: 480,
    maxHeight: 600,
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
    zIndex: 31,
    elevation: 12,
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 16 },
  },
  head: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 16 },
  title: { flex: 1, fontSize: 20 },
  close: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: 16, paddingBottom: 16, gap: 10 },
  label: { fontSize: 13, letterSpacing: 13 * 0.08, textTransform: 'uppercase' },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tile: { flexGrow: 1, minHeight: 64, paddingVertical: 8, paddingHorizontal: 10, borderRadius: radius, gap: 4, justifyContent: 'center' },
  tileTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  options: { flexDirection: 'row', gap: 6 },
  option: { flex: 1, minHeight: 56, paddingVertical: 6, paddingHorizontal: 8, borderRadius: radius, alignItems: 'center', justifyContent: 'center', gap: 2 },
  optionText: { fontSize: 15, textAlign: 'center' },
  gloss: { fontSize: 12, textAlign: 'center' },
  foot: { paddingTop: 12, paddingHorizontal: 16, borderTopWidth: 1 },
  apply: { height: 64, borderRadius: radius, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  applyText: { fontSize: 20 },
  count: { fontSize: 15 },
});
