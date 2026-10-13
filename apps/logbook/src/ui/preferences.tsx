import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import { strings, type Lang, type Strings } from '../i18n/strings';
import { palettes, type Mode, type Palette } from '../theme/tokens';

// UI preferences: display mode and language. Defaults follow the design
// (Night, Kiswahili). Held in memory for now; persisted on the device once
// the data layer exists.

type Preferences = {
  mode: Mode;
  lang: Lang;
  toggleMode: () => void;
  toggleLang: () => void;
};

const PreferencesContext = createContext<Preferences | null>(null);

export function PreferencesProvider({
  children,
  initialMode = 'night',
  initialLang = 'sw',
}: {
  children: ReactNode;
  initialMode?: Mode;
  initialLang?: Lang;
}) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [lang, setLang] = useState<Lang>(initialLang);

  const value = useMemo<Preferences>(
    () => ({
      mode,
      lang,
      toggleMode: () => setMode((m) => (m === 'night' ? 'day' : 'night')),
      toggleLang: () => setLang((l) => (l === 'sw' ? 'en' : 'sw')),
    }),
    [mode, lang],
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
