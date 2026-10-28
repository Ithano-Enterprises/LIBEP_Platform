import { useEffect, useState } from 'react';
import { BackHandler, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DataError } from '../../data/repository';
import { useFontSet, useStrings, useTheme } from '../../ui/preferences';
import { CorrectionSheet } from './CorrectionSheet';
import { EntryDetail } from './EntryDetail';
import { useEntryDetail } from './useEntryDetail';

// Loads one entry and shows its detail, with the correction sheet over it.
// Phone: the whole screen under a back link. Tablet: the right pane.
export function EntryDetailBody({ catchId, wide = false }: { catchId: string; wide?: boolean }) {
  const c = useTheme();
  const t = useStrings();
  const insets = useSafeAreaInsets();
  const { data, error, correct } = useEntryDetail(catchId);
  const [correcting, setCorrecting] = useState(false);
  const [saving, setSaving] = useState(false);
  const f = useFontSet();
  const [saveError, setSaveError] = useState<string | null>(null);

  // While the sheet is open, Android back closes it (the newest handler runs first).
  useEffect(() => {
    if (!correcting) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setCorrecting(false);
      return true;
    });
    return () => sub.remove();
  }, [correcting]);

  if (error) return <Text style={[styles.error, f.mono, { color: c.danger }]}>{error.message}</Text>;
  if (!data) return null;
  const { entry, history, profile, tripOpen, menu } = data;
  if (!entry || !profile) {
    return <Text style={[styles.error, f.mono, { color: c.dim }]}>{t.entryNotFound}</Text>;
  }
  const gloss = menu.find((m) => m.id === entry.species_id)?.english_gloss ?? null;

  const onSave = async (input: { speciesId: string | null; quantity: number }) => {
    setSaving(true);
    setSaveError(null);
    try {
      await correct({
        previousCorrectionId: entry.head_correction_id,
        // Unchanged, or an "Other" catch left on its typed name: keep the species.
        speciesId: input.speciesId === entry.species_id || input.speciesId === null ? undefined : input.speciesId,
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

  return (
    <View testID="entry-detail" style={styles.fill}>
      <ScrollView
        style={styles.fill}
        contentContainerStyle={[
          wide ? styles.wideContent : styles.content,
          { paddingBottom: (wide ? 28 : 24) + insets.bottom },
        ]}
      >
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
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  error: { fontSize: 13, padding: 16 },
  content: { paddingTop: 8, paddingHorizontal: 16 },
  wideContent: { paddingTop: 28, paddingHorizontal: 32, maxWidth: 720, width: '100%' },
});
