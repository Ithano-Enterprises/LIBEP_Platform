import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { LandingSite } from '../../data/types';
import { radius } from '../../theme/tokens';
import { Icon } from '../../ui/Icon';
import { PlaceholderTag } from '../../ui/PlaceholderTag';
import { useFontSet, useStrings, useTheme } from '../../ui/preferences';

// Landing site. Phone: a row showing the chosen site that opens to pick
// another. Tablet: a card with the options always shown. Landing
// elsewhere is allowed; the fee note is a placeholder in the design.
export function SitePicker({
  sites,
  homeId,
  value,
  onChange,
  disabled,
  wide = false,
}: {
  wide?: boolean;
  sites: LandingSite[];
  homeId: string;
  value: string;
  onChange: (id: string) => void;
  disabled: boolean;
}) {
  const c = useTheme();
  const t = useStrings();
  const [open, setOpen] = useState(false);
  const f = useFontSet();
  // Assigned site first, then the others by name.
  const ordered = [...sites].sort((a, b) => (a.id === homeId ? -1 : b.id === homeId ? 1 : a.name.localeCompare(b.name)));
  const chosen = sites.find((s) => s.id === value);
  const label = chosen ? (chosen.id === homeId ? `${chosen.name} (${t.assigned})` : chosen.name) : '--';

  const showOptions = wide || (open && !disabled);

  return (
    <View style={[styles.wrap, wide && [styles.card, { backgroundColor: c.surface }]]}>
      {wide ? <Text style={[styles.label, f.sansMedium, { color: c.dim }]}>{t.site}</Text> : null}
      {wide ? null : (
        <Pressable
          testID="site-row"
          accessibilityRole="button"
          accessibilityState={{ expanded: open, disabled }}
          disabled={disabled}
          onPress={() => setOpen((o) => !o)}
          style={({ pressed }) => [styles.row, { borderColor: c.border, backgroundColor: pressed ? c.raised : 'transparent' }]}
        >
          <Icon name="pin" size={20} color={c.dim} />
          <Text style={[styles.rowText, f.sansMedium, { color: c.text }]} numberOfLines={1}>
            {t.siteRow}: {label}
          </Text>
          <Icon name={open ? 'chevU' : 'chevD'} size={18} strokeWidth={2} color={c.dim} />
        </Pressable>
      )}
      {showOptions ? (
        <View style={styles.grid}>
          {ordered.map((s) => {
            const active = s.id === value;
            return (
              <Pressable
                key={s.id}
                testID={`site-${s.name}`}
                accessibilityRole="button"
                accessibilityState={{ selected: active, disabled }}
                disabled={disabled}
                onPress={() => {
                  onChange(s.id);
                  setOpen(false);
                }}
                style={[
                  styles.option,
                  active
                    ? { backgroundColor: c.raised, borderWidth: 2, borderColor: c.accent }
                    : { borderWidth: 1, borderColor: c.border },
                ]}
              >
                <Icon name="pin" size={18} color={active ? c.text : c.dim} />
                <View style={styles.optionText}>
                  <Text style={[styles.optionName, f.sansSemiBold, { color: c.text }]}>{s.name}</Text>
                  {s.id === homeId ? <Text style={[styles.assigned, f.mono, { color: c.dim }]}>{t.assigned}</Text> : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      {value !== homeId ? (
        <View testID="fee-note" style={[styles.fee, { backgroundColor: c.raised }]}>
          <Icon name="info" size={18} color={c.dim} />
          <View style={styles.feeText}>
            <Text style={[styles.feeLine, f.sans, { color: c.text }]}>{t.uploadLine}</Text>
            <Text style={[styles.feeSub, f.sans, { color: c.dim }]}>{t.feeState}</Text>
          </View>
          <PlaceholderTag />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  card: { paddingVertical: 14, paddingHorizontal: 16, borderRadius: radius, gap: 10 },
  label: { fontSize: 13, letterSpacing: 13 * 0.08, textTransform: 'uppercase' },
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    borderRadius: radius,
    borderWidth: 1,
  },
  rowText: { flex: 1, fontSize: 17 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  option: {
    flexBasis: '48%',
    flexGrow: 1,
    minHeight: 64,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  optionText: { gap: 1 },
  optionName: { fontSize: 17 },
  assigned: { fontSize: 12 },
  fee: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8 },
  feeText: { flex: 1, gap: 3 },
  feeLine: { fontSize: 15, lineHeight: 20 },
  feeSub: { fontSize: 13, lineHeight: 18 },
});
