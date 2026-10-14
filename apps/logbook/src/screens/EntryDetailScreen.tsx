import { StatusBar } from 'expo-status-bar';
import { useEffect, useState, type ReactNode } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DataError } from '../data/repository';
import { fonts } from '../theme/tokens';
import { Icon } from '../ui/Icon';
import { usePreferences, useStrings, useTheme } from '../ui/preferences';
import { CorrectionSheet } from './entryDetail/CorrectionSheet';
import { EntryDetail } from './entryDetail/EntryDetail';
import { useEntryDetail } from './entryDetail/useEntryDetail';

// Entry detail, phone: full screen with a back link to the trip.
export function EntryDetailScreen({ catchId, onDone }: { catchId: string; onDone: () => void }) {
  const { mode } = usePreferences();
  const c = useTheme();
  const t = useStrings();
  const insets = useSafeAreaInsets();
  const { data, error, correct } = useEntryDetail(catchId);
  const [correcting, setCorrecting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (correcting) setCorrecting(false);
      else onDone();
      return true;
    });
    return () => sub.remove();
  }, [correcting, onDone]);

  const shell = (children: ReactNode) => (
    <View testID="screen" style={[styles.screen, { backgroundColor: c.bg, paddingTop: insets.top }]}>
      <StatusBar style={mode === 'night' ? 'light' : 'dark'} />
      <View style={styles.top}>
        <Pressable
          testID="back"
          accessibilityRole="button"
          accessibilityLabel={t.back}
          onPress={onDone}
          style={styles.back}
        >
          <Icon name="back" size={22} strokeWidth={2} color={c.text} />
          <Text style={[styles.backText, { color: c.text }]}>{t.trip}</Text>
        </Pressable>
      </View>
      {children}
    </View>
  );

  if (error) return shell(<Text style={[styles.error, { color: c.danger }]}>{error.message}</Text>);
  if (!data) return shell(null);
  const { entry, history, profile, tripOpen, menu } = data;
  if (!entry || !profile) {
    return shell(<Text style={[styles.error, { color: c.dim }]}>Entry not found.</Text>);
  }
  const gloss = menu.find((m) => m.id === entry.species_id)?.english_gloss ?? null;

  const onSave = async (input: { speciesId: string; quantity: number }) => {
    setSaving(true);
    setSaveError(null);
    try {
      await correct({
        previousCorrectionId: entry.head_correction_id,
        speciesId: input.speciesId === entry.species_id ? undefined : input.speciesId,
        quantity: input.quantity,
      });
      setCorrecting(false);
    } catch (e) {
      // A correction that raced another, or a weighing that just arrived:
      // the reload shows the new state.
      setSaveError(e instanceof DataError ? e.code : e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return shell(
    <>
      <ScrollView style={styles.body} contentContainerStyle={[styles.content, { paddingBottom: 24 + insets.bottom }]}>
        <EntryDetail
          entry={entry}
          history={history}
          profile={profile}
          gloss={gloss}
          canCorrect={tripOpen}
          onCorrect={() => {
            setSaveError(null);
            setCorrecting(true);
          }}
        />
      </ScrollView>
      {correcting ? (
        <CorrectionSheet
          entry={entry}
          menu={menu}
          saving={saving}
          error={saveError}
          onClose={() => setCorrecting(false)}
          onSave={onSave}
        />
      ) : null}
    </>,
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  top: { paddingTop: 4, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' },
  back: { height: 56, paddingRight: 12, marginLeft: -6, flexDirection: 'row', alignItems: 'center', gap: 4 },
  backText: { fontFamily: fonts.sansMedium, fontSize: 17 },
  error: { fontFamily: fonts.mono, fontSize: 13, padding: 16 },
  body: { flex: 1 },
  content: { paddingTop: 8, paddingHorizontal: 16 },
});
