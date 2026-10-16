import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { View } from 'react-native';

import { useOptionalLogbook } from '../data/LogbookProvider';
import { strings, type Lang, type Strings } from '../i18n/strings';
import { NIGHT, palettes, plexFonts, type FontSet, type Mode, type Palette } from '../theme/tokens';

// UI preferences: display mode and language. Defaults follow the design
// (Night, Kiswahili). Also carries the active font set (IBM Plex, or system
// fonts when Plex failed to load). Inside a LogbookProvider the choice is
// stored on the device (contract §4): it is read before the first screen
// paints, so a restart keeps it without a flash, and saved on every toggle.

type Preferences = {
  mode: Mode;
  lang: Lang;
  fonts: FontSet;
  toggleMode: () => void;
  toggleLang: () => void;
};

const PreferencesContext = createContext<Preferences | null>(null);

export function PreferencesProvider({
  children,
  initialMode,
  initialLang,
  fonts = plexFonts,
}: {
  children: ReactNode;
  /** Overrides the stored mode (tests, previews). */
  initialMode?: Mode;
  /** Overrides the stored language (tests, previews). */
  initialLang?: Lang;
  fonts?: FontSet;
}) {
  const logbook = useOptionalLogbook();
  const repo = logbook?.repo ?? null;
  const [mode, setMode] = useState<Mode>(initialMode ?? 'night');
  const [lang, setLang] = useState<Lang>(initialLang ?? 'sw');
  const needsStored = logbook !== null && (initialMode === undefined || initialLang === undefined);
  const [loaded, setLoaded] = useState(!needsStored);

  useEffect(() => {
    if (!repo || loaded) return;
    let alive = true;
    repo.getPreferences().then(
      (p) => {
        if (!alive) return;
        if (initialMode === undefined) setMode(p.mode);
        if (initialLang === undefined) setLang(p.lang);
        setLoaded(true);
      },
      () => alive && setLoaded(true),
    );
    return () => {
      alive = false;
    };
  }, [repo, loaded, initialMode, initialLang]);

  const value = useMemo<Preferences>(() => {
    const save = (write: Promise<void> | undefined) =>
      write?.catch((e: unknown) => console.warn('[logbook] could not save a preference', e));
    return {
      mode,
      lang,
      fonts,
      toggleMode: () => {
        const next: Mode = mode === 'night' ? 'day' : 'night';
        setMode(next);
        save(repo?.setPreference('mode', next));
      },
      toggleLang: () => {
        const next: Lang = lang === 'sw' ? 'en' : 'sw';
        setLang(next);
        save(repo?.setPreference('lang', next));
      },
    };
  }, [mode, lang, fonts, repo]);

  // Hold the screens back on the dark splash colour until the stored choice
  // is known (or the store failed to open: then the defaults are used).
  const ready = loaded || logbook?.error != null;
  return (
    <PreferencesContext.Provider value={value}>
      {ready ? children : <View testID="prefs-splash" style={{ flex: 1, backgroundColor: NIGHT.bg }} />}
    </PreferencesContext.Provider>
  );
}

export function usePreferences(): Preferences {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences must be used inside PreferencesProvider');
  return ctx;
}

export function useTheme(): Palette {
  return palettes[usePreferences().mode];
}

export function useStrings(): Strings {
  return strings[usePreferences().lang];
}

export function useFontSet(): FontSet {
  return usePreferences().fonts;
}
