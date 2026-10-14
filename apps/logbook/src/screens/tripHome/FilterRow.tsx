import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { StateKey } from '../../i18n/strings';
import { radius, touchTarget } from '../../theme/tokens';
import { Icon } from '../../ui/Icon';
import { useFontSet, useStrings, useTheme } from '../../ui/preferences';
import { STATE_ORDER } from './model';
import { stateStyle } from './stateStyle';

// State filters with counts. On a phone only icon + count show; the full
// label is the accessibility label. On a tablet the short label shows too
// and the row wraps, as in the design.
export function FilterRow({
  counts,
  total,
  active,
  onChange,
  wide = false,
}: {
  counts: Record<StateKey, number>;
  total: number;
  active: StateKey | null;
  onChange: (f: StateKey | null) => void;
  wide?: boolean;
}) {
  const c = useTheme();
  const t = useStrings();
  const f = useFontSet();
  const items: (StateKey | null)[] = [null, ...STATE_ORDER];
  return (
    <ScrollView
      horizontal={!wide}
      scrollEnabled={!wide}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.row, wide && styles.rowWide]}
    >
      {items.map((k) => {
        const on = active === k;
        const count = k ? counts[k] : total;
        const label = k ? t.states[k] : t.fShort.all;
        const st = k ? stateStyle(k, c) : null;
        return (
          <Pressable
            key={k ?? 'all'}
            testID={`filter-${k ?? 'all'}`}
            accessibilityRole="button"
            accessibilityLabel={`${label} · ${count}`}
            accessibilityState={{ selected: on }}
            onPress={() => onChange(k)}
            style={[
              styles.button,
              on
                ? { backgroundColor: c.raised, borderWidth: 2, borderColor: c.accent }
                : { borderWidth: 1, borderColor: c.border },
            ]}
          >
            <View>
              <Icon
                name={st ? st.icon : 'list'}
                size={16}
                strokeWidth={2}
                color={st ? st.color : on ? c.text : c.dim}
              />
            </View>
            {wide ? (
              <Text style={[styles.label, { color: on ? c.text : c.dim }]}>{t.fShort[k ?? 'all']}</Text>
            ) : null}
            <Text style={[styles.count, { color: on ? c.text : c.dim }]}>{count}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: 6, paddingHorizontal: 16, paddingTop: 2 },
  rowWide: { flexDirection: 'row', flexWrap: 'wrap' },
  label: { fontFamily: fonts.sansMedium, fontSize: 15 },
  button: {
    height: touchTarget,
    minWidth: touchTarget,
    paddingHorizontal: 12,
    borderRadius: radius,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  count: { fontSize: 15 },
});
