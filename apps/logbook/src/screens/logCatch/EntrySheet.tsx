import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { Gps, MenuItem } from '../../data/types';
import { fonts, radius } from '../../theme/tokens';
import { HoldBox } from '../../ui/HoldBox';
import { Icon } from '../../ui/Icon';
import { usePreferences, useStrings, useTheme } from '../../ui/preferences';
import { TierChip } from '../../ui/TierChip';
import { AutoStrip } from './AutoStrip';
import { Keypad } from './Keypad';
import { OTHER_ID, parseEntry } from './model';

/** Longest note, as the design. */
const NOTE_MAX = 80;

// Entry sheet for the picked fish: figure in whole kg (estimate, S), keypad,
// optional note, the locked auto strip, and Save. For "Other" the captain
// types the local name, kept exactly as typed.
export function EntrySheet({
  item,
  value,
  onChange,
  otherName = '',
  onOtherName,
  note,
  onNote,
  time,
  gps,
  locating,
  registration,
  saving,
  onSave,
  hint,
}: {
  item: MenuItem;
  value: string;
  onChange: (v: string) => void;
  /** The typed local name, when item is the "Other" tile. */
  otherName?: string;
  onOtherName?: (v: string) => void;
  note: string;
  onNote: (v: string) => void;
  time: string;
  gps: Gps | null;
  locating: boolean;
  registration: string;
  saving: boolean;
  onSave: () => void;
  /** Soft plausibility warning; never blocks Save. */
  hint?: string | null;
}) {
  const c = useTheme();
  const t = useStrings();
  const { lang } = usePreferences();
  const [noteOpen, setNoteOpen] = useState(note.length > 0);
  const f = useFontSet();
  const other = item.id === OTHER_ID;
  const valid = parseEntry(value) != null && (!other || otherName.trim().length > 0) && !saving;

  return (
    <View testID="entry-sheet" style={styles.sheet}>
      <View style={styles.head}>
        <View style={styles.what}>
          {item.hold_code ? <HoldBox code={item.hold_code} size={26} /> : null}
          {other ? (
            <TextInput
              testID="other-name"
              value={otherName}
              onChangeText={onOtherName}
              placeholder={t.otherNamePh}
              placeholderTextColor={c.dim}
              accessibilityLabel={t.otherNamePh}
              autoCorrect={false}
              style={[styles.otherName, f.sansSemiBold, { backgroundColor: c.bg, borderColor: c.border, color: c.text }]}
            />
          ) : (
            <View style={styles.names}>
              <Text style={[styles.name, f.sansSemiBold, { color: c.text }]}>{item.local_name}</Text>
              {lang === 'en' && item.english_gloss ? (
                <Text style={[styles.gloss, f.sans, { color: c.dim }]}>{item.english_gloss}</Text>
              ) : null}
            </View>
          )}
        </View>
        <View style={styles.figureCol}>
          <View style={styles.figure}>
            <Text testID="entry-value" style={[styles.value, { color: c.text }]}>
              {value || '0'}
            </Text>
            <Text style={[styles.unit, f.mono, { color: c.dim }]}>kg</Text>
          </View>
          <View style={styles.estimate}>
            <Text style={[styles.estimateText, { color: c.dim }]}>{t.estimate}</Text>
            <TierChip tier="S" size={22} />
          </View>
        </View>
      </View>

      {hint ? (
        <View testID="cap-hint" style={styles.hint}>
          <Icon name="alert" size={16} strokeWidth={2} color={c.accent} />
          <Text style={[styles.hintText, { color: c.accent }]}>{hint}</Text>
        </View>
      ) : null}

      <Keypad value={value} onChange={onChange} />

      {noteOpen ? (
        <TextInput
          testID="note"
          value={note}
          onChangeText={(v) => onNote(v.slice(0, NOTE_MAX))}
          placeholder={t.notePh}
          placeholderTextColor={c.dim}
          maxLength={NOTE_MAX}
          style={[styles.note, { backgroundColor: c.bg, borderColor: c.border, color: c.text }]}
        />
      ) : (
        <Pressable
          testID="add-note"
          accessibilityRole="button"
          onPress={() => setNoteOpen(true)}
          style={styles.addNote}
        >
          <Icon name="pencil" size={18} color={c.dim} />
          <Text style={[styles.addNoteText, { color: c.dim }]}>{t.addNote}</Text>
        </Pressable>
      )}

      <AutoStrip time={time} gps={gps} locating={locating} registration={registration} />

      <Pressable
        testID="save"
        accessibilityRole="button"
        accessibilityState={{ disabled: !valid, busy: saving }}
        disabled={!valid}
        onPress={onSave}
        style={({ pressed }) => [
          styles.save,
          { backgroundColor: valid ? (pressed ? c.accentPress : c.accent) : c.raised },
        ]}
      >
        <Icon name="check" size={22} strokeWidth={2.2} color={valid ? c.onAccent : c.dim} />
        <Text style={[styles.saveText, { color: valid ? c.onAccent : c.dim }]}>{t.save}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { gap: 8 },
  head: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  what: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1, paddingTop: 4 },
  names: { gap: 1, flexShrink: 1 },
  name: { fontSize: 20, lineHeight: 23 },
  gloss: { fontSize: 13 },
  otherName: {
    flex: 1,
    minWidth: 140,
    height: 56,
    borderRadius: radius,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 18,
  },
  figureCol: { alignItems: 'flex-end', gap: 6 },
  figure: { flexDirection: 'row', alignItems: 'baseline', gap: 5 },
  value: { fontFamily: fonts.monoSemiBold, fontSize: 32, lineHeight: 34, fontVariant: ['tabular-nums'] },
  unit: { fontFamily: fonts.mono, fontSize: 17 },
  estimate: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  estimateText: { fontFamily: fonts.sansMedium, fontSize: 15 },
  hint: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  hintText: { fontFamily: fonts.sansMedium, fontSize: 13, flexShrink: 1 },
  addNote: { height: 56, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 },
  addNoteText: { fontFamily: fonts.sansMedium, fontSize: 15 },
  note: {
    height: 56,
    borderRadius: radius,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontFamily: fonts.sans,
    fontSize: 15,
  },
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
