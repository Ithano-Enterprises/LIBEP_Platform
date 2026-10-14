import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import { strings, type Lang, type Strings } from '../i18n/strings';
import { palettes, plexFonts, type FontSet, type Mode, type Palette } from '../theme/tokens';

// UI preferences: display mode and language. Defaults follow the design
// (Night, Kiswahili). Also carries the active font set (IBM Plex, or system
// fonts when Plex failed to load). Held in memory for now; persisted on the device once
// the data layer exists.

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
  initialMode = 'night',
  initialLang = 'sw',
  fonts = plexFonts,
}: {
  children: ReactNode;
  initialMode?: Mode;
  initialLang?: Lang;
  fonts?: FontSet;
}) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [lang, setLang] = useState<Lang>(initialLang);

  const value = useMemo<Preferences>(
    () => ({
      mode,
      lang,
      fonts,
      toggleMode: () => setMode((m) => (m === 'night' ? 'day' : 'night')),
      toggleLang: () => setLang((l) => (l === 'sw' ? 'en' : 'sw')),
    }),
    [mode, lang, fonts],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
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
