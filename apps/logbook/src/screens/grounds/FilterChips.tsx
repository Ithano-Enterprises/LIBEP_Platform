import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { MenuItem } from '../../data/types';
import { radius } from '../../theme/tokens';
import { Icon } from '../../ui/Icon';
import { useFontSet, useStrings, useTheme } from '../../ui/preferences';
import { DEFAULT_FILTERS, type Filters } from './model';

// Species / Season / Range chips (56dp). Each opens the filters.
export function FilterChips({
  value,
  menu,
  wide,
  onOpen,
}: {
  value: Filters;
  menu: MenuItem[];
  wide: boolean;
  onOpen: () => void;
}) {
  const c = useTheme();
  const t = useStrings();
  const f = useFontSet();
  const names = value.species.map((id) => menu.find((m) => m.id === id)?.local_name ?? '?');
  const range = { '30': t.r30, '90': t.r90, season: t.rSeason, all: t.rAll }[value.range];
  const season = { all: t.all, kaskazi: t.kaskazi, kusi: t.kusi }[value.season];
  const chips: [string, string, boolean, string][] = [
    [t.chipSpecies, names.length ? names.join(', ') : t.all, names.length > 0, 'chip-species'],
    [t.chipSeason, season, value.season !== DEFAULT_FILTERS.season, 'chip-season'],
    [t.chipRange, range, value.range !== DEFAULT_FILTERS.range, 'chip-range'],
  ];
  return (
    <View style={[styles.row, wide && styles.rowWide]}>
      {chips.map(([k, v, on, id]) => (
        <Pressable
          key={id}
          testID={id}
          accessibilityRole="button"
          accessibilityLabel={`${k}: ${v}`}
          onPress={onOpen}
          style={[
            styles.chip,
            wide ? styles.chipWide : styles.chipNarrow,
            { backgroundColor: c.surface, borderColor: on ? c.accent : c.border, borderWidth: on ? 1.5 : 1 },
          ]}
        >
          <View style={styles.text}>
            <Text style={[styles.k, f.sans, { color: c.dim }]}>{k}</Text>
            <Text numberOfLines={1} style={[styles.v, f.sansSemiBold, { color: on ? c.accent : c.text }]}>
              {v}
            </Text>
          </View>
          <Icon name="chevD" size={16} strokeWidth={2} color={on ? c.accent : c.dim} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6 },
  rowWide: { gap: 8 },
  chip: { height: 56, paddingLeft: 12, paddingRight: 8, borderRadius: radius, flexDirection: 'row', alignItems: 'center', gap: 6 },
  chipNarrow: { flex: 1, minWidth: 0 },
  chipWide: { width: 170 },
  text: { flex: 1, minWidth: 0, gap: 1 },
  k: { fontSize: 12 },
  v: { fontSize: 16 },
});
