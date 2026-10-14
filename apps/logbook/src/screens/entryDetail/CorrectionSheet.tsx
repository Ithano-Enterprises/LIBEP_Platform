import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Entry, MenuItem } from '../../data/types';
import { fonts, radius } from '../../theme/tokens';
import { formatQuantity } from '../../ui/format';
import { Icon } from '../../ui/Icon';
import { useStrings, useTheme } from '../../ui/preferences';
import { TierChip } from '../../ui/TierChip';
import { Keypad } from '../logCatch/Keypad';
import { MenuTile } from '../logCatch/MenuTile';
import { parseEntry } from '../logCatch/model';

// Sahihisha: pick the right fish and/or figure. Saved as a new correction
// record linked to the entry; the original stays as it was.
export function CorrectionSheet({
  entry,
  menu,
  saving,
  error,
  onClose,
  onSave,
}: {
  entry: Entry;
  menu: MenuItem[];
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (input: { speciesId: string; quantity: number }) => void;
}) {
  const c = useTheme();
  const t = useStrings();
  const insets = useSafeAreaInsets();
  const [speciesId, setSpeciesId] = useState(entry.species_id);
  const [value, setValue] = useState(formatQuantity(entry.quantity));
  const quantity = parseEntry(value);
  const changed =
    quantity != null && (speciesId !== entry.species_id || Math.round(quantity * 10) !== Math.round(entry.quantity * 10));
  const valid = changed && !saving;

  return (
    <>
      <Pressable
        testID="correct-scrim"
        accessibilityLabel={t.back}
        onPress={onClose}
        style={[StyleSheet.absoluteFill, styles.scrim]}
      />
      <View
        testID="correct-sheet"
        style={[styles.sheet, { backgroundColor: c.surface, borderColor: c.border, paddingBottom: 12 + insets.bottom }]}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.head}>
            <View style={styles.title}>
              <Icon name="pencil" size={20} color={c.text} />
              <Text style={[styles.titleText, { color: c.text }]}>{t.correct}</Text>
            </View>
            <View style={styles.figure}>
              <Text testID="correct-value" style={[styles.value, { color: c.text }]}>
                {value || '0'}
              </Text>
              <Text style={[styles.unit, { color: c.dim }]}>t</Text>
              <TierChip tier="S" size={22} />
            </View>
          </View>
          <View style={styles.grid}>
            {menu.map((m) => (
              <MenuTile key={m.id} item={m} active={m.id === speciesId} onPress={() => setSpeciesId(m.id)} />
            ))}
          </View>
          <Keypad value={value} onChange={setValue} />
          {error ? <Text style={[styles.error, { color: c.danger }]}>{error}</Text> : null}
          <Pressable
            testID="correct-save"
            accessibilityRole="button"
            accessibilityState={{ disabled: !valid, busy: saving }}
            disabled={!valid}
            onPress={() => quantity != null && onSave({ speciesId, quantity })}
            style={({ pressed }) => [
              styles.save,
              { backgroundColor: valid ? (pressed ? c.accentPress : c.accent) : c.raised },
            ]}
          >
            <Icon name="check" size={22} strokeWidth={2.2} color={valid ? c.onAccent : c.dim} />
            <Text style={[styles.saveText, { color: valid ? c.onAccent : c.dim }]}>{t.save}</Text>
          </Pressable>
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  scrim: { backgroundColor: 'rgba(4,9,10,0.6)', zIndex: 4 },
  sheet: {
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
  content: { gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  title: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  titleText: { fontFamily: fonts.sansSemiBold, fontSize: 20 },
  figure: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  value: { fontFamily: fonts.monoSemiBold, fontSize: 32, lineHeight: 34, fontVariant: ['tabular-nums'] },
  unit: { fontFamily: fonts.mono, fontSize: 17 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  error: { fontFamily: fonts.mono, fontSize: 13 },
  save: {
    height: 64,
    borderRadius: radius,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  saveText: { fontFamily: fonts.sansSemiBold, fontSize: 20 },
});
